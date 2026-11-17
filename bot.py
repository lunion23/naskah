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

import tts_provider

TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
ALLOWED = {x.strip() for x in os.getenv("ALLOWED_CHAT_IDS", "").split(",") if x.strip()}
MAX_ITEMS = 10  # batas naskah per pesan
MAX_REACT_ITEMS = 3  # batas naskah per pesan untuk mode /react (render lebih lama)
MAX_MOTION_ITEMS = 3  # batas naskah per pesan untuk mode /motion

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
    "Kirim  /react  diikuti naskah (format sama seperti di atas). Animasi sinkron dengan suara.\n\n"
    "Video infografis & animasi 2D (/motion):\n"
    "Kirim  /motion  diikuti naskah atau file .json storyboard. Ketik /motionhelp untuk panduan.\n\n""Template Reels Grid Lampu Sorot (/t10):\n""Kirim  /t10  diikuti teks 7 atau 19 bagian (pisah dengan |). Ketik /t10help untuk panduan."
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



T10_HELP = (
    "Mode /t10: Template Video Reels Grid Lampu Sorot (16 detik, 1080x1920).\n\n"
    "Cara 1 (Teks Cepat 7 Bagian):\n"
    "/t10 BANYAK YANG | BERHENTI | FOKUS | Melelahkan. | Tapi jangan mundur. | JADI MUSTAHIL UNTUK | KALAH\n\n"
    "Cara 2 (Teks Lengkap 19 Bagian):\n"
    "/t10 Depan | Redup | Label | Kata Merah | Keterangan | Kartu1 | Kartu2 | Kartu3 | Kartu4 | Pelan Depan | Pelan Emas | Pelan Bawah | Tekanan1 | Tekanan2 | SuatuHari | Menang | Konsisten | Penutup Atas | Penutup Besar\n\n"
    "• Tambahkan baris `narasi: teks suara...` di bawahnya jika ingin mengatur suara VO sendiri.\n"
    "• Bisa juga kirim file .json dengan caption /t10."
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
    """Kirim catatan suara (bila ada), lalu file subtitle (.srt) dan waktu (.json) di samping video."""
    for note in tts_provider.take_notes():
        send(chat_id, "ℹ️ " + note)
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
    raw = _unwrap_note_wrapper(raw)
    if not isinstance(raw, dict):
        return None
    text = str(raw.get("text") or raw.get("narasi") or raw.get("script") or "").strip()
    if not text:
        return None
    return {
        "title": str(raw.get("title") or raw.get("judul") or " ".join(text.split()[:5])),
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
    cleaned = _clean_json_text(content)
    if doc.get("file_name", "").lower().endswith(".json") or cleaned.startswith(("{", "[")):
        data = _unwrap_note_wrapper(json.loads(cleaned))
        if isinstance(data, dict):
            data = [data]
        items = [normalize(x) for x in data]
    else:
        items = [parse_text(content)]
    return [i for i in items if i]



MOTION_HELP = (
    "Mode /motion: video infografis & animasi 2D vertikal (gaya explainer).\n\n"
    "Cara 1 (Teks langsung):\n"
    "/motion\n"
    "judul: Anggaran Negara\n"
    "Tahukah kamu seberapa besar uang 25.000 triliun rupiah? ...\n\n"
    "Cara 2 (Storyboard JSON lengkap):\n"
    "Kirim file .json berisi daftar adegan (scenes) dengan caption /motion."
)


def _pick_bgm():
    """Ambil file musik latar dari folder music/ (jika ada)."""
    music_dir = Path("music")
    if not music_dir.exists():
        return None
    files = []
    for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
        files.extend(music_dir.glob(ext))
    return sorted(files)[0] if files else None


def _smart_truncate(text: str, max_chars: int = 95) -> str:
    """Potong teks di batas kata tanpa memotong kata di tengah."""
    clean = " ".join(text.strip().split())
    if len(clean) <= max_chars:
        return clean
    cut = clean[:max_chars].rsplit(" ", 1)[0].rstrip(",;:-")
    return (cut or clean[:max_chars]) + "..."


def _extract_key_figure(sentence: str):
    """Ambil angka/nominal penting dari kalimat (mis. Rp25.000 triliun, 90%, 15 bulan)."""
    m = re.search(
        r"(Rp\s?[0-9.,]+(?:\s?(?:ribu|juta|miliar|triliun|T|JT))?|[0-9.,]+\s?(?:%|persen|juta|miliar|triliun|tahun|bulan))",
        sentence,
        re.I,
    )
    return m.group(1).strip() if m else None


def _text_to_motion_storyboard(title: str, text: str) -> dict:
    """Ubah naskah teks biasa menjadi storyboard multi-adegan bersih tanpa placeholder."""
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", text.strip()) if s.strip()]
    scenes = []
    icons = ["💡", "📌", "🔎", "⚖️", "💰", "📈"]

    bright_themes = ["cream", "mint", "lavender", "coral"]
    for i, s in enumerate(sentences):
        fig = _extract_key_figure(s)
        th = bright_themes[i % len(bright_themes)]
        if i == 0:
            scenes.append({
                "type": "big_number",
                "theme": "cream",
                "narration": s,
                "data": {
                    "headline": title.upper(),
                    "subheadline": _smart_truncate(s, 95),
                    "rays": True,
                },
            })
        elif i == len(sentences) - 1 and len(sentences) > 1:
            scenes.append({
                "type": "cta_closing",
                "theme": "coral",
                "narration": s,
                "data": {
                    "headline": title.upper(),
                    "subheadline": _smart_truncate(s, 110),
                },
            })
        elif i % 2 == 1:
            scenes.append({
                "type": "statement_card",
                "theme": th,
                "narration": s,
                "data": {
                    "badge": f"FAKTA #{i}",
                    "icon": icons[i % len(icons)],
                    "highlight": fig or "",
                    "body": _smart_truncate(s, 120),
                },
            })
        else:
            scenes.append({
                "type": "character_story",
                "theme": "sky",
                "narration": s,
                "data": {
                    "character": "girl" if (i // 2) % 2 == 1 else "boy",
                    "card_value": fig or "",
                    "quote": "" if fig else _smart_truncate(s, 95),
                    "banner": _smart_truncate(title, 34),
                },
            })
    return {"title": title, "scenes": scenes}


def _clean_json_text(raw_text: str) -> str:
    """Bersihkan BOM, pagar kode ```json, prefix /motion, kutip melengkung, dan trailing comma."""
    s = raw_text.lstrip("\ufeff").strip()
    s = re.sub(r"^```(?:json|text|txt)?\s*", "", s, flags=re.I)
    s = re.sub(r"\s*```\s*$", "", s)
    s = re.sub(r"^\s*/motion(?:@\w+)?\s*", "", s, count=1, flags=re.I).strip()
    s = s.replace("\u201c", '"').replace("\u201d", '"').replace("\u2018", "'").replace("\u2019", "'")
    s = re.sub(r",\s*([}\]])", r"\1", s)
    return s.strip()


def _unwrap_note_wrapper(obj):
    """Buka pembungkus ekspor aplikasi catatan HP seperti {"id": ..., "content": "{...}"}."""
    if isinstance(obj, dict) and "content" in obj and not obj.get("scenes") and not obj.get("text"):
        inner = obj.get("content")
        if isinstance(inner, str) and inner.strip():
            cleaned_inner = _clean_json_text(inner)
            if cleaned_inner.startswith(("{", "[")):
                return json.loads(cleaned_inner)
    return obj


def _parse_motion_json(raw_text: str) -> list:
    """Parse storyboard JSON setelah dibersihkan dari karakter non-JSON & pembungkus Note."""
    cleaned = _clean_json_text(raw_text)
    raw = _unwrap_note_wrapper(json.loads(cleaned))
    items = raw if isinstance(raw, list) else [raw]
    out = []
    for it in items:
        it = _unwrap_note_wrapper(it)
        if isinstance(it, dict) and it.get("scenes"):
            out.append({"title": it.get("title") or "Infografis", "scenes": it["scenes"]})
        elif isinstance(it, dict) and it.get("text"):
            out.append(_text_to_motion_storyboard(it.get("title") or "Infografis", it["text"]))
    return out


def extract_motion(msg):
    """Kembalikan list storyboard {'title', 'scenes'} jika memakai /motion atau file ber-scenes."""
    doc = msg.get("document")
    caption = (msg.get("caption") or "").strip()

    if doc:
        raw_text = download_text(doc)
        if re.match(r"^/motion\b", caption, re.I):
            return _parse_motion_json(raw_text)
        # Deteksi otomatis untuk file JSON storyboard (langsung maupun dari ekspor aplikasi Note)
        cleaned = _clean_json_text(raw_text)
        if ("scenes" in cleaned) and cleaned.startswith(("{", "[")):
            try:
                parsed = _parse_motion_json(raw_text)
                if parsed:
                    return parsed
            except Exception:
                pass

    text = msg.get("text") or ""
    m = re.match(r"^/motion(?:@\w+)?(?:\s+|$)(.*)", text, re.S | re.I)
    if m:
        body = m.group(1).strip()
        if not body and msg.get("reply_to_message", {}).get("document"):
            return _parse_motion_json(download_text(msg["reply_to_message"]["document"]))
        if not body:
            return []
        cleaned_body = _clean_json_text(body)
        if cleaned_body.startswith(("{", "[")):
            return _parse_motion_json(body)
        parsed = parse_text(body)
        return [_text_to_motion_storyboard(parsed["title"], parsed["text"])] if parsed else []
    return None


def handle_motion(chat_id, items):
    if RENDERER == "termux":
        send(chat_id, NO_BROWSER)
        return
    if not items:
        send(chat_id, MOTION_HELP)
        return

    renderer_path = Path("motion_renderer.js")
    if not renderer_path.exists():
        send(chat_id, "File motion_renderer.js belum ada di root repository.")
        return

    render_code = renderer_path.read_text(encoding="utf-8")
    bgm_path = _pick_bgm()
    items = items[:MAX_MOTION_ITEMS]
    send(chat_id, f"🎬 Membuat {len(items)} video infografis 2D...")

    from js_video import build_motion_video

    for n, item in enumerate(items, 1):
        try:
            send(chat_id, f"({n}/{len(items)}) Merender: {item['title']} ({len(item['scenes'])} adegan)")
            k = next(counter)
            Path("output").mkdir(exist_ok=True)
            out = build_motion_video(
                item["scenes"],
                render_code,
                Path("output") / f"motion-{k:02d}.mp4",
                Path("cache") / f"motion{k}",
                title=item["title"],
                bgm_path=bgm_path,
            )
            send_video(chat_id, out, f"{item['title']} #Shorts")
            send_extras(chat_id, out)
        except Exception as e:
            traceback.print_exc()
            send(chat_id, f"Gagal membuat '{item['title']}': {str(e)[:300]}")


# ---------------- Mode /react: naskah -> video animasi React ----------------
def extract_react(msg):
    """Daftar naskah jika pesan memakai /react (bisa kosong), None jika bukan mode ini."""
    text = msg.get("text") or ""
    m = re.match(r"^/react(?:@\w+)?(?:\s+|$)(.*)", text, re.S | re.I)
    if m:
        body = m.group(1).strip()
        if not body and msg.get("reply_to_message", {}).get("document"):
            return read_document(msg["reply_to_message"]["document"])
        item = parse_text(body)
        return [item] if item else []
    caption = msg.get("caption") or ""
    if msg.get("document"):
        if re.match(r"^/react\b", caption, re.I):
            return read_document(msg["document"])
        if not caption:
            try:
                raw = _unwrap_note_wrapper(json.loads(_clean_json_text(download_text(msg["document"]))))
                items = raw if isinstance(raw, list) else [raw]
                if items and isinstance(items[0], dict) and str(items[0].get("mode", "")).lower() == "react":
                    return read_document(msg["document"])
            except Exception:
                pass
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



# ---------------- Template T10 Grid Lampu Sorot ----------------
def _is_t10_json(raw_text: str) -> bool:
    try:
        cleaned = _clean_json_text(raw_text)
        if not cleaned.startswith("{"):
            return False
        obj = _unwrap_note_wrapper(json.loads(cleaned))
        if not isinstance(obj, dict):
            return False
        t10_keys = {"pembuka", "kartu", "lelah", "pelan", "tekanan", "penutup"}
        return len(t10_keys.intersection(obj.keys())) >= 2
    except Exception:
        return False


def extract_t10(msg):
    """Kembalikan konfigurasi dict T10 jika pesan memakai /t10 atau file JSON T10 tanpa caption."""
    from t10_video import parse_t10_input

    doc = msg.get("document")
    caption = (msg.get("caption") or "").strip()
    if doc:
        raw_text = download_text(doc)
        if re.match(r"^/t10\b", caption, re.I):
            return parse_t10_input(raw_text)
        if not caption and _is_t10_json(raw_text):
            return parse_t10_input(raw_text)

    text = msg.get("text") or ""
    m = re.match(r"^/t10(?:@\w+)?(?:\s+|$)(.*)", text, re.S | re.I)
    if m:
        body = m.group(1).strip()
        if not body and msg.get("reply_to_message", {}).get("document"):
            return parse_t10_input(download_text(msg["reply_to_message"]["document"]))
        return parse_t10_input(body) if body else {}
    return None


def handle_t10(chat_id, k_data):
    if RENDERER == "termux":
        send(chat_id, NO_BROWSER)
        return
    if not k_data:
        from t10_video import parse_t10_input
        k_data = parse_t10_input("{}")

    send(chat_id, "🎬 Merender Template T10 Grid Lampu Sorot (durasi otomatis mengikuti suara)...")
    try:
        from t10_video import build_t10_video

        n = next(counter)
        Path("output").mkdir(exist_ok=True)
        out = build_t10_video(k_data, Path("output") / f"t10-{n:02d}.mp4", Path("cache") / f"t10_{n}")
        judul = f"{k_data['pembuka']['depan']} {k_data['pembuka']['label']}".strip()
        send_video(
            chat_id,
            out,
            f"{judul} #Shorts\n\nTemplate oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id",
        )
        send_extras(chat_id, out)
    except Exception as e:
        traceback.print_exc()
        send(chat_id, f"Gagal membuat video /t10: {str(e)[:400]}")

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
    if text.startswith("/motionhelp"):
        send(chat_id, MOTION_HELP)
        return
    if text.startswith("/t10help"):
        send(chat_id, T10_HELP)
        return

    try:
        t10_data = extract_t10(msg)
    except Exception as e:
        send(chat_id, f"Format /t10 tidak valid: {e}")
        return
    if t10_data is not None:
        handle_t10(chat_id, t10_data)
        return

    try:
        motion_items = extract_motion(msg)
    except Exception as e:
        send(chat_id, f"Storyboard /motion tidak valid: {e}")
        return
    if motion_items is not None:
        handle_motion(chat_id, motion_items)
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
