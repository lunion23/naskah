"""
Pembuat video Shorts ringan untuk Termux / Android.
Hanya butuh: Python, Pillow, FFmpeg, dan edge-tts (tanpa moviepy, tanpa numpy).

Alur: naskah -> suara per kalimat + waktu tiap kata (Edge TTS) -> latar (video stok atau polos)
      -> subtitle karaoke (PNG per kata, ditempel sekali lewat FFmpeg) -> musik latar -> MP4 9:16.

Pemakaian mandiri:
    python termux_render.py scripts.json        # semua naskah
    python termux_render.py scripts.json 3      # hanya naskah nomor 3
Dipakai juga oleh bot.py bila RENDERER=termux.

Pengaturan lewat environment variable (semua opsional):
    VOICE, RATE, PEXELS_API_KEY, PIXABAY_API_KEY, MUSIC (1/0), MUSIC_VOLUME, FONT_PATH
"""

import asyncio
import json
import os
import random
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

import tts_provider
from subtitles_export import safe_export

# ---------------- KONFIGURASI ----------------
W, H, FPS = 1080, 1920, 30
VOICE = os.getenv("VOICE", "id-ID-ArdiNeural")
RATE = os.getenv("RATE", "+8%")
PEXELS_API_KEY = os.getenv("PEXELS_API_KEY", "")
PIXABAY_API_KEY = os.getenv("PIXABAY_API_KEY", "")
MUSIC = os.getenv("MUSIC", "1") != "0"
MUSIC_VOLUME = float(os.getenv("MUSIC_VOLUME", "0.12"))
MUSIC_DIR = Path("music")
FONT_SIZE = 78
SUB_Y = 1150            # posisi vertikal subtitle
SUB_H = 460             # tinggi kanvas subtitle
WORDS_PER_CHUNK = 3
COLOR_ACTIVE = (255, 214, 10, 255)
COLOR_NORMAL = (255, 255, 255, 255)
SEG_SECONDS = 5.0       # tiap potongan video stok maksimal sekian detik
UA = "Mozilla/5.0 (Linux; Android 13) shorts-bot"
FONT_CANDIDATES = [
    os.getenv("FONT_PATH", ""),
    "/system/fonts/Roboto-Bold.ttf",
    "/system/fonts/RobotoStatic-Bold.ttf",
    "/system/fonts/NotoSans-Bold.ttf",
    "/system/fonts/DroidSans-Bold.ttf",
    "/system/fonts/Roboto-Regular.ttf",
    "/system/fonts/DroidSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    str(Path.home() / "fonts" / "DejaVuSans-Bold.ttf"),
]

OUT_DIR = Path("output")
CACHE_DIR = Path("cache")
FFMPEG = shutil.which("ffmpeg") or "ffmpeg"
FFPROBE = shutil.which("ffprobe") or "ffprobe"


# ---------------- UTILITAS ----------------
def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        tail = (r.stderr or "").strip().splitlines()[-6:]
        raise RuntimeError("FFmpeg gagal: " + " | ".join(tail))
    return r


def media_duration(path) -> float:
    r = run([FFPROBE, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)])
    return float(r.stdout.strip())


