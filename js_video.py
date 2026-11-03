"""
Render kode JavaScript (canvas) atau halaman HTML menjadi video MP4 vertikal 1080x1920.

Cara kerja: halaman dijalankan di Chromium tanpa layar (Playwright) dengan WAKTU VIRTUAL.
requestAnimationFrame, setTimeout, setInterval, performance.now() dan Date.now() dikendalikan
per frame (30 fps), jadi animasi selalu mulus walau komputer lambat. Tiap frame di-screenshot,
lalu digabung dengan FFmpeg.

Aturan kode JS (kalau bukan HTML lengkap):
  - Tersedia: canvas (1080x1920), ctx (konteks 2D), W, H. Jangan dideklarasikan ulang.
  - Tulis  function draw(t) { ... }  (t = detik), atau pakai requestAnimationFrame seperti biasa.

Baris pengaturan di awal kode (opsional):
  // durasi: 10                -> panjang video dalam detik (maks 45, bawaan 8)
  // narasi: Teks yang dibaca  -> menambah suara; tanpa 'durasi', video mengikuti panjang suara
"""

import asyncio
import re
import shutil
import subprocess
import sys
from pathlib import Path
from urllib.parse import urlparse

W, H, FPS = 1080, 1920, 30
MAX_SECONDS = 45
DEFAULT_SECONDS = 8
ALLOWED_HOSTS = {
    "cdnjs.cloudflare.com",
    "cdn.jsdelivr.net",
    "fonts.googleapis.com",
    "fonts.gstatic.com",
}
VOICE = "id-ID-ArdiNeural"
RATE = "+8%"

# Dijalankan sebelum skrip halaman: mengganti semua sumber waktu dengan waktu virtual.
VIRTUAL_TIME_JS = r"""
(() => {
  let now = 0, rid = 0, tid = 0;
  const rafs = [], timers = [];
  const safe = (fn, ...a) => { try { fn(...a); } catch (e) { window.__err = window.__err || String(e && e.stack || e); } };
  window.requestAnimationFrame = cb => { rafs.push([++rid, cb]); return rid; };
  window.cancelAnimationFrame = id => { const k = rafs.findIndex(x => x[0] === id); if (k >= 0) rafs.splice(k, 1); };
  window.setTimeout = (cb, d = 0, ...a) => { timers.push({ id: ++tid, t: now + Math.max(+d || 0, 0), cb: () => safe(cb, ...a), iv: null }); return tid; };
  window.setInterval = (cb, d = 0, ...a) => { d = Math.max(+d || 0, 1); timers.push({ id: ++tid, t: now + d, cb: () => safe(cb, ...a), iv: d }); return tid; };
  window.clearTimeout = window.clearInterval = id => { const k = timers.findIndex(x => x.id === id); if (k >= 0) timers.splice(k, 1); };
  performance.now = () => now;
  Date.now = () => 1700000000000 + now;
  window.__step = ms => {
    now = ms;
    for (let guard = 0; guard < 20000; guard++) {
      let due = null;
      for (const x of timers) if (x.t <= now && (!due || x.t < due.t)) due = x;
      if (!due) break;
      due.cb();
      if (due.iv) due.t += due.iv; else timers.splice(timers.indexOf(due), 1);
    }
    const cur = rafs.splice(0);
    for (const [, cb] of cur) safe(cb, now);
  };
})();
"""

STEP_JS = """t => {
  window.__step(t * 1000);
  if (typeof draw === 'function') {
    try { draw(t); } catch (e) { window.__err = window.__err || String(e && e.stack || e); }
  }
  return window.__err || null;
}"""

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#000;overflow:hidden}canvas{display:block}</style></head>
<body><canvas id="canvas" width="%(w)d" height="%(h)d"></canvas>
<script>var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),W=%(w)d,H=%(h)d;</script>
<script>
%(code)s
</script></body></html>"""


# ---------------- util ----------------
def parse_directives(code: str):
    """Ambil // durasi: N dan // narasi: teks dari baris komentar. Mengembalikan (durasi|None, narasi|None)."""
    duration, narration = None, []
    for line in code.splitlines():
        m = re.match(r"^\s*(?://|<!--)\s*(?:durasi|duration)\s*:\s*([0-9]+(?:\.[0-9]+)?)", line, re.I)
        if m and duration is None:
            duration = float(m.group(1))
            continue
        m = re.match(r"^\s*(?://|<!--)\s*(?:narasi|narration|voice)\s*:\s*(.+?)\s*(?:-->)?\s*$", line, re.I)
        if m:
            narration.append(m.group(1))
    return duration, (" ".join(narration) or None)


