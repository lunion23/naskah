"""
Auto YouTube Shorts Generator
-----------------------------
Alur: naskah -> suara (Edge TTS) -> video stok (Pexels) -> subtitle -> MP4 9:16

Instalasi:
    pip install -r requirements.txt   (moviepy 1.0.3 butuh pillow<10 dan numpy<2)
    (butuh FFmpeg terpasang di sistem)

Persiapan:
    1. Daftar gratis di https://www.pexels.com/api/ lalu ambil API key.
    2. Set environment variable:
         Windows (PowerShell): $env:PEXELS_API_KEY="isi_key_kamu"
         Mac/Linux:            export PEXELS_API_KEY="isi_key_kamu"
    3. Buat file scripts.json (contoh ada di bawah).

Pemakaian:
    python auto_shorts.py                 # buat semua video dari scripts.json
    python auto_shorts.py scripts.json 3  # hanya naskah nomor 3

Contoh scripts.json:
[
  {
    "title": "Madu Tidak Pernah Basi",
    "keyword": "honey",
    "text": "Tahukah kamu, ada satu makanan yang hampir tidak pernah basi? Madu. Para arkeolog pernah menemukan madu di makam Mesir kuno yang masih aman dimakan. Follow untuk fakta unik lainnya!"
  }
]
"""

import asyncio
import json
import os
import re
import sys
from pathlib import Path

import edge_tts
import numpy as np
import requests
from moviepy.editor import (
    AudioFileClip,
    ColorClip,
    CompositeVideoClip,
    ImageClip,
    VideoFileClip,
    concatenate_audioclips,
    concatenate_videoclips,
)
from PIL import Image, ImageDraw, ImageFont

# ---------------- KONFIGURASI ----------------
W, H, FPS = 1080, 1920, 30
VOICE = "id-ID-ArdiNeural"      # pria. Alternatif wanita: "id-ID-GadisNeural"
RATE = "+8%"                    # kecepatan bicara, mis. "+0%", "+10%", "-5%"
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
MAX_CLIP_SECONDS = 5            # tiap potongan video stok maksimal sekian detik
FONT_SIZE = 78
SUB_Y = 1150                    # posisi vertikal subtitle
FONT_CANDIDATES = [
    os.getenv("FONT_PATH", ""),
    "C:/Windows/Fonts/arialbd.ttf",
    "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
]

OUT_DIR = Path("output")
CACHE_DIR = Path("cache")
OUT_DIR.mkdir(exist_ok=True)
CACHE_DIR.mkdir(exist_ok=True)


# ---------------- UTILITAS ----------------
def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "video"


def split_sentences(text: str):
    parts = re.split(r"(?<=[.!?])\s+", text.strip())
    return [p.strip() for p in parts if p.strip()]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if path and Path(path).exists():
            return ImageFont.truetype(path, size)
    print("[!] Font tidak ditemukan, pakai font bawaan (kecil). Set FONT_PATH.")
    return ImageFont.load_default()


# ---------------- 1. SUARA ----------------
async def _tts(text: str, path: Path):
    await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))


def make_voice(sentences, workdir: Path):
    """Satu file audio per kalimat supaya durasi subtitle akurat."""
    paths = []
    for i, s in enumerate(sentences):
        p = workdir / f"s{i:02d}.mp3"
        asyncio.run(_tts(s, p))
        paths.append(p)
    return paths


# ---------------- 2. VISUAL ----------------
def fetch_pexels_videos(keyword: str, n: int = 6):
    """Unduh beberapa video vertikal dari Pexels (di-cache)."""
    if not PEXELS_API_KEY:
        print("[!] PEXELS_API_KEY kosong, pakai latar warna polos.")
        return []
    r = requests.get(
        "https://api.pexels.com/videos/search",
        headers={"Authorization": PEXELS_API_KEY},
        params={"query": keyword, "orientation": "portrait", "per_page": n},
        timeout=30,
    )
    r.raise_for_status()
    paths = []
    for v in r.json().get("videos", []):
        files = [f for f in v["video_files"] if f["file_type"] == "video/mp4"]
        if not files:
            continue
        # pilih resolusi mendekati 1080 lebar
        best = min(files, key=lambda f: abs((f.get("width") or 0) - W))
        p = CACHE_DIR / f"pexels_{v['id']}.mp4"
        if not p.exists():
            with requests.get(best["link"], stream=True, timeout=60) as dl:
                dl.raise_for_status()
                with open(p, "wb") as fh:
                    for chunk in dl.iter_content(1 << 20):
                        fh.write(chunk)
        paths.append(p)
    return paths


