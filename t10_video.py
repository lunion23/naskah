"""
Template T10 Grid Lampu Sorot -> Video MP4 Vertikal 1080x1920 (Durasi Dinamis mengikuti TTS)
Adaptasi dari template Remotion T10Sorot oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id
Terintegrasi langsung dengan mesin Playwright js_video.py, tts_provider.py, dan subtitles_export.py.
"""

import base64
import json
import math
import re
from pathlib import Path

from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, concatenate_audioclips

import auto_shorts as AS
import js_video
import tts_provider
from subtitles_export import safe_export

FPS = 30
BASE_FRAMES = 480  # Basis acuan animasi asli (16.0 detik @ 30fps)
MIN_DURASI_DETIK = 12.0  # Durasi minimum jika tanpa narasi / narasi sangat pendek

ASSETS_DIR = Path("assets/t10")

DEFAULT_K = {
    "warna": {"emas": "#E2B33C", "merah": "#B8292F"},
    "pembuka": {
        "depan": "BANYAK YANG",
        "redup": "BERHENTI",
        "label": "FOKUS",
    },
    "lelah": {
        "kata": "Melelahkan.",
        "kecil": "Tapi jangan mundur.",
    },
    "kartu": [
        ["⏳", "Waktu terus\nberjalan"],
        ["🧠", "Pikiran mulai\npenuh"],
        ["🚧", "Banyak\nrintangan"],
        ["🔥", "Tetap jalan\npelan"],
    ],
    "pelan": {
        "depan": "Jalan saja",
        "emas": "PELAN",
        "bawah": "asal tidak berhenti",
    },
    "tekanan": ["FOKUS PROSES", "ABAIKAN DRAMA"],
    "suatuHari": "Suatu hari",
    "menang": "KAMU AKAN MENANG KARENA",
    "konsisten": "KONSISTEN",
    "penutup": {
        "atas": "JADI MUSTAHIL UNTUK",
        "besar": "KALAH",
    },
}


def _img_to_data_uri(filename: str) -> str:
    """Konversi PNG lokal di assets/t10/ menjadi data URI agar terbaca di Chromium tanpa server lokal."""
    p = ASSETS_DIR / filename
    if not p.exists():
        return "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="
    b64 = base64.b64encode(p.read_bytes()).decode("ascii")
    return f"data:image/png;base64,{b64}"


def _build_narration_from_k(k: dict) -> str:
    """Susun naskah narasi otomatis dari teks kartu T10 jika user tidak mengisi kolom 'narasi:'."""
    kartu_txt = ", ".join(c[1].replace("\n", " ") for c in k.get("kartu", []))
    parts = [
        f"{k['pembuka']['depan']} {k['pembuka']['redup']} soal {k['pembuka']['label']}.",
        f"{k['lelah']['kata']} {k['lelah']['kecil']}",
        f"{kartu_txt}.",
        f"{k['pelan']['depan']} {k['pelan']['emas']}, {k['pelan']['bawah']}.",
        f"{k['tekanan'][0]}. {k['tekanan'][1]}.",
        f"{k['suatuHari']}, {k['menang'].lower()} {k['konsisten'].lower()}.",
        f"{k['penutup']['atas'].lower()} {k['penutup']['besar'].lower()}!",
    ]
    return " ".join(p.strip() for p in parts if p.strip())