def slugify(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")[:50] or "video"


def split_sentences(text: str):
    return [p.strip() for p in re.split(r"(?<=[.!?])\s+", text.strip()) if p.strip()]


def load_font(size: int):
    for path in FONT_CANDIDATES:
        if path and Path(path).exists():
            try:
                f = ImageFont.truetype(path, size)
                try:  # font variabel (Roboto di Android baru): minta tebal bila bisa
                    f.set_variation_by_name("Bold")
                except Exception:
                    pass
                return f
            except Exception:
                continue
    print("[!] Font tidak ditemukan, pakai font bawaan (kecil). Set FONT_PATH ke file .ttf.")
    return ImageFont.load_default()


def http_json(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, **(headers or {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.load(r)


def download(url, path: Path):
    if path.exists():
        return
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=90) as r, open(path, "wb") as f:
        shutil.copyfileobj(r, f)


# ---------------- 1. SUARA ----------------
def tts_sentence(text: str, path: Path, previous_text=None, next_text=None):
    """Suara via tts_provider (ElevenLabs atau Edge TTS). Mengembalikan waktu tiap kata."""
    return tts_provider.synthesize(text, path, previous_text, next_text, edge_voice=VOICE, edge_rate=RATE)


def word_timings(sentence: str, marks, duration: float):
    """[(kata, mulai, selesai)] relatif awal kalimat; pakai penanda TTS bila jumlahnya cocok."""
    words = sentence.split()
    if not words:
        return []
    if len(marks) == len(words):
        starts = [m[0] for m in marks]
    else:
        weights = [len(w) + 2 for w in words]
        total_w, acc, starts = sum(weights), 0.0, []
        for w in weights:
            starts.append(duration * acc / total_w)
            acc += w
    starts = [min(s, max(duration - 0.05, 0)) for s in starts]
    out = []
    for i, w in enumerate(words):
        end = starts[i + 1] if i + 1 < len(words) else duration
        out.append((w, starts[i], max(end, starts[i] + 0.05)))
    return out


def group_chunks(timed):
    chunks, cur = [], []
    for item in timed:
        cur.append(item)
        if len(cur) >= WORDS_PER_CHUNK or item[0][-1] in ".,!?;:":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


# ---------------- 2. SUBTITLE (PNG) ----------------
def render_state(words, active: int) -> Image.Image:
    """Satu potongan kata; kata ke-`active` disorot. Kanvas W x SUB_H, latar transparan."""
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
    img = Image.new("RGBA", (W, SUB_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for n, line in enumerate(lines):
        total = sum(x[2] for x in line) + space * (len(line) - 1)
        x = (W - total) / 2
        y = 20 + n * line_h
        for idx, w, ww in line:
            d.text((x, y), w, font=font,
                   fill=COLOR_ACTIVE if idx == active else COLOR_NORMAL,
                   stroke_width=8, stroke_fill=(0, 0, 0, 255))
            x += ww + space
    return img


def build_subtitle_track(sentences, durations, all_marks, total: float, workdir: Path) -> Path:
    """Tulis daftar concat FFmpeg: tiap keadaan (kata disorot) = satu PNG dengan durasinya."""
    pngs = workdir / "subs"
    if pngs.exists():
        shutil.rmtree(pngs)
    pngs.mkdir()
    blank = pngs / "blank.png"
    Image.new("RGBA", (W, SUB_H), (0, 0, 0, 0)).save(blank)

    segments, cursor, n, t0 = [], 0.0, 0, 0.0
    for sentence, dur, marks in zip(sentences, durations, all_marks):
        for chunk in group_chunks(word_timings(sentence, marks, dur)):
            words = [c[0] for c in chunk]
            for k, (_, a, b) in enumerate(chunk):
                start, end = t0 + a, t0 + b
                if start > cursor + 1e-3:
                    segments.append((blank, start - cursor))
                p = pngs / f"s{n:04d}.png"
                render_state(words, k).save(p)
                n += 1
                segments.append((p, max(end - start, 0.04)))
                cursor = end
        t0 += dur
    if total > cursor + 1e-3:
        segments.append((blank, total - cursor))

    lst = workdir / "subs.txt"
    with open(lst, "w", encoding="utf-8") as f:
        f.write("ffconcat version 1.0\n")
        for p, d in segments:
            f.write(f"file '{p.resolve()}'\nduration {d:.3f}\n")
        f.write(f"file '{segments[-1][0].resolve()}'\n")  # aturan concat: file terakhir diulang
    return lst


# ---------------- 3. LATAR ----------------
def fetch_stock_videos(keyword: str, n: int = 6):
    """Pexels dulu, lalu Pixabay. Jika semua gagal -> [] (latar polos)."""
    CACHE_DIR.mkdir(exist_ok=True)
    sources = []
    if PEXELS_API_KEY:
        sources.append(("Pexels", _pexels))
    if PIXABAY_API_KEY:
        sources.append(("Pixabay", _pixabay))
    if not sources:
        print("[!] Tidak ada API key video, pakai latar polos.")
        return []
    for name, fn in sources:
        try:
            paths = fn(keyword, n)
            if paths:
                return paths
            print(f"[!] {name}: tidak ada hasil untuk '{keyword}'.")
        except Exception as e:
            print(f"[!] {name} gagal: {e}")
    return []


def _pexels(keyword, n):
    q = urllib.parse.urlencode({"query": keyword, "orientation": "portrait", "per_page": n})
    data = http_json(f"https://api.pexels.com/videos/search?{q}", {"Authorization": PEXELS_API_KEY})
    out = []
    for v in data.get("videos", []):
        files = [f for f in v["video_files"] if f["file_type"] == "video/mp4"]
        if not files:
            continue
        best = min(files, key=lambda f: abs((f.get("width") or 0) - W))
        p = CACHE_DIR / f"pexels_{v['id']}.mp4"
        download(best["link"], p)
        out.append(p)
    return out


def _pixabay(keyword, n):
    q = urllib.parse.urlencode({"key": PIXABAY_API_KEY, "q": keyword[:100], "per_page": max(3, n), "safesearch": "true"})
    data = http_json(f"https://pixabay.com/api/videos/?{q}")
    out = []
    for v in data.get("hits", []):
        sizes = v.get("videos", {})
        best = next((sizes[k] for k in ("medium", "large", "small") if sizes.get(k, {}).get("url")), None)
        if not best:
            continue
        p = CACHE_DIR / f"pixabay_{v['id']}.mp4"
        download(best["url"], p)
        out.append(p)
    return out


def build_background(videos, total: float, out: Path):
    enc = ["-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", "-pix_fmt", "yuv420p", str(out)]
    if not videos:
        run([FFMPEG, "-y", "-loglevel", "error", "-f", "lavfi",
             "-i", f"color=c=0x141828:s={W}x{H}:r={FPS}:d={total:.2f}", *enc])
        return
    durs = {}
    seq, acc, i = [], 0.0, 0
    while acc < total and i < 200:
        p = videos[i % len(videos)]
        if p not in durs:
            durs[p] = media_duration(p)
        seg = min(SEG_SECONDS, durs[p])
        if seg > 0.2:
            seq.append((p, seg))
            acc += seg
        i += 1
    inputs, chains = [], []
    for k, (p, seg) in enumerate(seq):
        inputs += ["-t", f"{seg:.2f}", "-i", str(p)]
        chains.append(
            f"[{k}:v]scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},"
            f"setsar=1,fps={FPS},format=yuv420p,setpts=PTS-STARTPTS[v{k}]"
        )
    cat = "".join(f"[v{k}]" for k in range(len(seq))) + \
        f"concat=n={len(seq)}:v=1:a=0,trim=duration={total:.2f},setpts=PTS-STARTPTS[bg]"
    run([FFMPEG, "-y", "-loglevel", "error", *inputs,
         "-filter_complex", ";".join(chains + [cat]), "-map", "[bg]", *enc])


# ---------------- 4. MUSIK ----------------
def synth_pad(total: float, out: Path):
    """Musik ambient sederhana (akor Am) dari FFmpeg sendiri; bebas hak cipta."""
    ins = []
    for f in (110.0, 130.81, 164.81, 220.0):
        ins += ["-f", "lavfi", "-i", f"sine=frequency={f}:sample_rate=44100:duration={total:.2f}"]
    run([FFMPEG, "-y", "-loglevel", "error", *ins, "-filter_complex",
         "amix=inputs=4,volume=3,tremolo=f=0.2:d=0.25,lowpass=f=1100,aformat=channel_layouts=stereo",
         str(out)])


def music_input(total: float, workdir: Path):
    """Daftar argumen -i untuk musik, atau None bila dimatikan."""
    if not MUSIC:
        return None
    files = []
    if MUSIC_DIR.exists():
        for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
            files += list(MUSIC_DIR.glob(ext))
    if files:
        return ["-stream_loop", "-1", "-i", str(random.choice(files))]
    pad = workdir / "pad.wav"
    synth_pad(total, pad)
    return ["-i", str(pad)]


# ---------------- 5. RAKIT ----------------
def build_video(item: dict, index: int) -> Path:
    title = item["title"]
    sentences = split_sentences(item["text"])
    if not sentences:
        raise ValueError("Naskah kosong.")
    OUT_DIR.mkdir(exist_ok=True)
    CACHE_DIR.mkdir(exist_ok=True)
    slug = f"{index:02d}-{slugify(title)}"
    workdir = CACHE_DIR / slug
    workdir.mkdir(exist_ok=True)

    print(f"\n=== [{index}] {title} ===")
    print(f"• Membuat suara ({tts_provider.label()})...")
    durations, all_marks, mp3s = [], [], []
    for i, s in enumerate(sentences):
        p = workdir / f"s{i:02d}.mp3"
        prev = sentences[i - 1] if i > 0 else None
        nxt = sentences[i + 1] if i + 1 < len(sentences) else None
        all_marks.append(tts_sentence(s, p, prev, nxt))
        durations.append(media_duration(p))
        mp3s.append(p)

    lst = workdir / "voice.txt"
    lst.write_text("".join(f"file '{p.resolve()}'\n" for p in mp3s), encoding="utf-8")
    voice = workdir / "voice.wav"
    run([FFMPEG, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
         "-ar", "44100", "-ac", "2", str(voice)])
    total = sum(durations) + 0.4
    print(f"  Durasi: {total:.1f} detik")

    print("• Menyiapkan latar...")
    bg = workdir / "bg.mp4"
    build_background(fetch_stock_videos(item.get("keyword", "nature")), total, bg)

    print("• Membuat subtitle karaoke...")
    subs = build_subtitle_track(sentences, durations, all_marks, total, workdir)

    print("• Menggabungkan semua...")
    music = music_input(total, workdir)
    cmd = [FFMPEG, "-y", "-loglevel", "error", "-i", str(bg),
           "-f", "concat", "-safe", "0", "-i", str(subs), "-i", str(voice)]
    flt = [f"[1:v]fps={FPS},format=rgba[sub]",
           f"[0:v][sub]overlay=0:{SUB_Y}:eof_action=pass:format=auto[v]"]
    if music:
        cmd += music
        flt += ["[2:a]apad[va]",
                f"[3:a]volume={MUSIC_VOLUME},afade=t=in:st=0:d=1,afade=t=out:st={max(total - 1.5, 0):.2f}:d=1.5[ma]",
                "[va][ma]amix=inputs=2:duration=first,volume=2[a]"]
    else:
        flt += ["[2:a]apad[a]"]
    out = OUT_DIR / f"{slug}.mp4"
    cmd += ["-filter_complex", ";".join(flt), "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-r", str(FPS),
            "-c:a", "aac", "-b:a", "160k", "-t", f"{total:.2f}", "-movflags", "+faststart", str(out)]
    run(cmd)
    safe_export(title, sentences, durations, all_marks, total, out)
    print(f"✔ Selesai: {out}")
    return out


def main():
    scripts_file = sys.argv[1] if len(sys.argv) > 1 else "scripts.json"
    only = int(sys.argv[2]) if len(sys.argv) > 2 else None
    if not Path(scripts_file).exists():
        sys.exit(f"File {scripts_file} tidak ditemukan.")
    items = json.loads(Path(scripts_file).read_text(encoding="utf-8"))
    for i, item in enumerate(items, start=1):
        if only and i != only:
            continue
        try:
            build_video(item, i)
        except Exception as e:
            print(f"[x] Gagal pada naskah {i}: {e}")


if __name__ == "__main__":
    main()