def fit_to_frame(clip):
    if clip.w / clip.h > W / H:
        clip = clip.resize(height=H)
    else:
        clip = clip.resize(width=W)
    return clip.crop(x_center=clip.w / 2, y_center=clip.h / 2, width=W, height=H)


def make_background(video_paths, duration: float):
    if not video_paths:
        return ColorClip((W, H), color=(20, 24, 40)).set_duration(duration)

    clips, total, i = [], 0.0, 0
    while total < duration:
        src = VideoFileClip(str(video_paths[i % len(video_paths)]), audio=False)
        seg = min(MAX_CLIP_SECONDS, src.duration, duration - total)
        clips.append(fit_to_frame(src.subclip(0, seg)))
        total += seg
        i += 1
    bg = concatenate_videoclips(clips, method="compose")
    return bg.set_duration(duration)


# ---------------- 3. SUBTITLE ----------------
def render_subtitle(text: str) -> np.ndarray:
    font = load_font(FONT_SIZE)
    max_w = W - 160
    words, lines, cur = text.split(), [], ""
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    for w in words:
        test = f"{cur} {w}".strip()
        if probe.textlength(test, font=font) <= max_w:
            cur = test
        else:
            lines.append(cur)
            cur = w
    lines.append(cur)

    line_h = FONT_SIZE + 18
    img = Image.new("RGBA", (W, line_h * len(lines) + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for n, line in enumerate(lines):
        tw = d.textlength(line, font=font)
        d.text(
            ((W - tw) / 2, 20 + n * line_h),
            line,
            font=font,
            fill=(255, 255, 255, 255),
            stroke_width=7,
            stroke_fill=(0, 0, 0, 255),
        )
    return np.array(img)


# ---------------- 4. RAKIT VIDEO ----------------
def build_video(item: dict, index: int):
    title = item["title"]
    keyword = item.get("keyword", "nature")
    sentences = split_sentences(item["text"])
    slug = f"{index:02d}-{slugify(title)}"
    workdir = CACHE_DIR / slug
    workdir.mkdir(exist_ok=True)

    print(f"\n=== [{index}] {title} ===")
    print("• Membuat suara...")
    audio_paths = make_voice(sentences, workdir)
    audio_clips = [AudioFileClip(str(p)) for p in audio_paths]
    voice = concatenate_audioclips(audio_clips)
    total = voice.duration + 0.4
    print(f"  Durasi: {total:.1f} detik")

    print("• Mengambil visual...")
    bg = make_background(fetch_pexels_videos(keyword), total)

    print("• Menempel subtitle...")
    subs, t = [], 0.0
    for sentence, ac in zip(sentences, audio_clips):
        img = render_subtitle(sentence)
        sub = (
            ImageClip(img)
            .set_start(t)
            .set_duration(ac.duration)
            .set_position(("center", SUB_Y))
        )
        subs.append(sub)
        t += ac.duration

    final = CompositeVideoClip([bg, *subs], size=(W, H)).set_audio(voice)
    final = final.set_duration(total)

    out = OUT_DIR / f"{slug}.mp4"
    print("• Render video...")
    final.write_videofile(
        str(out),
        fps=FPS,
        codec="libx264",
        audio_codec="aac",
        preset="medium",
        threads=4,
        logger=None,
    )
    print(f"✔ Selesai: {out}")
    return out


def main():
    scripts_file = sys.argv[1] if len(sys.argv) > 1 else "scripts.json"
    only = int(sys.argv[2]) if len(sys.argv) > 2 else None

    if not Path(scripts_file).exists():
        sys.exit(f"File {scripts_file} tidak ditemukan. Lihat contoh di bagian atas skrip.")

    items = json.loads(Path(scripts_file).read_text(encoding="utf-8"))
    for i, item in enumerate(items, start=1):
        if only and i != only:
            continue
        try:
            build_video(item, i)
        except Exception as e:  # lanjut ke naskah berikutnya jika ada yang gagal
            print(f"[x] Gagal pada naskah {i}: {e}")


if __name__ == "__main__":
    main()
