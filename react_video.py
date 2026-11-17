"""
Naskah teks -> video animasi bergaya React yang SINKRON dengan suara.

Alur:
  1. Suara per kalimat + waktu tiap kata (Edge TTS), memakai fungsi dari auto_shorts.py.
  2. Susun halaman HTML berisi komponen React (tanpa JSX, React dari cdnjs) yang menampilkan
     judul, kartu kata yang menyala sesuai waktu ucap, latar bergerak, dan bilah progres.
  3. Rekam frame lewat js_video.py, lalu gabungkan dengan suara dan musik latar.
"""

import json
import os
from pathlib import Path

from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, concatenate_audioclips

import auto_shorts as AS
import js_video
import tts_provider
from subtitles_export import safe_export

MAX_SECONDS = 90
LABEL = os.getenv("REACT_LABEL", "FAKTA UNIK")   # teks kecil di atas judul
PALETTES = [  # (warna latar 1, warna latar 2, warna sorot)
    ("#1e3a8a", "#0f172a", "#fbbf24"),
    ("#064e3b", "#022c22", "#34d399"),
    ("#7c2d12", "#1c0a05", "#fb923c"),
    ("#4c1d95", "#1e1b4b", "#f472b6"),
    ("#0c4a6e", "#082f49", "#38bdf8"),
]

PAGE = """<!doctype html>
<html><head><meta charset="utf-8">
<style>html,body{margin:0;background:#000;overflow:hidden}#root{width:1080px;height:1920px;overflow:hidden}</style>
</head><body><div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
const DATA = __DATA__;
const h = React.createElement;
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const ease = (x) => 1 - Math.pow(1 - clamp(x), 3);
const pop = (x) => { x = clamp(x); const c = 1.70158; return 1 + (c + 1) * Math.pow(x - 1, 3) + c * Math.pow(x - 1, 2); };
const C1 = DATA.palette[0], C2 = DATA.palette[1], ACC = DATA.palette[2];
const FONT = "'Segoe UI', 'DejaVu Sans', Arial, sans-serif";

// Kelompokkan kata jadi potongan (maks 4 kata, berhenti di tanda baca)
function buildChunks(words, size) {
  const chunks = [];
  let cur = [];
  words.forEach((w) => {
    cur.push(w);
    if (cur.length >= size || /[.,!?;:]$/.test(w.w)) { chunks.push(cur); cur = []; }
  });
  if (cur.length) chunks.push(cur);
  return chunks.map((ws, i, arr) => ({
    words: ws,
    start: ws[0].s,
    end: i + 1 < arr.length ? arr[i + 1][0].s : DATA.duration,
  }));
}
const CHUNKS = buildChunks(DATA.words, 4);

function Background(props) {
  const t = props.t;
  const orbs = [0, 1, 2, 3, 4].map((i) => {
    const r = 260 + i * 60;
    const x = 540 + Math.sin(t * 0.5 + i * 1.9) * 420;
    const y = 960 + Math.cos(t * 0.4 + i * 2.3) * 760;
    return h("div", {
      key: i,
      style: {
        position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%",
        background: "radial-gradient(circle, " + ACC + "40 0%, " + ACC + "00 70%)",
      },
    });
  });
  return h("div", {
    style: {
      position: "absolute", left: 0, top: 0, width: 1080, height: 1920,
      background: "linear-gradient(" + (160 + Math.sin(t * 0.3) * 20) + "deg, " + C1 + ", " + C2 + " 65%)",
    },
  }, orbs);
}

function Title(props) {
  const t = props.t;
  const k = pop(t / 0.7);
  return h("div", {
    style: {
      position: "absolute", top: 190, left: 70, width: 940, textAlign: "center",
      opacity: clamp(t / 0.4), transform: "scale(" + (0.6 + 0.4 * k) + ")",
    },
  },
    h("div", { style: { fontSize: 44, letterSpacing: 10, color: ACC, fontWeight: 800, marginBottom: 24 } }, DATA.label),
    h("div", { style: { fontSize: 72, fontWeight: 800, lineHeight: 1.15, color: "#fff", textShadow: "0 4px 24px rgba(0,0,0,0.45)" } }, DATA.title)
  );
}

function ChunkCard(props) {
  const t = props.t;
  let idx = -1;
  for (let i = 0; i < CHUNKS.length; i++) if (t >= CHUNKS[i].start) idx = i;
  if (idx < 0) return null;
  const c = CHUNKS[idx];
  const enter = ease((t - c.start) / 0.22);
  let active = 0;
  c.words.forEach((w, i) => { if (t >= w.s) active = i; });
  return h("div", {
    style: {
      position: "absolute", left: 60, top: 780, width: 960, minHeight: 440, boxSizing: "border-box",
      display: "flex", flexWrap: "wrap", justifyContent: "center", alignContent: "center", gap: "10px 28px",
      padding: "60px 50px", borderRadius: 56, background: "rgba(0,0,0,0.30)",
      border: "3px solid rgba(255,255,255,0.14)", opacity: enter, transform: "translateY(" + (1 - enter) * 50 + "px)",
    },
  },
    c.words.map((w, i) => {
      const isActive = i === active;
      const spoken = t >= w.s;
      const scale = isActive ? 1 + 0.2 * Math.max(0, 1 - (t - w.s) / 0.2) : 1;
      return h("span", {
        key: i,
        style: {
          fontSize: 104, fontWeight: 800, display: "inline-block", fontFamily: FONT,
          color: isActive ? ACC : "#ffffff", opacity: spoken ? 1 : 0.3, transform: "scale(" + scale + ")",
          textShadow: "0 4px 18px rgba(0,0,0,0.5)",
        },
      }, w.w);
    })
  );
}

function Progress(props) {
  return h("div", { style: { position: "absolute", left: 80, top: 1740, width: 920, height: 18, background: "rgba(255,255,255,0.15)", borderRadius: 9 } },
    h("div", { style: { width: clamp(props.t / DATA.duration) * 920, height: 18, background: ACC, borderRadius: 9 } })
  );
}

function App(props) {
  return h("div", { style: { position: "relative", width: 1080, height: 1920, fontFamily: FONT, color: "#fff", overflow: "hidden" } },
    h(Background, { t: props.t }),
    h(Title, { t: props.t }),
    h(ChunkCard, { t: props.t }),
    h(Progress, { t: props.t })
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
// Bot memanggil draw(t) tiap frame; flushSync memastikan React selesai merender sebelum di-screenshot.
function draw(t) {
  ReactDOM.flushSync(function () { root.render(h(App, { t: t })); });
}
</script></body></html>"""


