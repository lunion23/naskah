"""
Pembuat video YouTube Shorts otomatis (mode standar: video latar Pexels + TTS + karaoke subtitle + BGM).
"""

import os
import random
import re
import subprocess
from pathlib import Path

import requests
from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, VideoFileClip, concatenate_audioclips, concatenate_videoclips

import tts_provider
from bgm_generator import generate_bgm_wav
from subtitles_export import safe_export

W, H = 1080, 1920
FPS = 30
MUSIC = os.getenv("ENABLE_MUSIC", "1").strip().lower() not in ("0", "false", "no", "off")
PEXELS_KEY = os.getenv("PEXELS_API_KEY", "").strip()


def split_sentences(text: str) -> list[str]:
    clean = " ".join(text.strip().split())
    if not clean:
        return []
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean) if s.strip()]


def make_voice(sentences: list[str], workdir: Path):
    workdir.mkdir(parents=True, exist_ok=True)
    audio_paths = []
    all_marks = []
    for i, sent in enumerate(sentences):
        out_mp3 = workdir / f"sent_{i:03d}.mp3"
        marks = tts_provider.synthesize(sent, out_mp3)
        audio_paths.append(out_mp3)
        all_marks.append(marks)
    return audio_paths, all_marks


def word_timings(sentence: str, marks: list, duration: float) -> list[tuple[str, float, float]]:
    words = sentence.split()
    if not words:
        return []
    if marks and len(marks) == len(words):
        res = []
        for idx, (w, m) in enumerate(zip(words, marks)):
            st = float(m.get("start", 0.0))
            en = float(marks[idx + 1]["start"]) if idx + 1 < len(marks) else duration
            res.append((w, st, max(st + 0.05, en)))
        return res
    step = duration / len(words)
    return [(w, i * step, (i + 1) * step) for i, w in enumerate(words)]


def make_music(duration: float, style: str = "upbeat", volume: float = 0.22):
    music_dir = Path("music")
    candidates = []
    if music_dir.exists():
        for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
            candidates.extend(music_dir.glob(ext))
    if candidates:
        chosen = random.choice(sorted(candidates))
        clip = AudioFileClip(str(chosen))
        if clip.duration < duration:
            loops = int(duration // clip.duration) + 1
            clip = concatenate_audioclips([clip] * loops)
        return clip.subclip(0, duration).volumex(volume)

    cache_dir = Path("cache")
    cache_dir.mkdir(exist_ok=True)
    gen_wav = generate_bgm_wav(cache_dir / f"auto_bgm_{style}.wav", duration + 1.0, style=style)
    return AudioFileClip(str(gen_wav)).subclip(0, duration).volumex(volume)


def _fetch_pexels_video(keyword: str, out_mp4: Path) -> bool:
    if not PEXELS_KEY:
        return False
    try:
        r = requests.get(
            "https://api.pexels.com/videos/search",
            headers={"Authorization": PEXELS_KEY},
            params={"query": keyword, "orientation": "portrait", "per_page": 6},
            timeout=30,
        )
        r.raise_for_status()
        videos = r.json().get("videos", [])
        if not videos:
            return False
        vid = random.choice(videos)
        files = sorted(vid.get("video_files", []), key=lambda f: f.get("width", 0))
        link = next((f["link"] for f in files if f.get("width", 0) >= 720), files[-1]["link"])
        vr = requests.get(link, timeout=60)
        vr.raise_for_status()
        out_mp4.write_bytes(vr.content)
        return True
    except Exception as e:
        print(f"[!] Pexels gagal: {e}")
        return False


def _make_fallback_bg(duration: float, out_mp4: Path):
    cmd = [
        "ffmpeg", "-y",
        "-f", "lavfi",
        "-i", f"color=c=#0f172a:s={W}x{H}:d={duration}:r={FPS}",
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        str(out_mp4),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def build_video(item: dict, idx: int = 1) -> Path:
    workdir = Path("cache") / f"std_{idx}"
    workdir.mkdir(parents=True, exist_ok=True)
    Path("output").mkdir(exist_ok=True)
    out_path = Path("output") / f"shorts-{idx:02d}.mp4"

    sentences = split_sentences(item["text"])
    if not sentences:
        raise ValueError("Naskah kosong.")

    audio_paths, all_marks = make_voice(sentences, workdir)
    clips = [AudioFileClip(str(p)) for p in audio_paths]
    voice = concatenate_audioclips(clips)
    total = voice.duration + 0.5

    audio = voice
    if MUSIC:
        try:
            audio = CompositeAudioClip([voice, make_music(total, style="upbeat")])
        except Exception as e:
            print(f"[!] Musik dilewati: {e}")

    mix_wav = workdir / "mix.wav"
    audio.set_duration(total).write_audiofile(str(mix_wav), fps=44100, logger=None)

    bg_mp4 = workdir / "bg.mp4"
    if not _fetch_pexels_video(item.get("keyword", "nature"), bg_mp4):
        _make_fallback_bg(total, bg_mp4)

    bg_clip = VideoFileClip(str(bg_mp4))
    if bg_clip.duration < total:
        loops = int(total // bg_clip.duration) + 1
        bg_clip = concatenate_videoclips([bg_clip] * loops)
    bg_clip = bg_clip.subclip(0, total).resize((W, H))

    trimmed_mp4 = workdir / "bg_fit.mp4"
    bg_clip.write_videofile(str(trimmed_mp4), fps=FPS, codec="libx264", audio=False, logger=None)

    safe_export(item["title"], sentences, [c.duration for c in clips], all_marks, total, out_path)
    srt_path = out_path.with_suffix(".srt")

    vf = f"subtitles={srt_path.as_posix()}:force_style='FontName=Arial,FontSize=18,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=120'"
    cmd = [
        "ffmpeg", "-y",
        "-i", str(trimmed_mp4),
        "-i", str(mix_wav),
        "-vf", vf,
        "-c:v", "libx264", "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "192k",
        "-shortest",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path