def build_html(code: str) -> str:
    if re.search(r"<\s*(!doctype|html|body|canvas|div|svg)\b", code[:3000], re.I):
        return code  # sudah HTML lengkap
    return TEMPLATE % {"w": W, "h": H, "code": code.replace("</script", "<\\/script")}


def ffmpeg_bin() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def audio_duration(path: Path) -> float:
    probe = shutil.which("ffprobe")
    if probe:
        out = subprocess.run(
            [probe, "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)],
            capture_output=True, text=True, check=True,
        ).stdout.strip()
        return float(out)
    from moviepy.editor import AudioFileClip
    return AudioFileClip(str(path)).duration


def tts_to_file(text: str, path: Path):
    import edge_tts

    async def run():
        await edge_tts.Communicate(text, VOICE, rate=RATE).save(str(path))

    asyncio.run(run())


def ensure_browser():
    from playwright.sync_api import sync_playwright

    with sync_playwright() as p:
        if Path(p.chromium.executable_path).exists():
            return
    print("• Memasang Chromium (sekali per proses)...")
    subprocess.run([sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"], check=True)


# ---------------- render ----------------
def render_frames(html: str, seconds: float, frames_dir: Path):
    from playwright.sync_api import sync_playwright

    total = int(round(seconds * FPS))
    page_errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(args=["--no-sandbox"])
        ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1)

        page_url = "https://render.local/index.html"

        def guard(route):
            url = route.request.url
            host = urlparse(url).hostname or ""
            if url == page_url:
                route.fulfill(status=200, content_type="text/html; charset=utf-8", body=html)
            elif url.startswith(("data:", "about:", "blob:")) or host in ALLOWED_HOSTS:
                route.continue_()
            else:
                route.abort()  # blokir akses internet selain CDN yang diizinkan

        ctx.route("**/*", guard)
        page = ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.add_init_script(VIRTUAL_TIME_JS)
        page.goto(page_url, wait_until="load")
        page.wait_for_timeout(200)  # beri waktu gambar/font untuk dimuat

        for i in range(total):
            err = page.evaluate(STEP_JS, i / FPS)
            if i == 0 and (err or page_errors):
                raise RuntimeError("Kode JS error: " + (err or page_errors[0]).strip().splitlines()[0][:300])
            page.screenshot(path=str(frames_dir / f"f{i:05d}.jpg"), type="jpeg", quality=92)
        browser.close()


def build_js_video(code: str, out_path: Path, workdir: Path) -> Path:
    """Kode JS/HTML -> MP4. Mengembalikan out_path."""
    workdir.mkdir(parents=True, exist_ok=True)
    duration, narration = parse_directives(code)

    audio, audio_len = None, None
    if narration:
        audio = workdir / "narasi.mp3"
        print("• Membuat suara narasi...")
        tts_to_file(narration, audio)
        audio_len = audio_duration(audio)

    seconds = duration or ((audio_len + 0.6) if audio_len else DEFAULT_SECONDS)
    seconds = max(1.0, min(seconds, MAX_SECONDS))

    ensure_browser()
    frames = workdir / "frames"
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir()

    print(f"• Merekam {int(round(seconds * FPS))} frame ({seconds:.1f} detik)...")
    render_frames(build_html(code), seconds, frames)

    print("• Menggabungkan video...")
    cmd = [ffmpeg_bin(), "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "f%05d.jpg")]
    if audio:
        cmd += ["-i", str(audio)]
    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "20", "-preset", "medium", "-r", str(FPS)]
    if audio:
        cmd += ["-c:a", "aac", "-b:a", "160k", "-af", "apad"]
    cmd += ["-movflags", "+faststart", "-t", f"{seconds:.2f}", str(out_path)]
    subprocess.run(cmd, check=True)
    shutil.rmtree(frames, ignore_errors=True)
    return out_path
