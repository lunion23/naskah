"""
Renderer ringan berbasis FFmpeg + Pillow untuk dijalankan langsung di Termux (Android) tanpa Chromium.
Mendukung narasi TTS, latar visual dinamis, subtitle SRT, dan musik latar otomatis (bgm_generator.py).
"""

import os
import subprocess
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont
from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, concatenate_audioclips

import auto_shorts as AS
from subtitles_export import safe_export

W, H = 1080, 1920
FPS = 30


def _make_card_image(title: str, out_png: Path):
    img = Image.new("RGB", (W, H), color=(15, 23, 42))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        ratio = y / H
        r = int(15 + 15 * ratio)
        g = int(23 + 35 * ratio)
        b = int(42 + 68 * ratio)
        draw.line([(0, y), (W, y)], fill=(r, g, b))

    try:
        font_title = ImageFont.truetype("/system/fonts/Roboto-Bold.ttf", 64)
        font_badge = ImageFont.truetype("/system/fonts/Roboto-Bold.ttf", 32)
    except Exception:
        font_title = ImageFont.load_default()
        font_badge = ImageFont.load_default()

    draw.rounded_rectangle([(80, 180), (440, 245)], radius=24, fill=(234, 88, 12))
    draw.text((115, 195), "SHORTS • INFO", fill=(255, 255, 255), font=font_badge)

    words = title.split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if len(test) > 22 and cur:
            lines.append(cur)
            cur = w
        else:
            cur = test
    if cur:
        lines.append(cur)

    y_pos = 310
    for line in lines[:5]:
        draw.text((80, y_pos), line, fill=(255, 255, 255), font=font_title)
        y_pos += 84

    img.save(out_png)


def build_video(item: dict, idx: int = 1) -> Path:
    workdir = Path("cache") / f"termux_{idx}"
    workdir.mkdir(parents=True, exist_ok=True)
    Path("output").mkdir(exist_ok=True)
    out_path = Path("output") / f"termux-{idx:02d}.mp4"

    sentences = AS.split_sentences(item["text"])
    if not sentences:
        raise ValueError("Naskah kosong.")

    audio_paths, all_marks = AS.make_voice(sentences, workdir)
    clips = [AudioFileClip(str(p)) for p in audio_paths]
    voice = concatenate_audioclips(clips)
    total = voice.duration + 0.5

    audio = voice
    if AS.MUSIC:
        try:
            audio = CompositeAudioClip([voice, AS.make_music(total, style="upbeat")])
        except Exception as e:
            print(f"[!] Musik dilewati: {e}")

    mix_wav = workdir / "mix.wav"
    audio.set_duration(total).write_audiofile(str(mix_wav), fps=44100, logger=None)

    card_png = workdir / "card.png"
    _make_card_image(item["title"], card_png)

    safe_export(item["title"], sentences, [c.duration for c in clips], all_marks, total, out_path)
    srt_path = out_path.with_suffix(".srt")

    vf = (
        f"scale={W}:{H},"
        f"subtitles={srt_path.as_posix()}:force_style="
        "'FontSize=20,PrimaryColour=&H00FFFFFF,OutlineColour=&H00000000,BorderStyle=1,Outline=2,Alignment=2,MarginV=260'"
    )
    cmd = [
        "ffmpeg", "-y",
        "-loop", "1", "-framerate", str(FPS), "-t", str(total),
        "-i", str(card_png),
        "-i", str(mix_wav),
        "-vf", vf,
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-preset", "ultrafast",
        "-c:a", "aac", "-b:a", "128k",
        "-shortest",
        str(out_path),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path
