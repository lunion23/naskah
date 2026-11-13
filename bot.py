"""
Bot Telegram -> pembuat Shorts -> kirim balik ke Telegram.
Dijalankan oleh GitHub Actions (lihat .github/workflows/shorts.yml).

Cara kerja:
  1. Ambil pesan: dari UPDATE_JSON (mode webhook) atau getUpdates (mode polling).
  2. Pada mode polling, tandai pesan sudah dibaca agar tidak diproses dua kali.
  3. Buat video tiap naskah, kirim hasilnya ke chat pengirim.

Format pesan teks:
    judul: Madu Tidak Pernah Basi
    keyword: honey
    Tahukah kamu, ada satu makanan yang hampir tidak pernah basi? Madu. ...

Atau kirim file .json berisi banyak naskah:
    [{"title": "...", "keyword": "...", "text": "..."}]
"""

import itertools
import json
import os
import re
import sys
import traceback
from pathlib import Path

import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = {x.strip() for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",") if x.strip()}
MAX_ITEMS = 10  # batas naskah per pesan
MAX_REACT_ITEMS = 3  # batas naskah per pesan untuk mode /react (render lebih lama)

API = f"https://api.telegram.org/bot{TOKEN}"
FILE_API = f"https://api.telegram.org/file/bot{TOKEN}"
counter = itertools.count(1)
RENDERER = os.getenv("RENDERER", "").strip().lower()      # "termux" = pembuat video ringan (FFmpeg + Pillow)
POLL_TIMEOUT = int(os.getenv("POLL_TIMEOUT", "0"))         # detik; >0 = long polling (hemat baterai di HP)
NO_BROWSER = (
    "Mode ini butuh browser (Chromium) yang belum tersedia di Termux. "
    "Jalankan lewat GitHub Actions, atau gunakan naskah teks / file .json biasa."
)


def get_build_video():
    if RENDERER == "termux":
        from termux_render import build_video
    else:
        from auto_shorts import build_video
    return build_video

HELP = (
    "Halo! Kirim naskah, nanti saya buatkan video YouTube Shorts-nya.\n\n"
    "Format teks:\n"
    "judul: Madu Tidak Pernah Basi\n"
    "keyword: honey\n"
    "Tahukah kamu, ada satu makanan yang hampir tidak pernah basi? Madu. ...\n\n"
    "• keyword = kata kunci video latar (bahasa Inggris, opsional)\n"
    "• Untuk banyak naskah sekaligus, kirim file .json (maks "
    f"{MAX_ITEMS} naskah).\n"
    "• Proses butuh beberapa menit, hasil dikirim ke chat ini.\n\n"
    "Video dari kode JavaScript:\n"
    "Kirim  /js  diikuti kode, atau kirim file .js / .html. Ketik /jshelp untuk panduan.\n\n"
    "Video animasi React dari naskah:\n"
    "Kirim  /react  diikuti naskah (format sama seperti di atas). Animasi sinkron dengan suara."
)

REACT_HELP = (
    "Mode /react: naskah jadi video animasi bergaya React yang sinkron dengan suara.\n\n"
    "Format:\n"
    "/react\n"
    "judul: Pelangi Berbentuk Lingkaran\n"
    "Tahukah kamu, pelangi sebenarnya lingkaran penuh! ...\n\n"
    "• Bisa juga kirim file .json dengan keterangan (caption) /react.\n"
    f"• Maksimal {MAX_REACT_ITEMS} naskah per pesan; tiap video butuh sekitar 3-6 menit.\n"
    "• Kata 'keyword' tidak dipakai di mode ini (latar dianimasikan sendiri)."
)

JS_HELP = (
    "Kirim kode JavaScript, saya ubah jadi video 1080x1920.\n\n"
    "Format: /js lalu kode (atau kirim sebagai file .js / .html jika panjang).\n\n"
    "Tersedia: canvas, ctx, W, H (jangan dideklarasikan ulang).\n"
    "Tulis function draw(t) { ... } dengan t = detik, atau pakai requestAnimationFrame biasa.\n\n"
    "Baris pengaturan di awal kode:\n"
    "// durasi: 10   (detik, maks 45, bawaan 8)\n"
    "// narasi: teks yang dibacakan   (opsional, menambah suara)\n\n"
    "Contoh:\n"
    "/js\n"
    "// durasi: 5\n"
    "function draw(t) {\n"
    "  ctx.fillStyle = 'hsl(' + (t * 60) + ',70%,30%)';\n"
    "  ctx.fillRect(0, 0, W, H);\n"
    "  ctx.fillStyle = '#fff'; ctx.font = 'bold 120px sans-serif';\n"
    "  ctx.fillText('Halo ' + t.toFixed(1), 200, 900);\n"
    "}"
)


