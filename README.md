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

## Tampilan video
Pengaturan ada di bagian atas `auto_shorts.py`:
- `SUB_STYLE`: `"karaoke"` (kata menyala satu per satu) atau `"plain"`.
- `WORDS_PER_CHUNK`, `COLOR_ACTIVE`, `FONT_SIZE`, `SUB_Y`: ukuran dan warna subtitle.
- `POP_EFFECT`: efek teks membal saat potongan kata baru muncul.
- `MUSIC`, `MUSIC_VOLUME`: musik latar. Taruh .mp3/.wav bebas hak cipta di folder `music/`;
  jika kosong, bot membuat musik ambient otomatis.

## Video dari kode JavaScript
Kirim ke bot `/js` diikuti kode, atau kirim file `.js` / `.html` (untuk kode panjang, batas pesan Telegram 4096 karakter).
- Tersedia `canvas`, `ctx`, `W`, `H` (1080x1920). Tulis `function draw(t) { ... }` (t = detik) atau pakai `requestAnimationFrame` biasa.
- Baris pengaturan di awal kode: `// durasi: 10` (maks 45 detik) dan `// narasi: teks yang dibacakan` (opsional).
  Pada file HTML tulis `<!-- durasi: 10 -->` di awal baris.
- Kode dijalankan di Chromium tanpa layar dengan waktu virtual, jadi animasi selalu mulus (30 fps).
- Akses internet diblokir kecuali CDN cdnjs, jsDelivr, dan Google Fonts. Hanya chat di `ALLOWED_CHAT_IDS` yang bisa menjalankan kode.
- Contoh: `contoh/contoh_animasi.js`. Chromium dipasang otomatis saat permintaan JS pertama dalam satu proses (±1-2 menit).

## Mode /react: naskah → video animasi React (sinkron dengan suara)
Kirim `/react` diikuti naskah (format `judul:` lalu isi), atau kirim file `.json` dengan keterangan (caption) `/react`.
- Suara + waktu tiap kata dari Edge TTS; halaman React (tanpa JSX, dari cdnjs) menampilkan judul, kartu kata yang
  menyala sesuai ucapan, latar bergerak, dan bilah progres. Musik latar ikut dipakai (lihat `MUSIC` di `auto_shorts.py`).
- Maksimal 3 naskah per pesan (tiap video ±3-6 menit). `keyword` tidak dipakai di mode ini.
- Teks kecil di atas judul ("FAKTA UNIK") diubah lewat `LABEL` di `react_video.py`, atau lewat kolom `"label"` pada item JSON.
- Warna tema dipilih otomatis dari judul (5 palet di `PALETTES`).

## Render di Termux (Android), tanpa GitHub Actions
Memakai `termux_render.py` (hanya FFmpeg + Pillow + edge-tts; tanpa moviepy/numpy/Chromium).
1. Pasang Termux dari **F-Droid** (versi Play Store sudah usang).
2. `termux-setup-storage`, lalu salin zip ke Termux dan ekstrak: `cp ~/storage/downloads/telegram-shorts-bot.zip ~ && unzip -o telegram-shorts-bot.zip -d shorts && cd shorts`
3. `bash termux_setup.sh` (memasang paket), lalu isi token dan chat ID di `.env` (`nano .env`).
4. `bash termux_run.sh` menjalankan bot (mode polling). Atau tanpa Telegram: `python termux_render.py scripts.json`.
- Hasil ada di folder `output/`. Salin ke galeri: `cp output/*.mp4 ~/storage/movies/`.
- Telegram hanya mendukung satu mode: webhook (Cloudflare) ATAU polling (Termux). `termux_run.sh` mematikan webhook;
  untuk kembali ke GitHub, pasang lagi webhook lewat `setWebhook`.
- Mode `/js` dan `/react` butuh Chromium sehingga belum tersedia di Termux (tetap jalan di GitHub Actions).
- Pengaturan lewat `.env`: `VOICE`, `RATE`, `MUSIC`, `MUSIC_VOLUME`, `FONT_PATH`, `PEXELS_API_KEY`, `PIXABAY_API_KEY`.