def _auto_build_k_from_plain_text(raw_text: str, narration_override: str = None) -> dict:
    """Konversi naskah teks biasa (paragraf / judul + isi) menjadi konfigurasi kartu T10 otomatis."""
    title = None
    body_lines = []
    for line in raw_text.splitlines():
        m_title = re.match(r"^\s*(?:judul|title)\s*:\s*(.+)$", line, re.I)
        if m_title and not title:
            title = m_title.group(1).strip()
        else:
            body_lines.append(line.strip())

    clean_body = " ".join(l for l in body_lines if l).strip()
    sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", clean_body) if s.strip()]
    k = json.loads(json.dumps(DEFAULT_K))

    # Ambil kata kunci dari judul atau kalimat pertama untuk pembuka & penutup
    topic_words = re.findall(r"[A-Za-zÀ-ÿ0-9]+", (title or (sentences[0] if sentences else "FOKUS")))
    key_label = (topic_words[-1] if topic_words else "FOKUS").upper()[:14]
    first_words = [w.upper() for w in topic_words[:2]]
    if len(first_words) >= 2:
        k["pembuka"]["depan"] = first_words[0]
        k["pembuka"]["redup"] = first_words[1]
    k["pembuka"]["label"] = key_label

    if sentences:
        s0_words = sentences[0].rstrip(".!?").split()
        k["lelah"]["kata"] = (s0_words[0].capitalize() + ".") if s0_words else "Penting."
        k["lelah"]["kecil"] = " ".join(s0_words[1:6]) if len(s0_words) > 1 else "Simak poin utamanya."

    # Isi 4 kartu dari kalimat-kalimat tengah
    emojis = ["💡", "⚙️", "🔥", "🚀"]
    mid_sentences = sentences[1:5] if len(sentences) > 1 else sentences
    cards = []
    for idx in range(4):
        src = mid_sentences[idx % len(mid_sentences)] if mid_sentences else "Fokus pada proses"
        w_list = [w.strip(".,!?;:") for w in src.split() if w.strip(".,!?;:")]
        line1 = " ".join(w_list[:2]) if w_list else "Langkah"
        line2 = " ".join(w_list[2:4]) if len(w_list) > 2 else "penting"
        cards.append([emojis[idx], f"{line1}\n{line2}"])
    k["kartu"] = cards

    k["pelan"]["depan"] = "Kunci utama"
    k["pelan"]["emas"] = key_label
    k["pelan"]["bawah"] = "lakukan secara konsisten"

    if len(sentences) >= 2:
        last_words = [w.strip(".,!?;:").upper() for w in sentences[-1].split() if w.strip(".,!?;:")]
        if len(last_words) >= 2:
            k["penutup"]["atas"] = " ".join(last_words[-4:-1]) or "KUNCI UNTUK"
            k["penutup"]["besar"] = last_words[-1][:12]

    k["narration"] = narration_override or clean_body or _build_narration_from_k(k)
    return k


