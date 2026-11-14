#!/data/data/com.termux/files/usr/bin/bash
# Pemasangan sekali jalan di Termux. Jalankan:  bash termux_setup.sh
set -e
cd "$(dirname "$0")"

echo "• Memperbarui paket Termux..."
pkg update -y
pkg upgrade -y

echo "• Memasang Python, FFmpeg, Pillow..."
pkg install -y python python-pillow ffmpeg curl unzip clang make openssl libffi
python -m pip install -U pip setuptools wheel

echo "• Memasang requests..."
export ANDROID_API_LEVEL="$(getprop ro.build.version.sdk)"
python -m pip install --extra-index-url https://termux-user-repository.github.io/pypi/ requests

echo "• Memasang edge-tts (opsional, hanya cadangan bila tidak memakai ElevenLabs)..."
if ! python -m pip install --extra-index-url https://termux-user-repository.github.io/pypi/ edge-tts; then
  echo "Cara biasa gagal, mencoba tanpa kompilasi C..."
  AIOHTTP_NO_EXTENSIONS=1 MULTIDICT_NO_EXTENSIONS=1 YARL_NO_EXTENSIONS=1 FROZENLIST_NO_EXTENSIONS=1 \
    python -m pip install --no-cache-dir edge-tts || echo "PERINGATAN: edge-tts gagal dipasang. Tidak masalah jika kamu memakai ElevenLabs (isi ELEVENLABS_API_KEY di .env)."
fi

mkdir -p output cache music
[ -f .env ] || cp env.example .env

echo "• Memeriksa hasil pemasangan..."
python - <<'PY'
import shutil, sys
from pathlib import Path
ok = True
for mod, wajib in (("PIL", True), ("requests", True), ("edge_tts", False)):
    try:
        __import__(mod); print("  OK  ", mod)
    except Exception as e:
        ok = ok and not wajib
        print("  GAGAL" if wajib else "  (opsional, tidak ada)", mod, "->", e)
for exe in ("ffmpeg", "ffprobe"):
    found = shutil.which(exe)
    print("  OK  " if found else "  GAGAL", exe, found or "")
    ok = ok and bool(found)
fonts = ["/system/fonts/Roboto-Bold.ttf", "/system/fonts/RobotoStatic-Bold.ttf", "/system/fonts/NotoSans-Bold.ttf",
         "/system/fonts/DroidSans-Bold.ttf", "/system/fonts/Roboto-Regular.ttf", "/system/fonts/DroidSans.ttf"]
f = next((x for x in fonts if Path(x).exists()), None)
print("  OK   font", f) if f else print("  PERINGATAN: font sistem tidak ditemukan; set FONT_PATH di .env ke file .ttf")
sys.exit(0 if ok else 1)
PY

echo
echo "Selesai. Langkah berikutnya:"
echo "  1) Isi token bot, chat ID, dan ELEVENLABS_API_KEY di file .env   (nano .env)"
echo "  2) Jalankan bot:  bash termux_run.sh"
