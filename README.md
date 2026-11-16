# Bot Telegram Video Otomatis (Auto-Detect JSON & JS)

Paket bot siap pakai dengan fitur **deteksi otomatis struktur JSON**, sehingga file yang di-share langsung dari File Manager Android tanpa caption tetap diproses sesuai template-nya.

## Fitur Utama
1. **Auto-Detect JSON Tanpa Caption:**
   - Memiliki key `"pembuka"` & `"kartu"` -> otomatis masuk mode **`/t10`**.
   - Memiliki key `"scenes"` -> otomatis masuk mode **`/motion`**.
   - Berupa array `[...]` -> otomatis masuk mode **Reguler** (atau **`/react`** jika diberi key `"mode": "react"`).
   - File `.js` -> otomatis masuk mode **JS Canvas**.
2. **Dukungan Reply Command:**
   - Jika ingin memaksa mode tertentu pada file yang sudah terlanjur terkirim, cukup *reply* pesan file tersebut lalu ketik `/t10`, `/motion`, atau `/react`.

## Cara Menjalankan
1. Install dependensi:
   ```bash
   pip install -r requirements.txt
   ```
2. Isi token bot dari `@BotFather` di environment variable atau langsung di `bot.py`:
   ```bash
   export BOT_TOKEN="123456:ABC-DEF..."
   python3 bot.py
   ```
3. Hubungkan fungsi `render_video_pipeline()` di `bot.py` ke skrip renderer FFmpeg / Remotion Anda.
