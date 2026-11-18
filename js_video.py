"""
Render kode JavaScript (canvas) atau halaman HTML menjadi video MP4 vertikal 1080x1920.

Cara kerja: halaman dijalankan di Chromium tanpa layar (Playwright) dengan WAKTU VIRTUAL.
requestAnimationFrame, setTimeout, setInterval, performance.now() dan Date.now() dikendalikan
per frame (30 fps), jadi animasi selalu mulus walau komputer lambat. Tiap frame di-screenshot,
lalu digabung dengan FFmpeg.

Mendukung dua mode:
  1. build_js_video(code, out_path, workdir) -> video tunggal dari kode JS/HTML
  2. build_motion_video(scenes, render_code, out_path, workdir, title, bgm_path) -> video infografis multi-adegan
"""

import json
import math
import random
import re
import shutil
import struct
import subprocess
import sys
import wave
from pathlib import Path
from urllib.parse import urlparse

W, H, FPS = 1080, 1920, 30
MAX_SECONDS = 300
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
  if (typeof window.__updateSubtitle === 'function') {
    window.__updateSubtitle(t);
  }
  if (typeof draw === 'function') {
    try { draw(t); } catch (e) { window.__err = window.__err || String(e && e.stack || e); }
  }
  return window.__err || null;
}"""

TEMPLATE = """<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@700;800;900&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;background:#060d1f;overflow:hidden;font-family:'Montserrat',sans-serif}
  canvas{display:block}
  #sub-box{
    position:fixed;left:56px;right:56px;bottom:230px;text-align:center;
    font-size:48px;font-weight:900;line-height:1.35;text-transform:uppercase;
    color:#ffffff;letter-spacing:0.6px;pointer-events:none;z-index:20;
    display:none;justify-content:center;align-items:center;
  }
  #sub-pill{
    display:inline-block;max-width:96%;
    background:rgba(6, 13, 31, 0.78);
    border:3px solid rgba(255, 214, 0, 0.45);
    border-radius:22px;
    padding:14px 28px;
    box-shadow:0 10px 30px rgba(0,0,0,0.65);
    text-shadow:0 3px 0 #000,-2px -2px 0 #000,2px -2px 0 #000,-2px 2px 0 #000,2px 2px 0 #000;
  }
  #sub-box .word{display:inline-block;margin:0 10px;transition:transform 0.08s ease-out}
  #sub-box .active{color:#FFD600;transform:scale(1.08)}
</style></head>
<body>
<canvas id="canvas" width="%(w)d" height="%(h)d"></canvas>
<div id="sub-box"><div id="sub-pill"></div></div>
<script>
  var canvas=document.getElementById('canvas'),ctx=canvas.getContext('2d'),W=%(w)d,H=%(h)d;
  window.SCENES = %(scenes_json)s;
  window.SUBTITLES = %(subtitles_json)s;

  window.easeOutCubic = x => 1 - Math.pow(1 - Math.min(Math.max(x, 0), 1), 3);
  window.easeOutBack = x => {
    const t = Math.min(Math.max(x, 0), 1) - 1;
    const c1 = 1.70158, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t, 3) + c1 * Math.pow(t, 2);
  };
  window.getActiveScene = t => {
    for (let i = 0; i < window.SCENES.length; i++) {
      const s = window.SCENES[i];
      if (t >= s.start && t < s.end) {
        const dur = Math.max(s.end - s.start, 0.001);
        return { index: i, scene: s, localT: t - s.start, progress: (t - s.start) / dur };
      }
    }
    const last = window.SCENES[window.SCENES.length - 1] || null;
    return last ? { index: window.SCENES.length - 1, scene: last, localT: last.end - last.start, progress: 1 } : null;
  };

  function escHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  window.__updateSubtitle = t => {
    const box = document.getElementById('sub-box');
    const pill = document.getElementById('sub-pill');
    if (!box || !pill || !window.SUBTITLES.length) return;
    const cur = window.SUBTITLES.find(s => t >= s.start && t < s.end);
    if (!cur || !cur.words.length) { box.style.display = 'none'; pill.innerHTML = ''; return; }
    box.style.display = 'flex';
    const chunkSize = 3;
    let activeIdx = cur.words.findIndex(w => t >= w.start && t <= w.end);
    if (activeIdx < 0) {
      // Pilih kata terakhir yang sudah mulai diucapkan agar tidak lompat ke 0 saat jeda napas
      for (let i = cur.words.length - 1; i >= 0; i--) {
        if (t >= cur.words[i].start) { activeIdx = i; break; }
      }
      if (activeIdx < 0) activeIdx = 0;
    }
    const chunkStart = Math.floor(activeIdx / chunkSize) * chunkSize;
    const slice = cur.words.slice(chunkStart, chunkStart + chunkSize);
    pill.innerHTML = slice.map((w, idx) => {
      const isAct = (chunkStart + idx) === activeIdx;
      const txt = escHtml(w.text);
      return '<span class="word' + (isAct ? ' active' : '') + '">' + txt + '</span>';
    }).join(' ');
  };