# ---------------- Telegram helpers ----------------
def tg(method, **kwargs):
    r = requests.post(f"{API}/{method}", timeout=300, **kwargs)
    r.raise_for_status()
    return r.json()["result"]


def send(chat_id, text):
    tg("sendMessage", data={"chat_id": chat_id, "text": text[:4000]})


def send_video(chat_id, path, caption):
    with open(path, "rb") as f:
        tg(
            "sendVideo",
            data={
                "chat_id": chat_id,
                "caption": caption[:1000],
                "supports_streaming": "true",
                "width": 1080,
                "height": 1920,
            },
            files={"video": f},
        )


def send_document(chat_id, path, caption=""):
    with open(path, "rb") as f:
        tg("sendDocument", data={"chat_id": chat_id, "caption": caption[:1000]}, files={"document": f})


def send_extras(chat_id, video_path):
    """Kirim file subtitle (.srt) dan waktu (.json) yang dibuat berdampingan dengan video."""
    for ext, caption in ((".srt", "Subtitle (SRT)"), (".json", "Waktu per kalimat dan kata (JSON)")):
        p = Path(video_path).with_suffix(ext)
        if p.exists():
            try:
                send_document(chat_id, p, caption)
            except Exception:
                traceback.print_exc()


# ---------------- Parsing naskah ----------------
def parse_text(text):
    title = keyword = None
    body = []
    for line in text.splitlines():
        m_title = re.match(r"^\s*(judul|title)\s*:\s*(.+)$", line, re.I)
        m_key = re.match(r"^\s*(keyword|kata kunci)\s*:\s*(.+)$", line, re.I)
        if m_title and not title:
            title = m_title.group(2).strip()
        elif m_key and not keyword:
            keyword = m_key.group(2).strip()
        else:
            body.append(line.strip())
    content = " ".join(l for l in body if l)
    if not content:
        return None
    return {
        "title": title or " ".join(content.split()[:5]),
        "keyword": keyword or "nature",
        "text": content,
    }


def normalize(raw):
    text = str(raw.get("text", "")).strip()
    if not text:
        return None
    return {
        "title": str(raw.get("title") or " ".join(text.split()[:5])),
        "keyword": str(raw.get("keyword") or "nature"),
        "text": text,
    }


def download_text(doc):
    info = tg("getFile", data={"file_id": doc["file_id"]})
    r = requests.get(f"{FILE_API}/{info['file_path']}", timeout=60)
    r.raise_for_status()
    return r.content.decode("utf-8-sig")


def read_document(doc):
    content = download_text(doc)
    if doc.get("file_name", "").lower().endswith(".json"):
        data = json.loads(content)
        if isinstance(data, dict):
            data = [data]
        items = [normalize(x) for x in data]
    else:
        items = [parse_text(content)]
    return [i for i in items if i]


# ---------------- Mode /react: naskah -> video animasi React ----------------
def extract_react(msg):
    """Daftar naskah jika pesan memakai /react (bisa kosong), None jika bukan mode ini."""
    text = msg.get("text") or ""
    m = re.match(r"^/react(?:@\w+)?(?:\s+|$)(.*)", text, re.S | re.I)
    if m:
        item = parse_text(m.group(1))
        return [item] if item else []
    caption = msg.get("caption") or ""
    if msg.get("document") and re.match(r"^/react\b", caption, re.I):
        return read_document(msg["document"])
    return None


def handle_react(chat_id, items):
    if RENDERER == "termux":
        send(chat_id, NO_BROWSER)
        return
    if not items:
        send(chat_id, REACT_HELP)
        return
    items = items[:MAX_REACT_ITEMS]
    send(chat_id, f"🎬 Membuat {len(items)} video animasi React. Tiap video sekitar 3-6 menit...")

    from react_video import build_react_video  # impor di sini agar run biasa tetap ringan

    for n, item in enumerate(items, 1):
        try:
            send(chat_id, f"({n}/{len(items)}) Memproses: {item['title']}")
            k = next(counter)
            Path("output").mkdir(exist_ok=True)
            out = build_react_video(item, Path("output") / f"react-{k:02d}.mp4", Path("cache") / f"react{k}")
            send_video(chat_id, out, f"{item['title']} #Shorts")
            send_extras(chat_id, out)
        except Exception as e:
            traceback.print_exc()
            send(chat_id, f"Gagal membuat '{item['title']}': {str(e)[:300]}")


