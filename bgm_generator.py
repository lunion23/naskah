"""
bgm_generator.py — Generator Musik Latar (BGM) Terpusat untuk Semua Mode Video.
Mendukung:
  1. Memuat file audio dari folder `music/` (.mp3, .wav, .m4a, .ogg) secara otomatis jika tersedia.
  2. Membuat musik latar sintetis multi-layer (Warm Pad + Pluck/Arpeggio + Sub Bass) secara otomatis
     jika folder `music/` kosong, dengan pilihan gaya:
     - "explainer" (cocok untuk /motion & naskah edukasi)
     - "upbeat"    (cocok untuk Shorts cepat & /react)
     - "cinematic" (cocok untuk /t10 & /js dramatis)
     - "ambient"   (lembut & tenang)
"""

import math
import random
import struct
import wave
from pathlib import Path

MUSIC_DIR = Path("music")


def pick_music_file() -> Path | None:
    """Ambil file musik acak dari folder music/ jika ada."""
    if not MUSIC_DIR.exists():
        return None
    files = []
    for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
        files.extend(MUSIC_DIR.glob(ext))
    return random.choice(files) if files else None


def generate_bgm_wav(
    out_path: Path,
    duration: float = 16.0,
    style: str = "explainer",
    sr: int = 22050,
) -> Path:
    """Buat file WAV musik latar bebas hak cipta dengan progresi akor, melodi petik, dan bass lembut."""
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    duration = max(float(duration), 2.0)

    if style == "cinematic":
        # Progresi Em - C - G - D (megah & motivasional untuk /t10 dan /js)
        chords = [
            (82.41, 123.47, 164.81, 246.94),   # Em
            (65.41, 130.81, 164.81, 196.00),   # C
            (98.00, 146.83, 196.00, 246.94),   # G
            (73.42, 146.83, 220.00, 293.66),   # D
        ]
        step_dur = 0.25
        pluck_gain = 0.28
        bass_gain = 0.36
    elif style == "upbeat":
        # Progresi C - G - Am - F (cerah & bersemangat untuk Shorts & /react)
        chords = [
            (130.81, 164.81, 196.00, 261.63),  # C
            (98.00, 123.47, 146.83, 196.00),   # G
            (110.00, 130.81, 164.81, 220.00),  # Am
            (87.31, 110.00, 130.81, 174.61),   # F
        ]
        step_dur = 0.20
        pluck_gain = 0.34
        bass_gain = 0.30
    else:
        # Progresi Am - F - C - G (hangat & cerdas untuk /motion & explainer)
        chords = [
            (110.00, 130.81, 164.81, 220.00),  # Am
            (87.31, 110.00, 130.81, 174.61),   # F
            (130.81, 164.81, 196.00, 261.63),  # C
            (98.00, 123.47, 146.83, 196.00),   # G
        ]
        step_dur = 0.25
        pluck_gain = 0.32
        bass_gain = 0.30

    bar_dur = 4.0
    total_samples = int(duration * sr)
    frames = bytearray()

    for i in range(total_samples):
        t = i / sr
        c_idx = int(t // bar_dur) % len(chords)
        chord = chords[c_idx]
        local_t = t % bar_dur
        pad_env = 0.55 + 0.45 * math.sin(math.pi * (local_t / bar_dur))

        # 1. Warm Stereo Pad
        pad_l = 0.0
        pad_r = 0.0
        for f in chord[:3]:
            pad_l += math.sin(2.0 * math.pi * (f * 0.9985) * t)
            pad_r += math.sin(2.0 * math.pi * (f * 1.0015) * t)
        pad_l = (pad_l / 3.2) * pad_env * 0.38
        pad_r = (pad_r / 3.2) * pad_env * 0.38

        # 2. Melodic Pluck / Marimba Arpeggio
        step_idx = int(t // step_dur)
        step_t = t - step_idx * step_dur
        pluck_env = math.exp(-step_t * 10.5)
        pattern = (0, 2, 1, 3, 2, 1, 3, 2)
        note_f = chord[pattern[step_idx % len(pattern)]] * 2.0
        pluck = (
            math.sin(2.0 * math.pi * note_f * t)
            + 0.22 * math.sin(4.0 * math.pi * note_f * t)
        ) * pluck_env * pluck_gain

        # 3. Warm Sub-Bass Pulse
        beat_t = t % 1.0
        bass_env = math.exp(-beat_t * 4.2)
        bass = math.sin(2.0 * math.pi * (chord[0] * 0.5) * t) * bass_env * bass_gain

        # Fade in 0.8s & fade out 1.2s
        master_env = 1.0
        if t < 0.8:
            master_env = t / 0.8
        elif t > duration - 1.2:
            master_env = max((duration - t) / 1.2, 0.0)

        left = max(-1.0, min(1.0, (pad_l + pluck * 0.92 + bass) * master_env))
        right = max(-1.0, min(1.0, (pad_r + pluck * 1.08 + bass) * master_env))
        frames.extend(struct.pack("<hh", int(left * 32767), int(right * 32767)))

    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(bytes(frames))
    return out_path


def get_bgm_path(workdir: Path, duration: float = 16.0, style: str = "explainer", custom_bgm: Path = None) -> Path:
    """Ambil file musik dari parameter/folder music/, atau buat otomatis jika belum ada."""
    if custom_bgm and Path(custom_bgm).exists():
        return Path(custom_bgm)
    picked = pick_music_file()
    if picked:
        return picked
    return generate_bgm_wav(Path(workdir) / f"auto_bgm_{style}.wav", duration=duration, style=style)
