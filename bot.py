"""
Bot Telegram -> pembuat Shorts -> kirim balik ke Telegram.
Dijalankan oleh GitHub Actions (lihat .github/workflows/shorts.yml).

Cara kerja:
  1. Ambil pesan baru lewat getUpdates (polling).
  2. Tandai pesan sudah dibaca (agar tidak diproses dua kali).
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

import requests

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = {x.strip() for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",") if x.strip()}
MAX_ITEMS = 10  # batas naskah per pesan

API = f"https://api.telegram.org/bot{TOKEN}"
FILE_API = f"https://api.telegram.org/file/bot{TOKEN}"
counter = itertools.count(1)

HELP = (
    "Halo! Kirim naskah, nanti saya buatkan video YouTube Shorts-nya.\n\n"
    "Format teks:\n"
    "judul: Madu Tidak Pernah Basi\n"
    "keyword: honey\n"
    "Tahukah kamu, ada satu makanan yang hampir tidak pernah basi? Madu. ...\n\n"
    "• keyword = kata kunci video latar (bahasa Inggris, opsional)\n"
    "• Untuk banyak naskah sekaligus, kirim file .json (maks "
    f"{MAX_ITEMS} naskah).\n"
    "• Proses butuh beberapa menit, hasil dikirim ke chat ini."
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


def read_document(doc):
    info = tg("getFile", data={"file_id": doc["file_id"]})
    r = requests.get(f"{FILE_API}/{info['file_path']}", timeout=60)
    r.raise_for_status()
    content = r.content.decode("utf-8-sig")
    if doc.get("file_name", "").lower().endswith(".json"):
        data = json.loads(content)
        if isinstance(data, dict):
            data = [data]
        items = [normalize(x) for x in data]
    else:
        items = [parse_text(content)]
    return [i for i in items if i]


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

    from auto_shorts import build_video  # impor di sini agar run kosong tetap cepat

    for n, item in enumerate(items, 1):
        try:
            send(chat_id, f"({n}/{len(items)}) Memproses: {item['title']}")
            out = build_video(item, next(counter))
            send_video(chat_id, out, f"{item['title']} #Shorts")
        except Exception as e:
            traceback.print_exc()
            send(chat_id, f"Gagal membuat '{item['title']}': {str(e)[:300]}")


def main():
    if not ALLOWED:
        sys.exit("ALLOWED_CHAT_IDS kosong. Isi dulu di GitHub Secrets.")

    updates = tg(
        "getUpdates",
        data={"timeout": 0, "allowed_updates": json.dumps(["message"])},
    )
    if not updates:
        print("Tidak ada pesan baru.")
        return

    # Tandai semua pesan sudah dibaca SEBELUM diproses, agar tidak terulang jika error
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
