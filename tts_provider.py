"""
Penyedia suara terpusat untuk semua pembuat video: ElevenLabs (utama) atau Edge TTS (cadangan).
Tanpa dependensi luar untuk ElevenLabs (hanya pustaka standar Python).

Pemilihan penyedia:
  - TTS_PROVIDER=elevenlabs | edge   (paksa salah satu)
  - kosong: pakai ElevenLabs jika ELEVENLABS_API_KEY terisi, selain itu Edge TTS.

Pengaturan ElevenLabs (environment variable):
  ELEVENLABS_API_KEY    kunci API (wajib)
  ELEVENLABS_VOICE_ID   ID suara dari akun kamu (bawaan: 21m00Tcm4TlvDq8ikWAM)
  ELEVENLABS_MODEL      bawaan eleven_multilingual_v2 (kualitas terbaik); eleven_flash_v2_5 lebih murah
  ELEVENLABS_SPEED      0.7 - 1.2, bawaan 1.0
  ELEVENLABS_STABILITY  0 - 1, bawaan 0.5
  ELEVENLABS_SIMILARITY 0 - 1, bawaan 0.75
  ELEVENLABS_FORMAT     bawaan mp3_44100_128

synthesize() menulis file suara dan mengembalikan waktu tiap kata [(mulai, selesai), ...] dalam detik
(kosong bila tidak tersedia; pembuat video lalu memperkirakan sendiri).
"""

import asyncio
import base64
import json
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_VOICE_ID = "pNInz6obpgDQGcFmaJgB"
DEFAULT_MODEL = "eleven_multilingual_v2"
API_BASE = "https://api.elevenlabs.io/v1/text-to-speech"

HINTS = {
    401: "API key tidak valid, atau kuota karakter habis.",
    402: "Paket ElevenLabs kamu belum mengizinkan fitur/suara ini (mis. suara dari Voice Library butuh paket berbayar).",
    404: "Voice ID tidak ditemukan di akun kamu.",
    422: "Parameter ditolak (cek ELEVENLABS_VOICE_ID dan ELEVENLABS_MODEL).",
    429: "Terlalu banyak permintaan sekaligus (batas konkurensi paket).",
}


class ElevenLabsError(RuntimeError):
    def __init__(self, code, message):
        super().__init__(message)
        self.code = code


def provider() -> str:
    p = os.getenv("TTS_PROVIDER", "").strip().lower()
    if p in ("edge", "elevenlabs"):
        return p
    return "elevenlabs" if os.getenv("ELEVENLABS_API_KEY", "").strip() else "edge"


def label() -> str:
    if provider() == "elevenlabs":
        return f"ElevenLabs, model {os.getenv('ELEVENLABS_MODEL', '').strip() or DEFAULT_MODEL}"
    return "Edge TTS"


def _float_env(name, default):
    try:
        return float(os.getenv(name, "").strip() or default)
    except ValueError:
        return default


# ---------------- ElevenLabs ----------------
def words_from_alignment(text: str, alignment) -> list:
    """Ubah waktu per karakter jadi waktu per kata [(mulai, selesai)], urut seperti text.split()."""
    if not alignment:
        return []
    chars = alignment.get("characters") or []
    starts = alignment.get("character_start_times_seconds") or []
    ends = alignment.get("character_end_times_seconds") or []
    if not chars or not (len(chars) == len(starts) == len(ends)):
        return []
    marks, cur_s, cur_e = [], None, None
    for ch, a, b in zip(chars, starts, ends):
        if ch.isspace():
            if cur_s is not None:
                marks.append((float(cur_s), float(cur_e)))
                cur_s = None
        else:
            if cur_s is None:
                cur_s = a
            cur_e = b
    if cur_s is not None:
        marks.append((float(cur_s), float(cur_e)))
    return marks if len(marks) == len(text.split()) else []