def make_page(title: str, words: list, duration: float, label: str = None) -> str:
    palette = PALETTES[sum(ord(c) for c in title) % len(PALETTES)]
    data = {
        "title": title,
        "label": label or LABEL,
        "palette": list(palette),
        "duration": round(duration, 3),
        "words": words,
    }
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\\/")
    return PAGE.replace("__DATA__", blob)


def build_react_video(item: dict, out_path: Path, workdir: Path) -> Path:
    workdir.mkdir(parents=True, exist_ok=True)
    sentences = AS.split_sentences(item["text"])
    if not sentences:
        raise ValueError("Naskah kosong.")

    print(f"• Membuat suara dan waktu kata ({tts_provider.label()})...")
    audio_paths, all_marks = AS.make_voice(sentences, workdir)
    clips = [AudioFileClip(str(p)) for p in audio_paths]
    voice = concatenate_audioclips(clips)
    total = min(voice.duration + 0.5, MAX_SECONDS)

    words, t0 = [], 0.0
    for sentence, ac, marks in zip(sentences, clips, all_marks):
        for w, a, b in AS.word_timings(sentence, marks, ac.duration):
            words.append({"w": w, "s": round(t0 + a, 3), "e": round(t0 + b, 3)})
        t0 += ac.duration

    audio = voice
    if AS.MUSIC:
        try:
            print("• Menambah musik latar...")
            audio = CompositeAudioClip([voice, AS.make_music(total)])
        except Exception as e:
            print(f"[!] Musik dilewati: {e}")
    mix = workdir / "mix.wav"
    audio.write_audiofile(str(mix), fps=44100, logger=None)

    html = make_page(item["title"], words, total, item.get("label"))
    out = js_video.render_html_to_mp4(html, total, mix, out_path, workdir)
    safe_export(item["title"], sentences, [c.duration for c in clips], all_marks, total, out)
    return out
