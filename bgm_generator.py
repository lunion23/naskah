"""
Generator musik latar (BGM) prosedural bebas hak cipta dengan 3 gaya:
  - upbeat    : ceria & energik (untuk Mode Standar & /react)
  - explainer : hangat & modern (untuk Mode /motion)
  - cinematic : atmosferik & dalam (untuk Mode /js & /t10)
"""

import math
import struct
import wave
from pathlib import Path


def generate_bgm_wav(out_path: Path, duration: float, style: str = "upbeat", sample_rate: int = 44100) -> Path:
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    dur = max(1.0, float(duration))
    total_samples = int(dur * sample_rate)

    if style == "explainer":
        bpm = 104.0
        chords = [
            (261.63, 329.63, 392.00),  # C
            (220.00, 261.63, 329.63),  # Am
            (174.61, 220.00, 261.63),  # F
            (196.00, 246.94, 293.66),  # G
        ]
    elif style == "cinematic":
        bpm = 84.0
        chords = [
            (146.83, 220.00, 293.66),  # Dm
            (116.54, 174.61, 233.08),  # Bb
            (130.81, 196.00, 261.63),  # C
            (110.00, 164.81, 220.00),  # Am
        ]
    else:  # upbeat
        bpm = 118.0
        chords = [
            (261.63, 329.63, 392.00),  # C
            (196.00, 246.94, 293.66),  # G
            (220.00, 261.63, 329.63),  # Am
            (174.61, 220.00, 261.63),  # F
        ]

    beat_dur = 60.0 / bpm
    bar_dur = beat_dur * 4.0

    with wave.open(str(out_path), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sample_rate)

        chunk_size = 4096
        buf = bytearray()
        two_pi = 2.0 * math.pi

        for start in range(0, total_samples, chunk_size):
            end = min(total_samples, start + chunk_size)
            for idx in range(start, end):
                t = idx / sample_rate
                bar_idx = int(t / bar_dur) % len(chords)
                chord = chords[bar_idx]
                beat_pos = (t % beat_dur) / beat_dur

                pad = sum(math.sin(two_pi * f * t) for f in chord) / 3.0
                if style == "cinematic":
                    sub = 0.45 * math.sin(two_pi * (chord[0] * 0.5) * t)
                    shimmer = 0.25 * math.sin(two_pi * (chord[2] * 2.0) * t) * (0.6 + 0.4 * math.sin(two_pi * 0.5 * t))
                    sig = 0.55 * pad + sub + shimmer
                elif style == "explainer":
                    arp_note = chord[int((t / (beat_dur * 0.5))) % 3] * 2.0
                    env = math.exp(-5.0 * ((t % (beat_dur * 0.5)) / (beat_dur * 0.5)))
                    pluck = 0.35 * math.sin(two_pi * arp_note * t) * env
                    sig = 0.55 * pad + pluck
                else:
                    arp_note = chord[int((t / (beat_dur * 0.5))) % 3] * 2.0
                    env = math.exp(-4.0 * ((t % (beat_dur * 0.5)) / (beat_dur * 0.5)))
                    pluck = 0.42 * math.sin(two_pi * arp_note * t) * env
                    pulse = 0.30 * math.sin(two_pi * (chord[0] * 0.5) * t) * (1.0 - 0.5 * beat_pos)
                    sig = 0.45 * pad + pluck + pulse

                fade = 1.0
                if t < 1.2:
                    fade = t / 1.2
                elif dur - t < 1.2:
                    fade = max(0.0, (dur - t) / 1.2)

                val = max(-0.95, min(0.95, sig * fade * 0.72))
                buf.extend(struct.pack("<h", int(val * 32767)))

            wf.writeframes(buf)
            buf.clear()

    return out_path
