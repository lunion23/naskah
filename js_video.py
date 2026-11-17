"""
Mesin render HTML / JavaScript / Motion 2D -> MP4 vertikal 1080x1920 via Chromium Playwright + FFmpeg.
Dilengkapi pencampuran BGM normalize=0 dan efek suara transisi otomatis pada mode /motion.
"""

import json
import math
import os
import re
import shutil
import struct
import subprocess
import wave
from pathlib import Path

from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, concatenate_audioclips
from playwright.sync_api import sync_playwright

import auto_shorts as AS
import tts_provider
from bgm_generator import generate_bgm_wav
from subtitles_export import safe_export

W, H = 1080, 1920
FPS = 30
MAX_SECONDS = 300
DEFAULT_SECONDS = 8.0


def _make_transition_sfx(out_wav: Path, sample_rate: int = 44100) -> Path:
    """Buat efek suara whoosh + pop halus untuk transisi antar adegan /motion."""
    dur = 0.32
    n = int(dur * sample_rate)
    with wave.open(str(out_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)
        data = bytearray()
        for i in range(n):
            t = i / sample_rate
            env = math.sin(math.pi * (t / dur)) ** 1.6
            freq = 320 + 680 * (t / dur)
            sig = 0.45 * math.sin(2 * math.pi * freq * t) * env
            data.extend(struct.pack("<h", int(max(-0.9, min(0.9, sig)) * 32767)))
        wf.writeframes(data)
    return out_wav


def _mix_audio_with_bgm_ffmpeg(voice_wav: Path, bgm_wav: Path, out_wav: Path, bgm_vol: float = 0.22):
    """Campur narasi + BGM memakai FFmpeg amix normalize=0 agar volume suara dan BGM tetap jernih."""
    cmd = [
        "ffmpeg", "-y",
        "-i", str(voice_wav),
        "-stream_loop", "-1", "-i", str(bgm_wav),
        "-filter_complex",
        f"[1:a]volume={bgm_vol}[bg];[0:a][bg]amix=inputs=2:duration=first:dropout_transition=2:normalize=0[out]",
        "-map", "[out]",
        "-ar", "44100",
        str(out_wav),
    ]
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def render_html_to_mp4(html: str, duration: float, audio_wav: Path, out_path: Path, workdir: Path) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    html_file = workdir / "index.html"
    html_file.write_text(html, encoding="utf-8")

    frames_dir = workdir / "frames"
    if frames_dir.exists():
        shutil.rmtree(frames_dir)
    frames_dir.mkdir(parents=True, exist_ok=True)

    total_frames = max(1, math.ceil(duration * FPS))
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox", "--disable-dev-shm-usage"])
        page = browser.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        page.goto(html_file.resolve().as_uri(), wait_until="networkidle")
        page.wait_for_timeout(350)
        for f in range(total_frames):
            t = round(f / FPS, 6)
            page.evaluate(f"if (typeof draw === 'function') draw({t});")
            page.screenshot(path=str(frames_dir / f"frame_{f:05d}.png"), type="png")
        browser.close()

    cmd = [
        "ffmpeg", "-y",
        "-framerate", str(FPS),
        "-i", str(frames_dir / "frame_%05d.png"),
    ]
    if audio_wav and Path(audio_wav).exists():
        cmd += ["-i", str(audio_wav)]
    cmd += [
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "medium",
        "-crf", "20",
    ]
    if audio_wav and Path(audio_wav).exists():
        cmd += ["-c:a", "aac", "-b:a", "192k", "-shortest"]
    cmd.append(str(out_path))
    subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return out_path


def build_js_video(code: str, out_path: Path, workdir: Path) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    m_dur = re.search(r"//\s*durasi\s*:\s*([0-9]+(?:\.[0-9]+)?)", code, re.I)
    m_nar = re.search(r"//\s*narasi\s*:\s*(.+)", code, re.I)
    duration = min(float(m_dur.group(1)), MAX_SECONDS) if m_dur else DEFAULT_SECONDS
    narration = m_nar.group(1).strip() if m_nar else ""

    voice_wav = None
    if narration:
        sentences = AS.split_sentences(narration)
        audio_paths, _ = AS.make_voice(sentences, workdir)
        clips = [AudioFileClip(str(p)) for p in audio_paths]
        voice = concatenate_audioclips(clips)
        if not m_dur:
            duration = min(max(duration, voice.duration + 0.5), MAX_SECONDS)
        voice_wav = workdir / "js_voice.wav"
        voice.set_duration(duration).write_audiofile(str(voice_wav), fps=44100, logger=None)

    mix_wav = voice_wav
    if AS.MUSIC:
        bgm_wav = generate_bgm_wav(workdir / "js_bgm.wav", duration, style="cinematic")
        if voice_wav and voice_wav.exists():
            mix_wav = workdir / "js_mix.wav"
            _mix_audio_with_bgm_ffmpeg(voice_wav, bgm_wav, mix_wav, bgm_vol=0.22)
        else:
            mix_wav = bgm_wav

    is_full_html = "<html" in code.lower() or "<!doctype" in code.lower()
    if is_full_html:
        html = code
    else:
        html = f"""<!doctype html><html><head><meta charset="utf-8">
<style>html,body{{margin:0;background:#000;overflow:hidden}}canvas{{display:block}}</style></head>
<body><canvas id="c" width="{W}" height="{H}"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = {W}, H = {H};
{code}
</script></body></html>"""

    return render_html_to_mp4(html, duration, mix_wav, out_path, workdir)


def build_motion_video(
    scenes: list,
    render_code: str,
    out_path: Path,
    workdir: Path,
    title: str = "Infografis",
    bgm_path: Path = None,
) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    if not scenes:
        raise ValueError("Daftar scenes /motion kosong.")

    narrations = [str(sc.get("narration") or "").strip() for sc in scenes]
    valid_texts = [n if n else "Simak poin penting berikut ini." for n in narrations]

    print(f"• Membuat suara narasi /motion ({tts_provider.label()})...")
    audio_paths, all_marks = AS.make_voice(valid_texts, workdir)
    clips = [AudioFileClip(str(p)) for p in audio_paths]

    t_cursor = 0.0
    timeline_scenes = []
    subtitles_meta = []
    durations = []

    for idx, (sc, ac, marks) in enumerate(zip(scenes, clips, all_marks)):
        s_start = round(t_cursor, 3)
        s_end = round(t_cursor + ac.duration, 3)
        durations.append(ac.duration)

        word_list = []
        for w, a, b in AS.word_timings(valid_texts[idx], marks, ac.duration):
            word_list.append({"text": w, "start": round(t_cursor + a, 3), "end": round(t_cursor + b, 3)})

        sc_copy = dict(sc)
        sc_copy["start"] = s_start
        sc_copy["end"] = s_end
        timeline_scenes.append(sc_copy)
        subtitles_meta.append({
            "start": s_start,
            "end": s_end,
            "text": valid_texts[idx],
            "words": word_list,
        })
        t_cursor += ac.duration

    total_dur = min(t_cursor + 0.5, MAX_SECONDS)
    voice = concatenate_audioclips(clips)

    audio_layers = [voice]
    if len(timeline_scenes) > 1:
        try:
            sfx_path = _make_transition_sfx(workdir / "whoosh.wav")
            sfx_base = AudioFileClip(str(sfx_path)).volumex(0.35)
            for sc in timeline_scenes[1:]:
                if sc["start"] < total_dur - 0.3:
                    audio_layers.append(sfx_base.set_start(max(0.0, sc["start"] - 0.12)))
        except Exception as e:
            print(f"[!] SFX dilewati: {e}")

    voice_sfx_wav = workdir / "motion_voice_sfx.wav"
    CompositeAudioClip(audio_layers).set_duration(total_dur).write_audiofile(
        str(voice_sfx_wav), fps=44100, logger=None
    )

    final_audio = voice_sfx_wav
    if AS.MUSIC:
        bgm_file = bgm_path if (bgm_path and Path(bgm_path).exists()) else generate_bgm_wav(
            workdir / "motion_bgm.wav", total_dur, style="explainer"
        )
        final_audio = workdir / "motion_mix.wav"
        _mix_audio_with_bgm_ffmpeg(voice_sfx_wav, bgm_file, final_audio, bgm_vol=0.22)

    scenes_json = json.dumps(timeline_scenes, ensure_ascii=False).replace("</", "<\/")
    subs_json = json.dumps(subtitles_meta, ensure_ascii=False).replace("</", "<\/")
    label_json = json.dumps(os.getenv("MOTION_LABEL", "FAKTA & WAWASAN"), ensure_ascii=False)

    html = f"""<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
<style>html,body{{margin:0;background:#0f172a;overflow:hidden}}canvas{{display:block}}</style>
</head>
<body>
<canvas id="c" width="{W}" height="{H}"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = {W}, H = {H};
window.SCENES = {scenes_json};
window.SUBTITLES = {subs_json};
window.CHANNEL_LABEL = {label_json};

function getActiveScene(t) {{
  for (let i = 0; i < window.SCENES.length; i++) {{
    const s = window.SCENES[i];
    if (t >= s.start && t < s.end) {{
      const dur = Math.max(0.05, s.end - s.start);
      const localT = t - s.start;
      return {{ index: i, scene: s, localT: localT, progress: Math.min(1, Math.max(0, localT / dur)) }};
    }}
  }}
  const lastIdx = window.SCENES.length - 1;
  const last = window.SCENES[lastIdx];
  return last ? {{ index: lastIdx, scene: last, localT: last.end - last.start, progress: 1 }} : null;
}}

{render_code}
</script>
</body>
</html>"""

    out = render_html_to_mp4(html, total_dur, final_audio, out_path, workdir)
    safe_export(title, valid_texts, durations, all_marks, total_dur, out)
    return out
