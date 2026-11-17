import asyncio
import json
import os
import re
import subprocess
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

try:
    import edge_tts
except ImportError:
    edge_tts = None


# Status fallback per sesi render agar tidak mengulang request ke ElevenLabs
# jika kuota sudah terdeteksi habis (401/402/429) dalam satu video.
_ELEVENLABS_DISABLED_SESSION = False
_LAST_PROVIDER_USED = "edge"
_FALLBACK_REASON = ""


def reset_tts_session():
    """Panggil di awal render video baru jika ingin mencoba ElevenLabs lagi."""
    global _ELEVENLABS_DISABLED_SESSION, _FALLBACK_REASON
    _ELEVENLABS_DISABLED_SESSION = False
    _FALLBACK_REASON = ""


def get_tts_status() -> dict:
    """Mengembalikan info provider terakhir yang dipakai (untuk log/caption Telegram)."""
    return {
        "provider": _LAST_PROVIDER_USED,
        "fallback_active": _ELEVENLABS_DISABLED_SESSION,
        "reason": _FALLBACK_REASON,
    }


def _get_audio_duration(audio_path: str) -> float:
    """Mengukur durasi audio (detik) secara akurat memakai ffprobe."""
    try:
        cmd = [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(audio_path),
        ]
        out = subprocess.check_output(cmd, stderr=subprocess.DEVNULL).decode().strip()
        dur = float(out)
        if dur > 0:
            return dur
    except Exception:
        pass

    try:
        size_bytes = os.path.getsize(audio_path)
        return max(0.5, size_bytes / 16000.0)
    except Exception:
        return 1.0


def _build_mark(word: str, start_sec: float, end_sec: float) -> dict:
    """Membuat dict timestamp kata yang kompatibel dengan semua parser subtitle."""
    dur_sec = max(0.01, end_sec - start_sec)
    return {
        "word": word,
        "text": word,
        "start": round(start_sec, 3),
        "end": round(end_sec, 3),
        "offset": int(round(start_sec * 10_000_000)),
        "duration": int(round(dur_sec * 10_000_000)),
    }


def _proportional_marks(text: str, total_duration: float) -> list[dict]:
    """Menghitung timestamp per kata secara proporsional untuk subtitle karaoke."""
    words = [w for w in re.split(r"\s+", text.strip()) if w]
    if not words:
        return []

    weights = [max(1, len(re.sub(r"[^\w]", "", w))) for w in words]
    total_weight = sum(weights) or len(words)

    marks = []
    cursor = 0.0
    for w, weight in zip(words, weights):
        seg_dur = (weight / total_weight) * total_duration
        marks.append(_build_mark(w, cursor, cursor + seg_dur))
        cursor += seg_dur

    if marks:
        marks[-1]["end"] = round(total_duration, 3)
    return marks


def _elevenlabs_tts(
    text: str,
    out_path: str,
    voice_id: str | None = None,
    model_id: str | None = None,
) -> tuple[str, list[dict]]:
    """Sintesis suara memakai ElevenLabs REST API."""
    api_key = os.getenv("ELEVENLABS_API_KEY", "").strip()
    if not api_key:
        raise RuntimeError("ELEVENLABS_API_KEY kosong atau belum diatur.")

    vid = (
        voice_id
        or os.getenv("ELEVENLABS_VOICE_ID", "").strip()
        or "pNInz6obpgDQGcFmaJgB"  # Adam (pre-made voice aman untuk akun gratis)
    )
    mid = (
        model_id
        or os.getenv("ELEVENLABS_MODEL_ID", "").strip()
        or "eleven_multilingual_v2"
    )

    url = f"https://api.elevenlabs.io/v1/text-to-speech/{vid}"
    payload = json.dumps(
        {
            "text": text,
            "model_id": mid,
            "voice_settings": {
                "stability": 0.5,
                "similarity_boost": 0.75,
            },
        }
    ).encode("utf-8")

    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "xi-api-key": api_key,
            "Content-Type": "application/json",
            "Accept": "audio/mpeg",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            audio_bytes = resp.read()
    except urllib.error.HTTPError as e:
        err_body = ""
        try:
            err_body = e.read().decode("utf-8", errors="ignore")
        except Exception:
            pass
        raise RuntimeError(f"ElevenLabs error {e.code}: {err_body}") from e
    except Exception as e:
        raise RuntimeError(f"ElevenLabs connection error: {e}") from e

    if not audio_bytes or len(audio_bytes) < 256:
        raise RuntimeError("ElevenLabs mengembalikan file audio kosong.")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    with open(out_path, "wb") as f:
        f.write(audio_bytes)

    duration = _get_audio_duration(out_path)
    marks = _proportional_marks(text, duration)
    return str(out_path), marks


async def _edge_tts_async(
    text: str,
    out_path: str,
    voice: str,
    rate: str,
    pitch: str = "+0Hz",
) -> list[dict]:
    if edge_tts is None:
        raise RuntimeError("Pustaka edge-tts belum terinstal (pip install edge-tts).")

    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate, pitch=pitch)

    marks = []
    audio_chunks = bytearray()

    async for chunk in communicate.stream():
        ctype = chunk.get("type")
        if ctype == "audio":
            audio_chunks.extend(chunk["data"])
        elif ctype == "WordBoundary":
            offset_sec = chunk["offset"] / 10_000_000.0
            dur_sec = chunk["duration"] / 10_000_000.0
            marks.append(_build_mark(chunk["text"], offset_sec, offset_sec + dur_sec))

    with open(out_path, "wb") as f:
        f.write(audio_chunks)

    return marks