def _error_message(e: urllib.error.HTTPError) -> str:
    try:
        raw = json.loads(e.read().decode("utf-8", "replace"))
        detail = raw.get("detail", raw)
        if isinstance(detail, dict):
            msg = detail.get("message") or detail.get("status") or json.dumps(detail)
        elif isinstance(detail, list) and detail:
            msg = "; ".join(str(d.get("msg", d)) for d in detail[:2])
        else:
            msg = str(detail)
    except Exception:
        msg = e.reason if hasattr(e, "reason") else ""
    hint = HINTS.get(e.code, "")
    return f"ElevenLabs error {e.code}: {msg}" + (f" ({hint})" if hint else "")


def _post(url: str, body: dict, key: str, retries: int = 3) -> dict:
    data = json.dumps(body).encode("utf-8")
    for attempt in range(retries + 1):
        req = urllib.request.Request(
            url, data=data, method="POST",
            headers={"xi-api-key": key, "Content-Type": "application/json", "Accept": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise ElevenLabsError(e.code, _error_message(e))
        except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
            if attempt < retries:
                time.sleep(2 * (attempt + 1))
                continue
            raise RuntimeError(f"Tidak bisa menghubungi ElevenLabs: {e}")
    raise RuntimeError("ElevenLabs tidak merespons.")


def _eleven(text: str, path: Path, previous_text=None, next_text=None) -> list:
    key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ELEVENLABS_API_KEY belum diisi.")
    voice = os.getenv("ELEVENLABS_VOICE_ID", "").strip() or DEFAULT_VOICE_ID
    model = os.getenv("ELEVENLABS_MODEL", "").strip() or DEFAULT_MODEL
    fmt = os.getenv("ELEVENLABS_FORMAT", "").strip() or "mp3_44100_128"
    settings = {
        "stability": _float_env("ELEVENLABS_STABILITY", 0.5),
        "similarity_boost": _float_env("ELEVENLABS_SIMILARITY", 0.75),
    }
    speed = _float_env("ELEVENLABS_SPEED", 1.0)
    if abs(speed - 1.0) > 1e-6:
        settings["speed"] = min(max(speed, 0.7), 1.2)

    body = {"text": text, "model_id": model, "voice_settings": settings}
    url = f"{API_BASE}/{voice}/with-timestamps?output_format={fmt}"
    with_context = dict(body)
    if previous_text:
        with_context["previous_text"] = previous_text
    if next_text:
        with_context["next_text"] = next_text   # membantu intonasi antarkalimat agar menyambung
    try:
        resp = _post(url, with_context, key)
    except ElevenLabsError as e:
        if e.code == 422 and with_context != body:
            resp = _post(url, body, key)       # beberapa model menolak previous/next_text
        else:
            raise
    audio = resp.get("audio_base64")
    if not audio:
        raise RuntimeError("ElevenLabs tidak mengembalikan audio.")
    Path(path).write_bytes(base64.b64decode(audio))
    return words_from_alignment(text, resp.get("alignment"))


# ---------------- Edge TTS (cadangan) ----------------
async def _edge_async(text, path, voice, rate):
    import edge_tts

    try:
        comm = edge_tts.Communicate(text, voice, rate=rate, boundary="WordBoundary")
    except TypeError:  # edge-tts versi lama
        comm = edge_tts.Communicate(text, voice, rate=rate)
    marks = []
    with open(path, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                a = chunk["offset"] / 1e7
                marks.append((a, a + chunk["duration"] / 1e7))
    return marks


# ---------------- antarmuka ----------------
def synthesize(text, path, previous_text=None, next_text=None, edge_voice=None, edge_rate=None) -> list:
    """Tulis suara ke `path` (mp3) dan kembalikan waktu tiap kata (bisa kosong)."""
    path = Path(path)
    if provider() == "elevenlabs":
        return _eleven(text, path, previous_text, next_text)
    voice = edge_voice or os.getenv("EDGE_VOICE") or os.getenv("VOICE") or "id-ID-ArdiNeural"
    rate = edge_rate or os.getenv("EDGE_RATE") or os.getenv("RATE") or "+8%"
    return asyncio.run(_edge_async(text, path, voice, rate))
