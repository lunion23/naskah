import os
import json
import asyncio
import logging
from telegram import Update
from telegram.ext import (
    ApplicationBuilder,
    CommandHandler,
    MessageHandler,
    ContextTypes,
    filters,
)

logging.basicConfig(
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

BOT_TOKEN = os.getenv("BOT_TOKEN", "ISI_TOKEN_BOT_TELEGRAM_DISINI")
WORK_DIR = "workspace"
os.makedirs(WORK_DIR, exist_ok=True)


def detect_json_mode(file_path: str, caption: str = "") -> str:
    """
    Mendeteksi mode render secara otomatis dari caption atau struktur file JSON.
    Mendukung upload langsung dari file manager tanpa caption.
    """
    cap = (caption or "").strip().lower()
    if "/t10" in cap:
        return "t10"
    if "/motion" in cap:
        return "motion"
    if "/react" in cap:
        return "react"

    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            if "pembuka" in data and "kartu" in data:
                return "t10"
            if "scenes" in data:
                return "motion"
            if data.get("mode") == "react":
                return "react"
        elif isinstance(data, list):
            if len(data) > 0 and isinstance(data[0], dict) and data[0].get("mode") == "react":
                return "react"
            return "reguler"
    except Exception as e:
        logger.warning(f"Gagal membaca struktur JSON {file_path}: {e}")

    return "reguler"


async def render_video_pipeline(mode: str, input_path: str, output_mp4: str, output_srt: str):
    """
    Placeholder pemanggilan renderer video Anda (Remotion / Puppeteer / FFmpeg / edge-tts).
    Sesuaikan pemanggilan subprocess ini dengan skrip render lokal/cloud Anda.
    """
    logger.info(f"Memulai proses render | Mode: {mode} | Input: {input_path}")
    # Contoh pemanggilan ke skrip renderer existing Anda:
    # proc = await asyncio.create_subprocess_exec(
    #     "python3", "renderer.py", "--mode", mode, "--input", input_path, "--out", output_mp4
    # )
    # await proc.communicate()
    await asyncio.sleep(1)


async def process_uploaded_file(
    update: Update,
    context: ContextTypes.DEFAULT_TYPE,
    doc,
    override_caption: str = "",
):
    chat_id = update.effective_chat.id
    file_name = doc.file_name or "input_file"
    ext = os.path.splitext(file_name)[1].lower()

    if ext not in (".json", ".js"):
        await update.message.reply_text(
            "⚠️ Format file tidak didukung. Kirim file berekstensi `.json` atau `.js`."
        )
        return

    local_input = os.path.join(WORK_DIR, f"{chat_id}_{file_name}")
    tg_file = await doc.get_file()
    await tg_file.download_to_drive(local_input)

    if ext == ".js":
        mode = "js_canvas"
    else:
        mode = detect_json_mode(local_input, override_caption)

    status_msg = await update.message.reply_text(
        f"📥 File diterima: `{file_name}`\n"
        f"⚙️ Mode terdeteksi otomatis: **{mode.upper()}**\n"
        f"⏳ Sedang memproses narasi & merender video...",
        parse_mode="Markdown",
    )

    base_name = os.path.splitext(file_name)[0]
    output_mp4 = os.path.join(WORK_DIR, f"{chat_id}_{base_name}.mp4")
    output_srt = os.path.join(WORK_DIR, f"{chat_id}_{base_name}.srt")

    try:
        await render_video_pipeline(mode, local_input, output_mp4, output_srt)

        if os.path.exists(output_mp4):
            with open(output_mp4, "rb") as vf:
                await update.message.reply_video(
                    video=vf,
                    caption=f"✅ Selesai render ({mode.upper()}) — `{base_name}.mp4`",
                    parse_mode="Markdown",
                )
            if os.path.exists(output_srt):
                with open(output_srt, "rb") as sf:
                    await update.message.reply_document(document=sf)
            await status_msg.delete()
        else:
            await status_msg.edit_text(
                f"✅ Deteksi mode **{mode.upper()}** berhasil untuk `{file_name}`.\n"
                f"ℹ️ Hubungkan fungsi `render_video_pipeline()` di `bot.py` ke skrip renderer Anda untuk menghasilkan file `.mp4`.",
                parse_mode="Markdown",
            )
    except Exception as exc:
        logger.exception("Error saat render")
        await status_msg.edit_text(f"❌ Terjadi kesalahan saat render: `{exc}`", parse_mode="Markdown")


async def start_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    await update.message.reply_text(
        "🤖 **Bot Video Otomatis Siap!**\n\n"
        "• Kirim file `.json` langsung (tanpa caption pun otomatis terdeteksi: `/t10`, `/motion`, atau reguler).\n"
        "• Kirim file `.js` animasi Canvas untuk langsung dirender.\n"
        "• Bisa juga *reply* file yang sudah terkirim dengan `/t10`, `/motion`, atau `/react` untuk memaksa mode tertentu.",
        parse_mode="Markdown",
    )


async def mode_reply_cmd(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler saat user me-reply dokumen dengan /t10, /motion, atau /react."""
    reply_msg = update.message.reply_to_message
    if not reply_msg or not reply_msg.document:
        await update.message.reply_text(
            "ℹ️ Balas (reply) ke pesan file `.json` dengan perintah `/t10`, `/motion`, atau `/react`."
        )
        return

    cmd_text = update.message.text or ""
    await process_uploaded_file(update, context, reply_msg.document, override_caption=cmd_text)


async def document_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    doc = update.message.document
    caption = update.message.caption or ""
    await process_uploaded_file(update, context, doc, override_caption=caption)


def main():
    app = ApplicationBuilder().token(BOT_TOKEN).build()
    app.add_handler(CommandHandler("start", start_cmd))
    app.add_handler(CommandHandler(["t10", "motion", "react"], mode_reply_cmd))
    app.add_handler(MessageHandler(filters.Document.ALL, document_handler))

    logger.info("Bot Telegram berjalan...")
    app.run_polling()


if __name__ == "__main__":
    main()