</script>
<script>
%(code)s
</script></body></html>"""


# ---------------- util ----------------
def parse_directives(code: str):
    """Ambil // durasi: N dan // narasi: teks dari baris komentar."""
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


def build_html(code: str, scenes=None, subtitles=None) -> str:
    if re.search(r"<\s*(!doctype|html|body|canvas|div|svg)\b", code[:3000], re.I):
        return code
    html = (
        TEMPLATE
        .replace("%(w)d", str(W))
        .replace("%(h)d", str(H))
        .replace("%(scenes_json)s", json.dumps(scenes or [], ensure_ascii=False))
        .replace("%(subtitles_json)s", json.dumps(subtitles or [], ensure_ascii=False))
    )
    return html.replace("%(code)s", code.replace("</script", "<\\/script"), 1)


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


def tts_to_file(text: str, path: Path) -> list:
    """Narasi lewat tts_provider (ElevenLabs atau Edge TTS). Mengembalikan word marks."""
    import tts_provider
    marks_list = tts_provider.synthesize_many([text], [path], edge_voice=VOICE, edge_rate=RATE)
    return marks_list[0] if marks_list else []


def ensure_browser():
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        if Path(p.chromium.executable_path).exists():
            return
    print("• Memasang Chromium (sekali per proses)...")
    subprocess.run([sys.executable, "-m", "playwright", "install", "--with-deps", "chromium"], check=True)


def _build_word_timings(text: str, start: float, end: float, marks=None) -> list:
    """Bangun timestamp per kata untuk efek karaoke kuning."""
    words = [w for w in text.strip().split() if w]
    if not words:
        return []
    dur = max(end - start, 0.1)
    if marks and len(marks) == len(words):
        out = []
        for w, (ma, mb) in zip(words, marks):
            wa = start + float(ma)
            wb = start + max(float(mb), float(ma) + 0.05)
            out.append({"text": w, "start": round(wa, 3), "end": round(wb, 3)})
        return out

    total_chars = sum(max(len(w), 2) for w in words)
    cursor = start
    out = []
    for w in words:
        w_dur = dur * (max(len(w), 2) / total_chars)
        out.append({"text": w, "start": round(cursor, 3), "end": round(cursor + w_dur, 3)})
        cursor += w_dur
    return out