def parse_t10_input(raw_text: str) -> dict:
    """
    Mendukung 2 format input:
    1. JSON lengkap (bisa kustom semua field K + opsional 'narasi' / 'text')
    2. Teks berpemisah '|' (mode cepat 7 bagian atau lengkap 19 bagian)
    """
    cleaned = raw_text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*|\s*```$", "", cleaned, flags=re.I).strip()

    k = json.loads(json.dumps(DEFAULT_K))
    narration = None

    if cleaned.startswith("{"):
        user_json = json.loads(cleaned)
        narration = user_json.pop("narasi", None) or user_json.pop("text", None)
        for key, val in user_json.items():
            if isinstance(val, dict) and isinstance(k.get(key), dict):
                k[key].update(val)
            else:
                k[key] = val
    else:
        lines = []
        for line in cleaned.splitlines():
            m_nar = re.match(r"^\s*(?:narasi|voice|text)\s*:\s*(.+)$", line, re.I)
            if m_nar:
                narration = m_nar.group(1).strip()
            else:
                lines.append(line)
        body = " ".join(lines).strip()
        parts = [p.strip() for p in body.split("|") if p.strip()]

        if len(parts) >= 19:
            k["pembuka"] = {"depan": parts[0], "redup": parts[1], "label": parts[2]}
            k["lelah"] = {"kata": parts[3], "kecil": parts[4]}
            k["kartu"] = [
                ["⏳", parts[5].replace("\\n", "\n")],
                ["🧠", parts[6].replace("\\n", "\n")],
                ["🚧", parts[7].replace("\\n", "\n")],
                ["🔥", parts[8].replace("\\n", "\n")],
            ]
            k["pelan"] = {"depan": parts[9], "emas": parts[10], "bawah": parts[11]}
            k["tekanan"] = [parts[12], parts[13]]
            k["suatuHari"] = parts[14]
            k["menang"] = parts[15]
            k["konsisten"] = parts[16]
            k["penutup"] = {"atas": parts[17], "besar": parts[18]}
        elif len(parts) >= 2:
            if len(parts) > 0:
                k["pembuka"]["depan"] = parts[0]
            if len(parts) > 1:
                k["pembuka"]["redup"] = parts[1]
            if len(parts) > 2:
                k["pembuka"]["label"] = parts[2]
            if len(parts) > 3:
                k["lelah"]["kata"] = parts[3]
            if len(parts) > 4:
                k["lelah"]["kecil"] = parts[4]
            if len(parts) > 5:
                k["penutup"]["atas"] = parts[5]
            if len(parts) > 6:
                k["penutup"]["besar"] = parts[6]
        else:
            # Otomatis konversi teks biasa / naskah paragraf menjadi struktur T10
            k = _auto_build_k_from_plain_text(body, narration_override=narration)

    k["gambar"] = {
        "mahkota": _img_to_data_uri("mahkota.png"),
        "kusut": _img_to_data_uri("kusut.png"),
        "jampasir": _img_to_data_uri("jampasir.png"),
        "kawat": _img_to_data_uri("kawat.png"),
        "maskot": _img_to_data_uri("kucing.png"),
    }
    k["narration"] = narration or _build_narration_from_k(k)
    return k


T10_HTML_TEMPLATE = """<!doctype html>
<html>
<head>
<meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Instrument+Serif:ital@0;1&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  html, body { margin: 0; padding: 0; background: #ececea; overflow: hidden; }
  #root { width: 1080px; height: 1920px; position: relative; overflow: hidden; }
</style>
</head>
<body>
<div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
// Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id
// Lisensi Nonkomersial Maliki Studio (kredit wajib, dilarang dijual)
const K = __K_JSON__;
const h = React.createElement;
const FPS = 30;
const BASE_FRAMES = 480;
const TOTAL_FRAMES = K.totalFrames || BASE_FRAMES;

const SERIF = "'Instrument Serif', Georgia, serif";
const INTER = "'Inter', sans-serif";
const ARCHIVO = "'Archivo Black', sans-serif";
const EMAS = K.warna.emas;
const MERAH = K.warna.merah;

function cubicBezier(x1, y1, x2, y2) {
  return function(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let t = x;
    for (let i = 0; i < 8; i++) {
      const cx = 3 * x1 * t * (1 - t) * (1 - t) + 3 * x2 * t * t * (1 - t) + t * t * t - x;
      const dx = 3 * x1 * (1 - t) * (1 - t) + 6 * (x2 - x1) * t * (1 - t) + 3 * (1 - x2) * t * t;
      if (Math.abs(dx) < 1e-6) break;
      t -= cx / dx;
    }
    t = Math.min(Math.max(t, 0), 1);
    return 3 * y1 * t * (1 - t) * (1 - t) + 3 * y2 * t * t * (1 - t) + t * t * t;
  };
}
const E_DEFAULT = cubicBezier(0.22, 1, 0.36, 1);
const E_DROP = cubicBezier(0.5, 0, 0.7, 1.2);
const E_QUAD = t => t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

function kInterp(f, a, b, d, ease = E_DEFAULT) {
  const raw = (f - a) / (b - a);
  const cl = Math.min(Math.max(raw, 0), 1);
  const e = ease(cl);
  return d[0] + (d[1] - d[0]) * e;
}

function springVal(frame, damping = 13, stiffness = 140, mass = 1) {
  if (frame <= 0) return 0;
  const dt = 1 / FPS;
  let x = 0, v = 0;
  const steps = Math.min(Math.round(frame * 2), 600);
  const hStep = (frame * dt) / steps;
  for (let i = 0; i < steps; i++) {
    const a = (-stiffness * (x - 1) - damping * v) / mass;
    v += a * hStep;
    x += v * hStep;
  }
  return x;
}

function Ketik(props) {
  const n = Math.max(0, Math.floor((props.t - props.mulai) * (props.cps || 1)));
  return props.teks.slice(0, n);
}

function Grid() {
  return h("div", {
    style: {
      position: "absolute", inset: 0, background: "#ececea",
      backgroundImage: "linear-gradient(rgba(0,0,0,0.08) 2px, transparent 2px), linear-gradient(90deg, rgba(0,0,0,0.08) 2px, transparent 2px)",
      backgroundSize: "68px 68px"
    }
  });
}

function Sorot(props) {
  const xs = props.xs || [270, 810];
  return h(React.Fragment, null,
    h("div", { style: { position: "absolute", inset: 0, background: "rgba(0,0,0,0.28)" } }),
    xs.map((x, i) => h("div", {
      key: i,
      style: {
        position: "absolute", left: x - 420, top: -40, width: 840, height: 1700,
        background: "radial-gradient(55% 100% at 50% 0%, rgba(255,255,255,0.95), rgba(255,255,255,0.35) 45%, transparent 75%)",
        clipPath: "polygon(42% 0, 58% 0, 100% 100%, 0 100%)",
        opacity: kInterp(props.t, i * 3, i * 3 + 6, [0, 1])
      }
    }))
  );
}

function Tinta(props) {
  const blobs = [[160, 60, 1], [560, 30, 1.3], [900, 90, 0.9]];
  return h("svg", { width: 1080, height: 420, style: { position: "absolute", top: -40 } },
    blobs.map(([x, y, s], i) => h("g", {
      key: i,
      transform: `translate(${x} ${y}) scale(${s * kInterp(props.t, i * 3, i * 3 + 10, [0, 1])})`
    },
      h("path", { d: "M0 0 C 30 -60 90 -40 80 10 C 140 0 160 70 90 80 C 120 150 30 160 10 100 C -40 160 -120 110 -70 60 C -150 40 -110 -40 -40 -10 C -60 -70 -20 -80 0 0Z", fill: "#141414" }),
      h("path", { d: "M40 70 Q 120 140 90 240 Q 60 300 110 330", stroke: "#141414", strokeWidth: 10, fill: "none", strokeLinecap: "round" }),
      h("circle", { cx: 150, cy: 40, r: 12, fill: "#141414" }),
      h("circle", { cx: -110, cy: 120, r: 8, fill: "#141414" })
    ))
  );
}

function T10SorotApp(props) {
  const f = props.frame;
  let scene = null;

  if (f < 62) {
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h(Tinta, { t: f }),
      h("div", { style: { position: "absolute", top: 640, width: "100%", textAlign: "center", fontFamily: INTER, fontSize: 40, color: "#333" } },
        K.pembuka.depan + " ", h("span", { style: { color: "#999" } }, K.pembuka.redup)
      ),
      h("div", {
        style: {
          position: "absolute", top: 700, left: 240, width: 600, textAlign: "center",
          background: "#141414", padding: "6px 0", fontFamily: SERIF, fontSize: 130,
          color: EMAS, letterSpacing: 4, transform: `scaleX(${kInterp(f, 22, 34, [0, 1])})`,
          textShadow: "0 0 12px rgba(226,179,60,0.4)"
        }
      }, K.pembuka.label),
      h("img", {
        src: K.gambar.mahkota,
        style: {
          position: "absolute", left: kInterp(f, 0, 30, [-60, 120]), top: kInterp(f, 0, 30, [1500, 980]),
          width: 820, filter: "drop-shadow(0 30px 40px rgba(0,0,0,0.35))"
        }
      })
    );
  } else if (f < 106) {
    const t = f - 62;
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h(Tinta, { t: 20 }),
      h("div", {
        style: {
          position: "absolute", top: 600, width: "100%", textAlign: "center",
          fontFamily: SERIF, fontSize: 120, color: MERAH, textShadow: "2px 2px 0 rgba(0,0,0,0.15)"
        }
      },
        h(Ketik, { teks: K.lelah.kata, t: t, mulai: 2, cps: 0.6 }),
        h("span", { style: { fontFamily: INTER, fontSize: 30, color: "#333", marginLeft: 12, opacity: t > 20 ? 1 : 0 } }, K.lelah.kecil)
      ),
      h("img", {
        src: K.gambar.kusut,
        style: {
          position: "absolute", left: 140, top: 900, width: 800,
          transform: `translateY(${kInterp(t, 0, 18, [700, 0])}px) rotate(${Math.sin(t / 6) * 1.5}deg)`
        }
      })
    );
  } else if (f < 194) {
    const t = f - 106;
    const geser = kInterp(t, 6, 88, [180, -560], E_QUAD);
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h(Sorot, { t: t }),
      h("div", { style: { position: "absolute", left: geser, top: 0, width: 2200, height: 1920 } },
        h("svg", { width: 2200, height: 600, style: { position: "absolute", top: 380 } },
          h("path", { d: "M 0 40 Q 1100 260 2200 40", stroke: "#222", strokeWidth: 3, fill: "none" })
        ),
        K.kartu.map(([em, tx], i) => {
          const x = 300 + i * 440;
          const y = 440 + Math.sin((x / 2200) * Math.PI) * 150;
          const m = springVal(t - 4 - i * 8, 8, 100, 0.6);
          return h("div", {
            key: i,
            style: {
              position: "absolute", left: x, top: y, width: 300, height: 380,
              background: "#fbfbf8", boxShadow: "0 24px 40px rgba(0,0,0,0.25)",
              transformOrigin: "50% 0",
              transform: `translateY(${(1 - m) * -500}px) rotate(${Math.sin((t + i * 14) / 14) * 3 + (i % 2 ? 3 : -3)}deg)`,
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20
            }
          },
            h("div", { style: { position: "absolute", top: -40, width: 30, height: 80, background: "linear-gradient(#d9b07a,#a87c48)", borderRadius: 5 } }),
            h("div", { style: { fontSize: 120 } }, em),
            h("div", { style: { fontFamily: SERIF, fontStyle: "italic", fontSize: 44, textAlign: "center", whiteSpace: "pre-line", color: "#333", lineHeight: 1 } }, tx)
          );
        })
      )
    );
  } else if (f < 264) {
    const t = f - 194;
    const miring = kInterp(t, 24, 50, [0, -18]);
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h("svg", { width: 1080, height: 1920, style: { position: "absolute" } },
        h("line", { x1: kInterp(t, 20, 40, [1080, 600]), y1: 0, x2: kInterp(t, 20, 40, [1080, 200]), y2: 1920, stroke: "#333", strokeWidth: 2 }),
        h("line", { x1: 0, y1: 1300, x2: kInterp(t, 30, 46, [0, 1080]), y2: 1300, stroke: "#333", strokeWidth: 2, strokeDasharray: "10 8" })
      ),
      h("div", { style: { position: "absolute", left: 120, top: 380, fontFamily: SERIF, fontStyle: "italic", fontSize: 54, color: "#333" } },
        h(Ketik, { teks: K.pelan.depan, t: t, mulai: 4, cps: 0.8 })
      ),
      h("div", {
        style: {
          position: "absolute", left: 340, top: 440, fontFamily: SERIF, fontSize: 140,
          color: EMAS, textShadow: "0 4px 0 #8a6511", opacity: kInterp(t, 30, 38, [0, 1]),
          transform: `scale(${kInterp(t, 30, 42, [1.4, 1])})`
        }
      }, K.pelan.emas),
      h("img", {
        src: K.gambar.jampasir,
        style: {
          position: "absolute", left: 230, top: kInterp(t, 0, 16, [-900, 640], E_DROP),
          width: 560, transform: `rotate(${miring}deg)`, transformOrigin: "50% 100%",
          filter: "drop-shadow(30px 40px 30px rgba(0,0,0,0.3))"
        }
      }),
      h("div", { style: { position: "absolute", left: 700, top: 1330, fontFamily: SERIF, fontStyle: "italic", fontSize: 50, color: "#333" } },
        h(Ketik, { teks: K.pelan.bawah, t: t, mulai: 44, cps: 0.5 })
      )
    );
  } else if (f < 304) {
    const t = f - 264;
    scene = h("div", { style: { position: "absolute", inset: 0, background: "#050505" } },
      [120, 960].map(x => h("div", { key: x, style: { position: "absolute", left: x, top: 0, width: 2, height: `${kInterp(t, 0, 10, [0, 100])}%`, borderLeft: "2px dashed #555" } })),
      [920, 1010].map(y => h("div", { key: y, style: { position: "absolute", top: y, left: 0, height: 2, width: `${kInterp(t, 2, 12, [0, 100])}%`, borderTop: "2px dashed #555" } })),
      h("div", { style: { position: "absolute", top: 925, width: "100%", textAlign: "center", fontFamily: ARCHIVO, fontSize: 76, color: "#fff", letterSpacing: 2 } },
        t < 20 ? K.tekanan[0] : K.tekanan[1]
      )
    );
  } else if (f < 388) {
    const t = f - 304;
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h("img", {
        src: K.gambar.kawat,
        style: {
          position: "absolute", right: -260, top: -200, width: 760,
          transform: `rotate(${20 + t * 0.15}deg) translate(${kInterp(t, 0, 16, [300, 0])}px, ${kInterp(t, 0, 16, [-300, 0])}px)`
        }
      }),
      h("img", {
        src: K.gambar.kawat,
        style: {
          position: "absolute", left: -280, bottom: -180, width: 800,
          transform: `rotate(${-30 - t * 0.15}deg) translate(${kInterp(t, 0, 16, [-300, 0])}px, ${kInterp(t, 0, 16, [300, 0])}px)`
        }
      }),
      h("div", { style: { position: "absolute", top: 800, width: "100%", textAlign: "center", fontFamily: SERIF, fontSize: 84, color: MERAH } },
        h("span", { style: { display: "inline-block", width: kInterp(t, 4, 18, [0, 120]), borderTop: `3px double ${MERAH}`, verticalAlign: "middle", marginRight: 20 } }),
        h(Ketik, { teks: K.suatuHari, t: t, mulai: 4, cps: 0.7 }),
        h("span", { style: { display: "inline-block", width: kInterp(t, 4, 18, [0, 120]), borderTop: `3px double ${MERAH}`, verticalAlign: "middle", marginLeft: 20 } })
      ),
      h("div", { style: { position: "absolute", left: 200, top: 960, fontFamily: INTER, fontSize: 34, color: "#333", opacity: kInterp(t, 28, 36, [0, 1]) } }, K.menang),
      h("div", { style: { position: "absolute", left: 200, top: 1010, fontFamily: SERIF, fontSize: 110, color: MERAH, letterSpacing: 4 } },
        h(Ketik, { teks: K.konsisten, t: t, mulai: 38, cps: 0.6 })
      )
    );
  } else {
    const t = f - 388;
    const kilau = kInterp(t, 60, 70, [0, 1]) * kInterp(t, 70, 84, [1, 0]);
    scene = h("div", { style: { position: "absolute", inset: 0 } },
      h(Sorot, { t: t, xs: [540] }),
      h("img", {
        src: K.gambar.maskot,
        style: {
          position: "absolute", left: 210, top: 760, width: 660,
          transform: `translateY(${kInterp(t, 0, 20, [900, 0])}px)`,
          filter: "drop-shadow(0 30px 30px rgba(0,0,0,0.35))"
        }
      }),
      h("div", { style: { position: "absolute", left: 640, top: 940, width: 80, height: 80, borderRadius: "50%", background: "radial-gradient(#fff, rgba(255,255,255,0))", opacity: kilau, transform: `scale(${1 + kilau})` } }),
      h("div", { style: { position: "absolute", top: 420, width: "100%", textAlign: "center", fontFamily: INTER, fontWeight: 600, fontSize: 36, letterSpacing: 3, color: "#333", opacity: kInterp(t, 10, 18, [0, 1]) } }, K.penutup.atas),
      h("div", {
        style: {
          position: "absolute", top: 470, width: "100%", textAlign: "center", fontFamily: ARCHIVO, fontSize: 108,
          color: EMAS, textShadow: "0 6px 0 #8a6511, 0 0 30px rgba(226,179,60,0.5)",
          transform: `scale(${springVal(t - 26, 9, 160, 1)})`
        }
      }, K.penutup.besar),
      h("div", {
        style: {
          position: "absolute", bottom: 38, width: "100%", textAlign: "center",
          fontFamily: INTER, fontSize: 20, color: "rgba(255,255,255,0.75)",
          textShadow: "0 2px 6px rgba(0,0,0,0.8)"
        }
      }, "Template oleh Maliki Saputra (@malikisaputra) — https://malikisaputra.biz.id")
    );
  }

  return h("div", { style: { position: "relative", width: 1080, height: 1920, overflow: "hidden" } },
    h(Grid),
    scene
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
function draw(t) {
  // Petakan waktu aktual (t) secara proporsional ke basis 480 frame
  const actualFrame = t * FPS;
  const scaledFrame = (actualFrame / TOTAL_FRAMES) * BASE_FRAMES;
  const frame = Math.min(BASE_FRAMES - 1, Math.max(0, Math.round(scaledFrame)));
  ReactDOM.flushSync(function() {
    root.render(h(T10SorotApp, { frame: frame }));
  });
}
</script>
</body>
</html>"""


def build_t10_video(k_data: dict, out_path: Path, workdir: Path) -> Path:
    """Merender template T10Sorot (durasi dinamis sesuai TTS) + musik latar + SRT/JSON."""
    workdir.mkdir(parents=True, exist_ok=True)
    narration = k_data.get("narration", "").strip()
    sentences = AS.split_sentences(narration)

    audio = None
    all_marks = []
    audio_clips = []
    durasi_detik = 16.0  # Default jika tidak ada narasi

    if sentences:
        print(f"• Membuat suara narasi T10 ({tts_provider.label()})...")
        audio_paths, all_marks = AS.make_voice(sentences, workdir)
        audio_clips = [AudioFileClip(str(p)) for p in audio_paths]
        voice = concatenate_audioclips(audio_clips)

        # Tambah buffer 0.8 detik di akhir agar penutup tidak terpotong mendadak
        durasi_detik = max(MIN_DURASI_DETIK, round(voice.duration + 0.8, 2))
        print(f"• Durasi dinamis T10: {durasi_detik:.2f} detik (suara: {voice.duration:.2f}d)")

        if AS.MUSIC:
            try:
                audio = CompositeAudioClip([voice, AS.make_music(durasi_detik)])
            except Exception as e:
                print(f"[!] Musik dilewati: {e}")
                audio = voice
        else:
            audio = voice

    total_frames = max(1, math.ceil(durasi_detik * FPS))
    k_data["totalFrames"] = total_frames

    mix_wav = None
    if audio is not None:
        mix_wav = workdir / "t10_mix.wav"
        audio.set_duration(durasi_detik).write_audiofile(
            str(mix_wav), fps=44100, logger=None
        )

    blob = json.dumps(k_data, ensure_ascii=False).replace("</", "<\/")
    html = T10_HTML_TEMPLATE.replace("__K_JSON__", blob)

    out = js_video.render_html_to_mp4(html, durasi_detik, mix_wav, out_path, workdir)

    if sentences and audio_clips:
        title = f"{k_data['pembuka']['depan']} {k_data['pembuka']['label']}".strip()
        safe_export(
            title,
            sentences,
            [c.duration for c in audio_clips],
            all_marks,
            durasi_detik,
            out,
        )
    return out
