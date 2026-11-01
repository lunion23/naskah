# Telegram → GitHub → YouTube Shorts

Kirim naskah ke bot Telegram, GitHub Actions membuat video Shorts (9:16, suara Indonesia, subtitle),
lalu mengirim file MP4 kembali ke chat Telegram kamu.

## Struktur
```
auto_shorts.py                 # mesin pembuat video
bot.py                         # penghubung Telegram
requirements.txt
.github/workflows/shorts.yml   # jadwal & pengaturan GitHub Actions
```

## Setup (sekali saja)

1. **Buat bot**: di Telegram buka @BotFather, kirim `/newbot`, simpan token yang diberikan.
2. **Pexels API key** (gratis): https://www.pexels.com/api/
3. **Buat repo GitHub** (disarankan *public*, lihat catatan biaya), upload semua file proyek ini.
   Pastikan folder `.github/workflows/` ikut terunggah.
4. **Isi Secrets**: Repo → Settings → Secrets and variables → Actions → New repository secret:
   | Nama | Isi |
   |---|---|
   | `TELEGRAM_BOT_TOKEN` | token dari BotFather |
   | `PEXELS_API_KEY` | key dari Pexels |
   | `ALLOWED_CHAT_IDS` | chat ID kamu (beberapa ID dipisah koma) |
5. **Cari chat ID**: kirim pesan apa saja ke botmu. Bot akan membalas "Akses ditolak. Chat ID kamu: 123456789"
   (setelah workflow berjalan pertama kali). Masukkan angka itu ke `ALLOWED_CHAT_IDS`.
   Untuk mempercepat: tab Actions → *Telegram Shorts Bot* → *Run workflow*.
6. Aktifkan workflow di tab **Actions** jika diminta.

## Cara pakai

Kirim ke bot:
```
judul: Madu Tidak Pernah Basi
keyword: honey
Tahukah kamu, ada satu makanan yang hampir tidak pernah basi? Madu. Para arkeolog pernah menemukan madu di makam Mesir kuno yang masih aman dimakan. Follow untuk fakta unik lainnya!
```
Atau kirim file `scripts.json` (banyak naskah sekaligus, maks 10 per pesan):
```json
[
  {"title": "Madu Tidak Pernah Basi", "keyword": "honey", "text": "..."},
  {"title": "Gurita Punya Tiga Jantung", "keyword": "octopus", "text": "..."}
]
```
Video jadi dikirim balik ke chat, biasanya 5–15 menit setelah naskah dikirim.

## Catatan penting

- **Jeda respons**: GitHub menjalankan jadwal tiap ±5 menit dan sering terlambat. Bot tidak instan.
  Untuk respons instan, ganti polling dengan webhook (Cloudflare Worker + `repository_dispatch`).
- **Biaya**: repo public gratis tanpa batas menit. Repo private hanya dapat 2.000 menit/bulan,
  dan polling tiap 5 menit akan melebihinya. Untuk repo private, ubah cron jadi `*/15` atau lebih jarang.
- **Nonaktif otomatis**: GitHub mematikan jadwal pada repo yang tidak ada aktivitas selama 60 hari.
  Jalankan manual atau buat commit kecil untuk mengaktifkannya lagi.
- **Edge TTS** kadang menolak IP tertentu. Jika suara gagal dibuat, jalankan ulang; jika terus gagal,
  ganti ke TTS lain (mis. Google Cloud TTS atau ElevenLabs) di fungsi `_tts` pada `auto_shorts.py`.
- **Batas Telegram**: video yang dikirim bot maksimal 50 MB (Shorts 30–50 detik jauh di bawahnya).
- Naskah tidak disimpan di repo, hanya diproses lalu dihapus bersama runner.