def _concat_audios(audio_paths: list[Path], out_audio: Path):
    """Gabungkan klip suara tiap scene menjadi satu trek narasi."""
    list_file = out_audio.parent / "concat_list.txt"
    lines = [f"file '{p.resolve().as_posix()}'" for p in audio_paths]
    list_file.write_text("\n".join(lines), encoding="utf-8")
    subprocess.run(
        [ffmpeg_bin(), "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(list_file), "-c", "copy", str(out_audio)],
        check=True,
    )


def _generate_ambient_wav(path: Path, duration: float = 16.0, sr: int = 22050) -> Path:
    """Buat musik latar explainer berirama lembut (Am - F - C - G + arpeggio marimba) jika folder music/ kosong."""
    chords = [
        (110.00, 130.81, 164.81, 220.00),  # Am
        (87.31, 110.00, 130.81, 174.61),   # F
        (130.81, 164.81, 196.00, 261.63),  # C
        (98.00, 123.47, 146.83, 196.00),   # G
    ]
    seg = duration / 4.0
    step_dur = 0.25  # 120 BPM eighth-note pulse
    total_samples = int(duration * sr)
    frames = bytearray()
    for i in range(total_samples):
        t = i / sr
        c_idx = min(int(t // seg), 3)
        chord = chords[c_idx]
        local_t = t - c_idx * seg
        pad_env = math.sin(math.pi * min(max(local_t / seg, 0.0), 1.0)) ** 0.45

        # Soft warm pad
        pad = 0.0
        for f in chord[:3]:
            pad += math.sin(2.0 * math.pi * f * t)
        pad = (pad / 3.2) * pad_env * 0.42

        # Gentle rhythmic marimba pluck
        step_idx = int(t // step_dur)
        step_t = t - step_idx * step_dur
        pluck_env = math.exp(-step_t * 11.0)
        note_f = chord[step_idx % len(chord)] * 2.0
        pluck = (math.sin(2.0 * math.pi * note_f * t) + 0.25 * math.sin(4.0 * math.pi * note_f * t)) * pluck_env * 0.35

        # Subtle warm bass pulse every 1.0s
        beat_t = t % 1.0
        bass_env = math.exp(-beat_t * 4.5)
        bass = math.sin(2.0 * math.pi * (chord[0] * 0.5) * t) * bass_env * 0.32

        sample = int(max(-1.0, min(1.0, pad + pluck + bass)) * 32767)
        frames.extend(struct.pack("<hh", sample, sample))
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(bytes(frames))
    return path


def _pick_or_make_bgm(workdir: Path, bgm_path: Path = None) -> Path:
    if bgm_path and Path(bgm_path).exists():
        return Path(bgm_path)
    music_dir = Path("music")
    if music_dir.exists():
        files = []
        for ext in ("*.mp3", "*.wav", "*.m4a", "*.ogg"):
            files.extend(music_dir.glob(ext))
        if files:
            return random.choice(files)
    return _generate_ambient_wav(workdir / "ambient_bgm.wav")


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
                route.abort()

        ctx.route("**/*", guard)
        page = ctx.new_page()
        page.on("pageerror", lambda e: page_errors.append(str(e)))
        page.add_init_script(VIRTUAL_TIME_JS)
        page.goto(page_url, wait_until="load")
        page.evaluate("() => document.fonts ? document.fonts.ready : Promise.resolve()")
        page.wait_for_timeout(150)

        for i in range(total):
            err = page.evaluate(STEP_JS, i / FPS)
            if i == 0 and (err or page_errors):
                raise RuntimeError("Kode JS error: " + (err or page_errors[0]).strip().splitlines()[0][:300])
            page.screenshot(path=str(frames_dir / f"f{i:05d}.jpg"), type="jpeg", quality=90)
        browser.close()


def _generate_scene_sfx_wav(path: Path, timed_scenes: list[dict], total_seconds: float, sr: int = 22050) -> Path:
    """Buat trek efek suara transisi (whoosh halus + pop/chime) tepat di awal setiap adegan."""
    total_samples = int(total_seconds * sr)
    buf = [0.0] * total_samples
    rng = random.Random(42)

    for idx, sc in enumerate(timed_scenes):
        st = float(sc.get("start", 0.0))
        start_i = int(st * sr)
        # 1) Soft whoosh (0.28s) pada perpindahan adegan
        if idx > 0:
            w_len = int(0.28 * sr)
            for k in range(w_len):
                pos = start_i + k
                if pos >= total_samples:
                    break
                u = k / w_len
                env = math.sin(math.pi * u) ** 1.4
                noise = rng.uniform(-1.0, 1.0)
                sweep = math.sin(2.0 * math.pi * (180.0 + 420.0 * u) * (k / sr))
                buf[pos] += (noise * 0.16 + sweep * 0.12) * env

        # 2) Crisp pop / chime (0.22s) saat elemen visual muncul
        p_len = int(0.22 * sr)
        base_f = 587.33 if idx == 0 else (783.99 if idx == len(timed_scenes) - 1 else 659.25)
        for k in range(p_len):
            pos = start_i + int(0.05 * sr) + k
            if pos >= total_samples:
                break
            kt = k / sr
            env = math.exp(-kt * 18.0)
            tone = math.sin(2.0 * math.pi * base_f * kt) + 0.35 * math.sin(2.0 * math.pi * base_f * 1.5 * kt)
            buf[pos] += tone * env * 0.24

    frames = bytearray()
    for v in buf:
        s = int(max(-1.0, min(1.0, v)) * 32767)
        frames.extend(struct.pack("<hh", s, s))
    with wave.open(str(path), "wb") as wf:
        wf.setnchannels(2)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        wf.writeframes(bytes(frames))
    return path


def encode_video(frames: Path, audio, seconds: float, out_path: Path, bgm_path: Path = None, sfx_path: Path = None):
    """Gabungkan frame JPG, suara narasi, backsound, dan SFX transisi menjadi MP4."""
    cmd = [ffmpeg_bin(), "-y", "-loglevel", "error", "-framerate", str(FPS), "-i", str(frames / "f%05d.jpg")]
    has_audio = bool(audio)
    has_bgm = bool(bgm_path and Path(bgm_path).exists())
    has_sfx = bool(sfx_path and Path(sfx_path).exists())

    in_idx = 1
    audio_idx = bgm_idx = sfx_idx = None
    if has_audio:
        cmd += ["-i", str(audio)]
        audio_idx = in_idx
        in_idx += 1
    if has_bgm:
        cmd += ["-stream_loop", "-1", "-i", str(bgm_path)]
        bgm_idx = in_idx
        in_idx += 1
    if has_sfx:
        cmd += ["-i", str(sfx_path)]
        sfx_idx = in_idx
        in_idx += 1

    cmd += ["-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "21", "-preset", "veryfast", "-r", str(FPS)]

    if has_audio:
        filters = [f"[{audio_idx}:a]apad[voice]"]
        mix_inputs = ["[voice]"]
        if has_bgm:
            filters.append(f"[{bgm_idx}:a]volume=0.12[bgm]")
            mix_inputs.append("[bgm]")
        if has_sfx:
            filters.append(f"[{sfx_idx}:a]volume=0.35[sfx]")
            mix_inputs.append("[sfx]")
        if len(mix_inputs) > 1:
            filters.append(f"{''.join(mix_inputs)}amix=inputs={len(mix_inputs)}:duration=first:dropout_transition=2[aout]")
            cmd += ["-filter_complex", ";".join(filters), "-map", "0:v", "-map", "[aout]", "-c:a", "aac", "-b:a", "160k"]
        else:
            cmd += ["-c:a", "aac", "-b:a", "160k", "-af", "apad"]

    cmd += ["-movflags", "+faststart", "-t", f"{seconds:.2f}", str(out_path)]
    subprocess.run(cmd, check=True)


def render_html_to_mp4(
    html: str, seconds: float, audio, out_path: Path, workdir: Path, bgm_path: Path = None, sfx_path: Path = None
) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    ensure_browser()
    frames = workdir / "frames"
    if frames.exists():
        shutil.rmtree(frames)
    frames.mkdir()

    print(f"• Merekam {int(round(seconds * FPS))} frame ({seconds:.1f} detik)...")
    render_frames(html, seconds, frames)

    print("• Menggabungkan video...")
    encode_video(frames, audio, seconds, out_path, bgm_path=bgm_path, sfx_path=sfx_path)
    shutil.rmtree(frames, ignore_errors=True)
    return out_path


def build_js_video(code: str, out_path: Path, workdir: Path) -> Path:
    """Mode tunggal: kode JS/HTML -> MP4 (dilengkapi BGM otomatis)."""
    workdir.mkdir(parents=True, exist_ok=True)
    duration, narration = parse_directives(code)

    audio, audio_len = None, None
    subtitles = []
    if narration:
        audio = workdir / "narasi.mp3"
        print("• Membuat suara narasi...")
        marks = tts_to_file(narration, audio)
        audio_len = audio_duration(audio)
        subtitles.append({
            "start": 0.0,
            "end": audio_len,
            "words": _build_word_timings(narration, 0.0, audio_len, marks=marks),
        })

    seconds = duration or ((audio_len + 0.6) if audio_len else DEFAULT_SECONDS)
    seconds = max(1.0, min(seconds, MAX_SECONDS))
    bgm = _pick_or_make_bgm(workdir)
    return render_html_to_mp4(build_html(code, subtitles=subtitles), seconds, audio, out_path, workdir, bgm_path=bgm)


def build_motion_video(
    scenes: list[dict],
    render_code: str,
    out_path: Path,
    workdir: Path,
    title: str = "Infografis",
    bgm_path: Path = None,
) -> Path:
    """
    Mode multi-scene infografis:
    `scenes` = [{"narration": "...", "type": "bar_chart", "data": {...}}, ...]
    `render_code` = kode JS yang memanggil `getActiveScene(t)` untuk menggambar tiap adegan.
    """
    import tts_provider
    from subtitles_export import safe_export

    workdir.mkdir(parents=True, exist_ok=True)
    narration_items = [(idx, s["narration"].strip()) for idx, s in enumerate(scenes) if s.get("narration", "").strip()]

    audio_map = {}
    marks_map = {}
    if narration_items:
        texts = [t for _, t in narration_items]
        paths = [workdir / f"scene_{idx:03d}.mp3" for idx, _ in narration_items]
        print(f"• Membuat suara untuk {len(texts)} adegan ({tts_provider.label()})...")
        all_marks = tts_provider.synthesize_many(texts, paths, edge_voice=VOICE, edge_rate=RATE)
        for (idx, _), p, m in zip(narration_items, paths, all_marks):
            audio_map[idx] = p
            marks_map[idx] = m

    cursor = 0.0
    timed_scenes = []
    subtitles = []
    ordered_audio_paths = []
    export_sentences = []
    export_durations = []
    export_marks = []

    for idx, s in enumerate(scenes):
        if idx in audio_map:
            dur = audio_duration(audio_map[idx])
            ordered_audio_paths.append(audio_map[idx])
        else:
            dur = float(s.get("duration", 3.0))

        start, end = round(cursor, 3), round(cursor + dur, 3)
        scene_entry = {**s, "start": start, "end": end}
        timed_scenes.append(scene_entry)

        nar_text = s.get("narration", "").strip()
        if nar_text:
            m_list = marks_map.get(idx, [])
            subtitles.append({
                "start": start,
                "end": end,
                "words": _build_word_timings(nar_text, start, end, marks=m_list),
            })
            export_sentences.append(nar_text)
            export_durations.append(dur)
            export_marks.append(m_list)
        cursor = end

    total_seconds = max(1.0, min(cursor + 0.5, MAX_SECONDS))
    combined_audio = None
    if ordered_audio_paths:
        combined_audio = workdir / "full_narasi.mp3"
        _concat_audios(ordered_audio_paths, combined_audio)

    sfx_track = _generate_scene_sfx_wav(workdir / "scene_sfx.wav", timed_scenes, total_seconds)
    bgm = _pick_or_make_bgm(workdir, bgm_path=bgm_path)
    html = build_html(render_code, scenes=timed_scenes, subtitles=subtitles)
    res = render_html_to_mp4(
        html, total_seconds, combined_audio, out_path, workdir, bgm_path=bgm, sfx_path=sfx_track
    )

    if export_sentences:
        safe_export(title, export_sentences, export_durations, export_marks, total_seconds, out_path)
    return res