def _edge_tts(
    text: str,
    out_path: str,
    voice: str | None = None,
    rate: str | None = None,
    pitch: str = "+0Hz",
) -> tuple[str, list[dict]]:
    """Sintesis suara memakai Microsoft Edge TTS (gratis, tanpa batas kuota)."""
    selected_voice = (
        voice
        or os.getenv("EDGE_VOICE", "").strip()
        or os.getenv("VOICE", "").strip()
        or "id-ID-ArdiNeural"
    )
    if not re.match(r"^[a-z]{2}-[A-Z]{2}-", selected_voice):
        selected_voice = "id-ID-ArdiNeural"

    selected_rate = (
        rate
        or os.getenv("EDGE_RATE", "").strip()
        or os.getenv("RATE", "").strip()
        or "+0%"
    )

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures

        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as pool:
            marks = pool.submit(
                asyncio.run,
                _edge_tts_async(text, out_path, selected_voice, selected_rate, pitch),
            ).result()
    else:
        marks = asyncio.run(
            _edge_tts_async(text, out_path, selected_voice, selected_rate, pitch)
        )

    duration = _get_audio_duration(out_path)
    if not marks:
        marks = _proportional_marks(text, duration)

    return str(out_path), marks


def synthesize(
    text: str,
    out_path: str | Path | None = None,
    voice: str | None = None,
    rate: str | None = None,
    provider: str | None = None,
    pitch: str = "+0Hz",
    **kwargs,
) -> tuple[str, list[dict]]:
    """
    Fungsi utama TTS (dipanggil oleh js_video.py, auto_shorts.py, react_video.py, t10_video.py)
    dengan AUTO-FALLBACK otomatis dari ElevenLabs ke Edge TTS saat error 401/402/429.
    """
    global _ELEVENLABS_DISABLED_SESSION, _LAST_PROVIDER_USED, _FALLBACK_REASON

    clean_text = (text or "").strip()
    if not clean_text:
        raise ValueError("Teks narasi kosong.")

    target_path = (
        out_path
        or kwargs.get("output_path")
        or kwargs.get("out_file")
        or kwargs.get("path")
    )
    if target_path is None:
        fd, tmp_name = tempfile.mkstemp(suffix=".mp3", prefix="tts_")
        os.close(fd)
        target_path = tmp_name
    target_path = str(target_path)

    chosen = (
        provider
        or os.getenv("TTS_PROVIDER", "elevenlabs")
    ).strip().lower()

    use_eleven = chosen in ("elevenlabs", "eleven", "11labs")

    if use_eleven and not _ELEVENLABS_DISABLED_SESSION:
        try:
            audio_file, marks = _elevenlabs_tts(
                text=clean_text,
                out_path=target_path,
                voice_id=voice,
            )
            _LAST_PROVIDER_USED = "elevenlabs"
            return audio_file, marks
        except Exception as err:
            err_msg = str(err)
            print(f"[TTS AUTO-FALLBACK] ElevenLabs gagal ({err_msg}) -> Beralih ke Edge TTS...")
            if any(code in err_msg for code in ("401", "402", "429", "quota", "API_KEY")):
                _ELEVENLABS_DISABLED_SESSION = True
                _FALLBACK_REASON = err_msg

    audio_file, marks = _edge_tts(
        text=clean_text,
        out_path=target_path,
        voice=voice,
        rate=rate,
        pitch=pitch,
    )
    _LAST_PROVIDER_USED = "edge"
    return audio_file, marks


# Alias agar kompatibel dengan semua pemanggilan lama maupun baru
make_voice = synthesize


def synthesize_many(
    items: list,
    out_dir: str | Path,
    prefix: str = "seg",
    voice: str | None = None,
    rate: str | None = None,
    provider: str | None = None,
) -> list[dict]:
    """Memproses banyak segmen narasi sekaligus dengan auto-fallback."""
    reset_tts_session()
    out_dir_path = Path(out_dir)
    out_dir_path.mkdir(parents=True, exist_ok=True)
    results = []

    for idx, item in enumerate(items, start=1):
        if isinstance(item, dict):
            text = item.get("text") or item.get("narasi") or item.get("teks") or ""
            item_voice = item.get("voice") or voice
            item_rate = item.get("rate") or rate
        else:
            text = str(item)
            item_voice = voice
            item_rate = rate

        out_file = str(out_dir_path / f"{prefix}_{idx:02d}.mp3")
        audio_path, marks = synthesize(
            text=text,
            out_path=out_file,
            voice=item_voice,
            rate=item_rate,
            provider=provider,
        )
        duration = _get_audio_duration(audio_path)
        results.append(
            {
                "index": idx,
                "text": text,
                "audio_path": audio_path,
                "duration": duration,
                "marks": marks,
                "provider": _LAST_PROVIDER_USED,
            }
        )

    return results
