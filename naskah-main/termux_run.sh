#!/data/data/com.termux/files/usr/bin/bash
# Menjalankan bot Telegram di Termux (mode polling). Jalankan:  bash termux_run.sh
cd "$(dirname "$0")"

if [ ! -f .env ]; then
  echo "File .env belum ada. Salin dulu:  cp env.example .env   lalu isi isinya."
  exit 1
fi
set -a; . ./.env; set +a
export RENDERER=termux
export POLL_TIMEOUT="${POLL_TIMEOUT:-25}"

if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$ALLOWED_CHAT_IDS" ]; then
  echo "TELEGRAM_BOT_TOKEN atau ALLOWED_CHAT_IDS di .env masih kosong."
  exit 1
fi

command -v termux-wake-lock >/dev/null 2>&1 && termux-wake-lock   # cegah HP tidur saat merender

echo "Mematikan webhook Cloudflare (Telegram hanya bisa satu mode: webhook ATAU polling)..."
curl -s "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/deleteWebhook" >/dev/null

echo "Bot berjalan. Kirim naskah ke bot di Telegram. Tekan Ctrl+C untuk berhenti."
while true; do
  if ! python bot.py; then
    sleep 5   # jeda bila error (mis. internet putus)
  fi
  sleep 1
done