# ---------------- Video dari kode JS ----------------
def extract_js(msg):
    """Kembalikan kode JS/HTML jika pesan meminta video dari kode, selain itu None."""
    doc = msg.get("document")
    if doc and doc.get("file_name", "").lower().endswith((".js", ".html", ".htm")):
        return download_text(doc)
    text = msg.get("text") or ""
    m = re.match(r"^/js(?:@\w+)?(?:\s+|$)(.*)", text, re.S | re.I)
    if m:
        return m.group(1)
    return None


def handle_js(chat_id, code):
    if RENDERER == "termux":
        send(chat_id, NO_BROWSER)
        return
    if not code.strip():
        send(chat_id, JS_HELP)
        return
    send(chat_id, "🎬 Menjalankan kode JS dan merekam video...")
    try:
        from js_video import build_js_video  # impor di sini agar run biasa tetap ringan

        n = next(counter)
        Path("output").mkdir(exist_ok=True)
        out = build_js_video(code, Path("output") / f"js-{n:02d}.mp4", Path("cache") / f"js{n}")
        send_video(chat_id, out, "Video dari kode JS")
    except Exception as e:
        traceback.print_exc()
        send(chat_id, f"Gagal membuat video JS: {str(e)[:400]}")


# ---------------- Proses satu pesan ----------------
def handle_message(msg):
    chat_id = str(msg["chat"]["id"])
    if chat_id not in ALLOWED:
        send(chat_id, f"Akses ditolak. Chat ID kamu: {chat_id}")
        return

    text = (msg.get("text") or "").strip()
    if text.startswith(("/start", "/help")):
        send(chat_id, HELP)
        return
    if text.startswith("/jshelp"):
        send(chat_id, JS_HELP)
        return

    try:
        react_items = extract_react(msg)
    except Exception as e:
        send(chat_id, f"File tidak bisa dibaca: {e}")
        return
    if react_items is not None:
        handle_react(chat_id, react_items)
        return

    try:
        js_code = extract_js(msg)
    except Exception as e:
        send(chat_id, f"File tidak bisa dibaca: {e}")
        return
    if js_code is not None:
        handle_js(chat_id, js_code)
        return

    try:
        if "document" in msg:
            items = read_document(msg["document"])
        else:
            item = parse_text(text)
            items = [item] if item else []
    except Exception as e:
        send(chat_id, f"File tidak bisa dibaca: {e}")
        return

    if not items:
        send(chat_id, "Naskah tidak ditemukan.\n\n" + HELP)
        return

    items = items[:MAX_ITEMS]
    send(chat_id, f"Diterima {len(items)} naskah. Mulai diproses...")

    build_video = get_build_video()  # impor di sini agar run kosong tetap cepat

    for n, item in enumerate(items, 1):
        try:
            send(chat_id, f"({n}/{len(items)}) Memproses: {item['title']}")
            out = build_video(item, next(counter))
            send_video(chat_id, out, f"{item['title']} #Shorts")
            send_extras(chat_id, out)
        except Exception as e:
            traceback.print_exc()
            send(chat_id, f"Gagal membuat '{item['title']}': {str(e)[:300]}")


def main():
    if not ALLOWED:
        sys.exit("ALLOWED_CHAT_IDS kosong. Isi di GitHub Secrets (atau file .env di Termux).")

    payload = os.getenv("UPDATE_JSON", "").strip()
    if payload and payload != "null":
        # Mode webhook: pesan dikirim oleh Cloudflare Worker lewat repository_dispatch
        updates = [json.loads(payload)]
    else:
        # Mode polling (tanpa webhook)
        updates = tg(
            "getUpdates",
            data={"timeout": POLL_TIMEOUT, "allowed_updates": json.dumps(["message"])},
        )
        if not updates:
            print("Tidak ada pesan baru.")
            return
        # Tandai sudah dibaca SEBELUM diproses, agar tidak terulang jika error
        last_id = max(u["update_id"] for u in updates)
        tg("getUpdates", data={"offset": last_id + 1, "timeout": 0})

    for u in updates:
        if "message" in u:
            try:
                handle_message(u["message"])
            except Exception:
                traceback.print_exc()


if __name__ == "__main__":
    main()
