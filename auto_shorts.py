"""
Auto YouTube Shorts Generator
-----------------------------
Alur: naskah -> suara (Edge TTS) -> video stok (Pexels) -> subtitle -> MP4 9:16

Instalasi:
    pip install -r requirements.txt   (moviepy 1.0.3 butuh pillow<10 dan numpy<2)
    (butuh FFmpeg terpasang di sistem)

Persiapan:
    1. Ambil API key video gratis (cukup salah satu):
         - Pexels:  https://www.pexels.com/api/  (kadang penerbitan key baru dijeda)
         - Pixabay: daftar di https://pixabay.com lalu buka https://pixabay.com/api/docs/
    2. Set environment variable PEXELS_API_KEY atau PIXABAY_API_KEY, mis. di Mac/Linux:
         export PIXABAY_API_KEY="isi_key_kamu"
       Tanpa key apa pun, video tetap jadi dengan latar polos.
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
import random
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
from moviepy.audio.AudioClip import AudioArrayClip, CompositeAudioClip
from moviepy.audio.fx import all as afx
from PIL import Image, ImageDraw, ImageFont

# ---------------- KONFIGURASI ----------------
W, H, FPS = 1080, 1920, 30
VOICE = "id-ID-ArdiNeural"      # pria. Alternatif wanita: "id-ID-GadisNeural"
RATE = "+8%"                    # kecepatan bicara, mis. "+0%", "+10%", "-5%"
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "")   # alternatif jika Pexels tidak tersedia
MAX_CLIP_SECONDS = 5            # tiap potongan video stok maksimal sekian detik
FONT_SIZE = 78
SUB_Y = 1150                    # posisi vertikal subtitle
SUB_STYLE = "karaoke"           # "karaoke" = kata yang sedang diucapkan menyala, "plain" = satu kalimat utuh
WORDS_PER_CHUNK = 3             # jumlah kata yang tampil sekaligus (gaya karaoke)
COLOR_ACTIVE = (255, 214, 10, 255)   # kuning untuk kata yang sedang diucapkan
COLOR_NORMAL = (255, 255, 255, 255)  # putih untuk kata lainnya
POP_EFFECT = True               # teks "membal" sebentar setiap potongan kata baru muncul
MUSIC = True                    # musik latar tipis di bawah suara
MUSIC_VOLUME = 0.12             # 0.0 - 1.0 (lebih kecil = lebih pelan)
MUSIC_DIR = Path("music")       # taruh file .mp3/.wav bebas hak cipta di sini; jika kosong dibuat musik ambient otomatis
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


# ---------------- PEMETAAN KATA KUNCI PINTAR ----------------
KEYWORD_MAPPING = {
    "durian": "durian fruit food",
    "soda": "cola soft drink bubbles",
    "kembung": "stomach pain health care",
    "lambung": "stomach anatomy medical",
    "hoax": "warning caution red sign",
    "kesehatan": "healthy lifestyle medical",
    "makanan": "delicious food eating"
}

def get_smart_keyword(original_keyword: str) -> str:
    key_lower = original_keyword.lower()
    for k, v in KEYWORD_MAPPING.items():
        if k in key_lower:
            return v
    return original_keyword


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
    """Simpan suara ke path dan kembalikan waktu tiap kata [(mulai, selesai), ...] dalam detik."""
    try:
        comm = edge_tts.Communicate(text, VOICE, rate=RATE, boundary="WordBoundary")
    except TypeError:  # edge-tts versi lama tidak punya parameter boundary
        comm = edge_tts.Communicate(text, VOICE, rate=RATE)
    marks = []
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                a = chunk["offset"] / 1e7
                marks.append((a, a + chunk["duration"] / 1e7))
    return marks


def make_voice(sentences, workdir: Path):
    """Satu file audio per kalimat supaya durasi subtitle akurat. Mengembalikan (paths, marks)."""
    paths, all_marks = [], []
    for i, s in enumerate(sentences):
        p = workdir / f"s{i:02d}.mp3"
        all_marks.append(asyncio.run(_tts(s, p)))
        paths.append(p)
    return paths, all_marks


# ---------------- 2. VISUAL ----------------
def download_file(url: str, path: Path):
    if path.exists():
        return
    with requests.get(url, stream=True, timeout=60) as dl:
        dl.raise_for_status()
        with open(path, "wb") as fh:
            for chunk in dl.iter_content(1 << 20):
                fh.write(chunk)


def fetch_pexels_videos(keyword: str, n: int = 6):
    """Unduh beberapa video vertikal dari Pexels (di-cache)."""
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
        best = min(files, key=lambda f: abs((f.get("width") or 0) - W))
        p = CACHE_DIR / f"pexels_{v['id']}.mp4"
        download_file(best["link"], p)
        paths.append(p)
    return paths


def fetch_pixabay_videos(keyword: str, n: int = 6):
    """Unduh beberapa video dari Pixabay (di-cache). Dipotong ke 9:16 oleh fit_to_frame."""
    r = requests.get(
        "https://pixabay.com/api/videos/",
        params={"key": PIXABAY_API_KEY, "q": keyword[:100], "per_page": max(3, n), "safesearch": "true"},
        timeout=30,
    )
    r.raise_for_status()
    paths = []
    for v in r.json().get("hits", []):
        sizes = v.get("videos", {})
        best = next((sizes[q] for q in ("large", "medium", "small") if sizes.get(q, {}).get("url")), None)
        if not best:
            continue
        p = CACHE_DIR / f"pixabay_{v['id']}.mp4"
        download_file(best["url"], p)
        paths.append(p)
    return paths


def fetch_stock_videos(keyword: str):
    """Coba Pexels dulu, lalu Pixabay. Jika semua gagal, kembalikan [] (latar polos)."""
    sources = []
    if PEXELS_API_KEY:
        sources.append(("Pexels", fetch_pexels_videos))
    if PIXABAY_API_KEY:
        sources.append(("Pixabay", fetch_pixabay_videos))
    if not sources:
        print("[!] Tidak ada API key video (PEXELS_API_KEY / PIXABAY_API_KEY), pakai latar polos.")
        return []
    for name, fn in sources:
        try:
            paths = fn(keyword)
            if paths:
                return paths
            print(f"[!] {name}: tidak ada hasil untuk '{keyword}'.")
        except Exception as e:
            print(f"[!] {name} gagal: {e}")
    return []


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


def word_timings(sentence: str, marks, duration: float):
    """Waktu tampil tiap kata: [(kata, mulai, selesai), ...] relatif terhadap awal kalimat.
    Memakai penanda dari Edge TTS jika jumlahnya cocok; jika tidak, dibagi menurut panjang kata."""
    words = sentence.split()
    if not words:
        return []
    if len(marks) == len(words):
        starts = [m[0] for m in marks]
    else:
        weights = [len(w) + 2 for w in words]  # +2 agar kata pendek tidak terlalu cepat
        total_w, acc, starts = sum(weights), 0.0, []
        for w in weights:
            starts.append(duration * acc / total_w)
            acc += w
    starts = [min(st, max(duration - 0.05, 0)) for st in starts]
    out = []
    for i, w in enumerate(words):
        end = starts[i + 1] if i + 1 < len(words) else duration
        out.append((w, starts[i], max(end, starts[i] + 0.05)))
    return out


def group_chunks(timed_words):
    """Kelompokkan kata jadi potongan pendek; berhenti di tanda baca."""
    chunks, cur = [], []
    for item in timed_words:
        cur.append(item)
        if len(cur) >= WORDS_PER_CHUNK or item[0][-1] in ".,!?;:":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def render_chunk(words, active: int) -> np.ndarray:
    """Gambar satu potongan kata; kata ke-`active` diberi warna sorot."""
    font = load_font(FONT_SIZE)
    probe = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    space = probe.textlength(" ", font=font)
    max_w = W - 160

    lines, cur, cur_w = [], [], 0.0
    for idx, w in enumerate(words):
        ww = probe.textlength(w, font=font)
        add = ww if not cur else ww + space
        if cur and cur_w + add > max_w:
            lines.append(cur)
            cur, cur_w, add = [], 0.0, ww
        cur.append((idx, w, ww))
        cur_w += add
    lines.append(cur)

    line_h = FONT_SIZE + 22
    img = Image.new("RGBA", (W, line_h * len(lines) + 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for n, line in enumerate(lines):
        total = sum(x[2] for x in line) + space * (len(line) - 1)
        x = (W - total) / 2
        y = 20 + n * line_h
        for idx, w, ww in line:
            d.text(
                (x, y), w, font=font,
                fill=COLOR_ACTIVE if idx == active else COLOR_NORMAL,
                stroke_width=8, stroke_fill=(0, 0, 0, 255),
            )
            x += ww + space
    return np.array(img)


def pop_in(clip, y, dur=0.12, amp=0.12):
    """Teks muncul sedikit lebih besar lalu mengecil ke ukuran normal (efek membal)."""
    h = clip.h

    def scale(t):
        return 1 + amp * max(0.0, 1 - t / dur)

    return clip.resize(scale).set_position(
        lambda t: (int(round(-(scale(t) - 1) * W / 2)), int(round(y - (scale(t) - 1) * h / 2)))
    )


def karaoke_clips(sentences, audio_clips, all_marks):
    """Buat klip subtitle per kata, disusun mengikuti waktu suara."""
    clips, t0 = [], 0.0
    for sentence, ac, marks in zip(sentences, audio_clips, all_marks):
        timed = word_timings(sentence, marks, ac.duration)
        for chunk in group_chunks(timed):
            words = [c[0] for c in chunk]
            for k, (_, a, b) in enumerate(chunk):
                c = ImageClip(render_chunk(words, k)).set_start(t0 + a).set_duration(b - a)
                if k == 0 and POP_EFFECT:
                    c = pop_in(c, SUB_Y)
                else:
                    c = c.set_position((0, SUB_Y))
                clips.append(c)
        t0 += ac.duration
    return clips


# ---------------- 3b. MUSIK LATAR ----------------
def ambient_pad_array(duration: float, sr: int = 44100) -> np.ndarray:
    """Musik ambient lembut buatan sendiri (bebas hak cipta): progresi Am - F - C - G."""
    chords = [
        (110.00, 130.81, 164.81, 220.00),   # Am
        (87.31, 110.00, 130.81, 174.61),    # F
        (130.81, 164.81, 196.00, 261.63),   # C
        (98.00, 123.47, 146.83, 196.00),    # G
    ]
    seg = 8.0
    n = int(duration * sr)
    t = np.arange(n) / sr
    out = np.zeros((n, 2), dtype=np.float64)
    for k in range(int(np.ceil(duration / seg)) + 1):
        c = (k + 0.5) * seg
        lo, hi = max(int((c - seg) * sr), 0), min(int((c + seg) * sr), n)
        if lo >= hi:
            continue
        tt = t[lo:hi]
        w = np.sin(np.pi / 2 * np.clip(1 - np.abs(tt - c) / seg, 0, 1)) ** 2
        for ch, detune in ((0, 0.998), (1, 1.002)):
            sig = np.zeros_like(tt)
            for f in chords[k % 4]:
                sig += np.sin(2 * np.pi * f * detune * tt) + 0.35 * np.sin(2 * np.pi * 2 * f * detune * tt)
            out[lo:hi, ch] += sig * w
    out *= 1 + 0.15 * np.sin(2 * np.pi * 0.2 * t)[:, None]   # tremolo pelan
    peak = np.max(np.abs(out)) or 1.0
    return (out / peak * 0.8).astype(np.float32)


def make_music(duration: float):
    files = []
    if MUSIC_DIR.exists():
        for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
            files += list(MUSIC_DIR.glob(ext))
    if files:
        src = AudioFileClip(str(random.choice(files)))
        clip = src.subclip(0, duration) if src.duration >= duration else src.fx(afx.audio_loop, duration=duration)
    else:
        clip = AudioArrayClip(ambient_pad_array(duration), fps=44100)
    return (
        clip.fx(afx.volumex, MUSIC_VOLUME)
        .fx(afx.audio_fadein, 1.0)
        .fx(afx.audio_fadeout, 1.5)
    )


# ---------------- 4. RAKIT VIDEO ----------------
def build_video(item: dict, index: int):
    title = item["title"]
    
    # Menerapkan smart keyword agar video stok tidak melenceng jauh
    raw_keyword = item.get("keyword", "nature")
    keyword = get_smart_keyword(raw_keyword)
    
    sentences = split_sentences(item["text"])
    slug = f"{index:02d}-{slugify(title)}"
    workdir = CACHE_DIR / slug
    workdir.mkdir(exist_ok=True)

    print(f"\n=== [{index}] {title} ===")
    print(f"• Mengambil video stok untuk keyword: '{keyword}' (asli: '{raw_keyword}')")
    print("• Membuat suara...")
    
    audio_paths, all_marks = make_voice(sentences, workdir)
    audio_clips = [AudioFileClip(str(p)) for p in audio_paths]
    voice = concatenate_audioclips(audio_clips)
    total = voice.duration + 0.4
    print(f"  Durasi: {total:.1f} detik")

    print("• Mengambil visual...")
    bg = make_background(fetch_stock_videos(keyword), total)

    print("• Menempel subtitle...")
    if SUB_STYLE == "karaoke":
        subs = karaoke_clips(sentences, audio_clips, all_marks)
    else:
        subs, t = [], 0.0
        for sentence, ac in zip(sentences, audio_clips):
            sub = (
                ImageClip(render_subtitle(sentence))
                .set_start(t)
                .set_duration(ac.duration)
                .set_position(("center", SUB_Y))
            )
            subs.append(sub)
            t += ac.duration

    audio = voice
    if MUSIC:
        try:
            print("• Menambah musik latar...")
            audio = CompositeAudioClip([voice, make_music(total)])
        except Exception as e:
            print(f"[!] Musik dilewati: {e}")

    final = CompositeVideoClip([bg, *subs], size=(W, H)).set_audio(audio)
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
