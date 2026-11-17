"""
Naskah teks -> video animasi bergaya React v2 (Kinetic Editorial + Visual Scenes) yang SINKRON dengan suara.

Peningkatan visual:
  1. Multi-Scene Visual Cards di area atas: otomatis mendeteksi angka besar (Stat Card),
     poin berurutan (Step Card), atau kutipan/highlight penting (Insight Card) dari tiap kalimat.
  2. Kinetic Karaoke Typography di area tengah: kata aktif menyala dalam pil warna aksen dengan
     efek spring pop & glow, ditambah pratinjau kata berikutnya agar nyaman dibaca.
  3. Latar Dinamis Berlapis: grid halus, partikel cahaya mengambang, dan orb gradien berdenyut.
  4. Header Kategori + Penghitung Adegan & Indikator Audio Equalizer aktif saat narator berbicara.
  5. Fix durasi CompositeAudioClip (.set_duration(total)) agar bebas error MoviePy 1.0.3.
"""

import json
import os
import re
from pathlib import Path

from moviepy.audio.AudioClip import CompositeAudioClip
from moviepy.editor import AudioFileClip, concatenate_audioclips

import auto_shorts as AS
import js_video
import tts_provider
from subtitles_export import safe_export

MAX_SECONDS = 90
LABEL = os.getenv("REACT_LABEL", "FAKTA & EDUKASI")
PALETTES = [
    # (bg1, bg2, accent, accentSoft, cardBg)
    ("#0f172a", "#1e3a8a", "#fbbf24", "rgba(251, 191, 36, 0.18)", "rgba(15, 23, 42, 0.62)"),
    ("#022c22", "#065f46", "#34d399", "rgba(52, 211, 153, 0.18)", "rgba(2, 44, 34, 0.62)"),
    ("#1c0a05", "#7c2d12", "#fb923c", "rgba(251, 146, 60, 0.18)", "rgba(28, 10, 5, 0.62)"),
    ("#1e1b4b", "#4c1d95", "#f472b6", "rgba(244, 114, 182, 0.18)", "rgba(30, 27, 75, 0.62)"),
    ("#082f49", "#0369a1", "#38bdf8", "rgba(56, 189, 248, 0.18)", "rgba(8, 47, 73, 0.62)"),
]

PAGE = """<!doctype html>
<html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@600;700;800&family=Space+Grotesk:wght@700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;background:#050811;overflow:hidden}
  #root{width:1080px;height:1920px;overflow:hidden}
</style>
</head><body><div id="root"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.3.1/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.3.1/umd/react-dom.production.min.js"></script>
<script>
const DATA = __DATA__;
const h = React.createElement;
const clamp = (x, a = 0, b = 1) => Math.min(Math.max(x, a), b);
const easeOut = (x) => 1 - Math.pow(1 - clamp(x), 3);
const pop = (x) => {
  x = clamp(x);
  const c1 = 1.70158, c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
};

const C1 = DATA.palette[0];
const C2 = DATA.palette[1];
const ACC = DATA.palette[2];
const ACC_SOFT = DATA.palette[3];
const CARD_BG = DATA.palette[4];
const FONT_MAIN = "'Plus Jakarta Sans', 'Segoe UI', 'DejaVu Sans', sans-serif";
const FONT_NUM = "'Space Grotesk', 'Plus Jakarta Sans', sans-serif";

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

function getActiveSentence(t) {
  const list = DATA.sentences || [];
  for (let i = 0; i < list.length; i++) {
    if (t >= list[i].start && t < list[i].end) return { index: i, item: list[i] };
  }
  return list.length ? { index: list.length - 1, item: list[list.length - 1] } : null;
}

function isSpeaking(t) {
  return DATA.words.some((w) => t >= w.s - 0.04 && t <= w.e + 0.04);
}

function Background(props) {
  const t = props.t;
  const orbs = [0, 1, 2, 3, 4].map((i) => {
    const r = 280 + i * 65;
    const x = 540 + Math.sin(t * 0.45 + i * 1.7) * 430;
    const y = 960 + Math.cos(t * 0.35 + i * 2.1) * 780;
    return h("div", {
      key: "orb-" + i,
      style: {
        position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2,
        borderRadius: "50%",
        background: "radial-gradient(circle, " + ACC + "33 0%, " + ACC + "00 70%)",
      },
    });
  });

  const particles = Array.from({ length: 14 }).map((_, i) => {
    const px = ((i * 197 + 80) % 980) + 50 + Math.sin(t * 0.8 + i) * 22;
    const py = 1920 - (((t * (45 + (i % 4) * 18) + i * 140) % 1960));
    const sz = 6 + (i % 3) * 4;
    return h("div", {
      key: "pt-" + i,
      style: {
        position: "absolute", left: px, top: py, width: sz, height: sz,
        borderRadius: "50%", background: ACC, opacity: 0.28 + (i % 3) * 0.12,
      },
    });
  });

  return h("div", {
    style: {
      position: "absolute", inset: 0,
      background: "linear-gradient(" + (155 + Math.sin(t * 0.25) * 18) + "deg, " + C1 + " 0%, " + C2 + " 55%, #050811 100%)",
    },
  },
    orbs,
    h("div", {
      style: {
        position: "absolute", inset: 0,
        backgroundImage: "linear-gradient(rgba(255,255,255,0.045) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.045) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        transform: "translateY(" + ((t * 18) % 72) + "px)",
      },
    }),
    particles
  );
}

function Header(props) {
  const t = props.t;
  const active = getActiveSentence(t);
  const total = (DATA.sentences || []).length || 1;
  const curNum = active ? active.index + 1 : 1;
  const enter = easeOut(t / 0.45);

  return h("div", {
    style: {
      position: "absolute", top: 76, left: 64, right: 64,
      opacity: enter, transform: "translateY(" + ((1 - enter) * -24) + "px)",
    },
  },
    h("div", {
      style: {
        display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24,
      },
    },
      h("div", {
        style: {
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "12px 24px", borderRadius: 999,
          background: ACC_SOFT, border: "2px solid " + ACC,
          color: ACC, fontSize: 24, fontWeight: 800, letterSpacing: 3,
        },
      }, "✦ " + DATA.label),
      h("div", {
        style: {
          padding: "10px 22px", borderRadius: 999,
          background: "rgba(255,255,255,0.1)", border: "1.5px solid rgba(255,255,255,0.2)",
          color: "#fff", fontSize: 24, fontWeight: 700, fontFamily: FONT_NUM,
        },
      }, String(curNum).padStart(2, "0") + " / " + String(total).padStart(2, "0"))
    ),
    h("div", {
      style: {
        fontSize: 54, fontWeight: 800, lineHeight: 1.18, color: "#ffffff",
        textShadow: "0 6px 28px rgba(0,0,0,0.45)",
      },
    }, DATA.title)
  );
}

function VisualFocusCard(props) {
  const t = props.t;
  const active = getActiveSentence(t);
  if (!active) return null;
  const s = active.item;
  const localT = t - s.start;
  const enter = easeOut(localT / 0.32);
  const scale = 0.92 + 0.08 * pop(localT / 0.45);

  return h("div", {
    style: {
      position: "absolute", left: 64, top: 360, width: 952, height: 390, boxSizing: "border-box",
      borderRadius: 42, padding: "38px 44px",
      background: CARD_BG,
      border: "2.5px solid rgba(255,255,255,0.18)",
      boxShadow: "0 24px 60px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.2)",
      opacity: enter,
      transform: "translateY(" + ((1 - enter) * 32) + "px) scale(" + scale + ")",
      display: "flex", flexDirection: "column", justifyContent: "space-between",
    },
  },
    h("div", {
      style: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
      },
    },
      h("div", {
        style: {
          display: "inline-flex", alignItems: "center", gap: 12,
          padding: "8px 20px", borderRadius: 16,
          background: "rgba(255,255,255,0.1)", color: ACC,
          fontSize: 24, fontWeight: 800, letterSpacing: 2,
        },
      }, s.icon + " " + s.badge),
      h("div", {
        style: {
          width: 14, height: 14, borderRadius: "50%", background: ACC,
          boxShadow: "0 0 18px " + ACC,
        },
      })
    ),
    s.stat ? h("div", {
      style: {
        display: "flex", alignItems: "baseline", gap: 22, marginTop: 8,
      },
    },
      h("div", {
        style: {
          fontFamily: FONT_NUM, fontSize: 108, fontWeight: 700, lineHeight: 1,
          color: ACC, textShadow: "0 6px 24px rgba(0,0,0,0.4)",
        },
      }, s.stat),
      h("div", {
        style: {
          fontSize: 36, fontWeight: 700, lineHeight: 1.25, color: "#f8fafc",
        },
      }, s.headline)
    ) : h("div", {
      style: {
        fontSize: 44, fontWeight: 800, lineHeight: 1.26, color: "#ffffff",
      },
    }, s.headline),
    h("div", {
      style: {
        fontSize: 28, fontWeight: 600, color: "rgba(255,255,255,0.75)",
        borderTop: "1.5px solid rgba(255,255,255,0.12)", paddingTop: 18,
        display: "flex", justifyContent: "space-between", alignItems: "center",
      },
    },
      h("span", null, s.subline),
      h("span", { style: { color: ACC, fontWeight: 800 } }, "● LIVE")
    )
  );
}

function KaraokeCard(props) {
  const t = props.t;
  let idx = -1;
  for (let i = 0; i < CHUNKS.length; i++) if (t >= CHUNKS[i].start) idx = i;
  if (idx < 0) return null;
  const c = CHUNKS[idx];
  const nextC = idx + 1 < CHUNKS.length ? CHUNKS[idx + 1] : null;
  const enter = easeOut((t - c.start) / 0.18);
  let active = 0;
  c.words.forEach((w, i) => { if (t >= w.s) active = i; });

  return h("div", {
    style: {
      position: "absolute", left: 64, top: 790, width: 952, height: 690, boxSizing: "border-box",
      borderRadius: 48, padding: "54px 44px",
      background: "rgba(5, 8, 17, 0.58)",
      border: "2.5px solid rgba(255,255,255,0.15)",
      boxShadow: "0 28px 70px rgba(0,0,0,0.5)",
      display: "flex", flexDirection: "column", justifyContent: "space-between", alignItems: "center",
      opacity: enter, transform: "translateY(" + ((1 - enter) * 26) + "px)",
    },
  },
    h("div", {
      style: {
        fontSize: 22, fontWeight: 800, letterSpacing: 4, color: "rgba(255,255,255,0.45)",
      },
    }, "NARASI UTAMA"),
    h("div", {
      style: {
        display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center",
        gap: "18px 22px", width: "100%",
      },
    },
      c.words.map((w, i) => {
        const isActive = i === active;
        const spoken = t >= w.s;
        const bounce = isActive ? 1 + 0.12 * Math.max(0, 1 - (t - w.s) / 0.18) : 1;
        return h("span", {
          key: idx + "-" + i,
          style: {
            fontSize: 82, fontWeight: 800, fontFamily: FONT_MAIN, lineHeight: 1.15,
            padding: isActive ? "10px 26px" : "10px 8px",
            borderRadius: 24,
            background: isActive ? ACC : "transparent",
            color: isActive ? "#090d16" : "#ffffff",
            opacity: spoken ? 1 : 0.32,
            transform: "scale(" + bounce + ")",
            boxShadow: isActive ? "0 12px 30px " + ACC + "66" : "none",
          },
        }, w.w);
      })
    ),
    h("div", {
      style: {
        minHeight: 44, fontSize: 30, fontWeight: 700, color: "rgba(255,255,255,0.38)",
        textAlign: "center",
      },
    }, nextC ? nextC.words.map((w) => w.w).join(" ") : "✓ Selesai")
  );
}

function BottomAudioDock(props) {
  const t = props.t;
  const speaking = isSpeaking(t);
  const pct = clamp(t / Math.max(DATA.duration, 0.1));
  const bars = Array.from({ length: 18 }).map((_, i) => {
    const wave = Math.abs(Math.sin(t * 13 + i * 0.7));
    const bh = speaking ? 12 + wave * 38 : 10;
    return h("div", {
      key: "bar-" + i,
      style: {
        width: 10, height: bh, borderRadius: 6,
        background: i % 2 === 0 ? ACC : "#ffffff",
        opacity: speaking ? 0.9 : 0.3,
      },
    });
  });

  return h("div", {
    style: {
      position: "absolute", left: 64, right: 64, bottom: 96,
      display: "flex", flexDirection: "column", gap: 22,
    },
  },
    h("div", {
      style: {
        display: "flex", justifyContent: "space-between", alignItems: "center",
        padding: "18px 28px", borderRadius: 28,
        background: "rgba(255,255,255,0.08)", border: "1.5px solid rgba(255,255,255,0.14)",
      },
    },
      h("div", {
        style: {
          fontSize: 24, fontWeight: 800, color: "#ffffff", letterSpacing: 1.5,
        },
      }, speaking ? "🎙️ AUDIO AKTIF" : "⏸️ JEDA NAPAS"),
      h("div", {
        style: {
          display: "flex", alignItems: "center", gap: 8, height: 50,
        },
      }, bars),
      h("div", {
        style: {
          fontFamily: FONT_NUM, fontSize: 26, fontWeight: 700, color: ACC,
        },
      }, Math.floor(t) + "s / " + Math.round(DATA.duration) + "s")
    ),
    h("div", {
      style: {
        width: "100%", height: 14, borderRadius: 999,
        background: "rgba(255,255,255,0.16)", overflow: "hidden",
      },
    },
      h("div", {
        style: {
          width: (pct * 100).toFixed(2) + "%", height: "100%",
          background: "linear-gradient(90deg, " + ACC + ", #ffffff)",
          borderRadius: 999,
        },
      })
    )
  );
}

function App(props) {
  return h("div", {
    style: {
      position: "relative", width: 1080, height: 1920,
      fontFamily: FONT_MAIN, color: "#fff", overflow: "hidden",
    },
  },
    h(Background, { t: props.t }),
    h(Header, { t: props.t }),
    h(VisualFocusCard, { t: props.t }),
    h(KaraokeCard, { t: props.t }),
    h(BottomAudioDock, { t: props.t })
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
function draw(t) {
  ReactDOM.flushSync(function () { root.render(h(App, { t: t })); });
}
</script></body></html>"""


def _extract_sentence_visual(sentence: str, idx: int, total: int) -> dict:
    """Bangun kartu visual otomatis dari isi tiap kalimat agar tiap adegan punya fokus visual berbeda."""
    clean = " ".join(sentence.strip().split())
    m_num = re.search(
        r"([0-9]+(?:[.,][0-9]+)?\s?(?:%|persen|juta|miliar|triliun|km|tahun|bulan|hari|jam|menit|detik|kali))",
        clean,
        re.I,
    )
    m_ord = re.match(r"^(Pertama|Kedua|Ketiga|Keempat|Kelima|Terakhir)[,:]?\s*(.+)$", clean, re.I)

    icons = ["💡", "⚙️", "🛡️", "📊", "🚀", "🔧", "📌", "✅"]
    icon = icons[idx % len(icons)]

    if idx == 0:
        badge = "PEMBUKA • HOOK"
    elif idx == total - 1 and total > 1:
        badge = "KESIMPULAN UTAMA"
    elif m_ord:
        badge = f"POIN {idx:02d} • {m_ord.group(1).upper()}"
    else:
        badge = f"POIN PENTING #{idx + 1}"

    body = m_ord.group(2).strip() if m_ord else clean
    words = body.split()
    headline = " ".join(words[:10]) + ("..." if len(words) > 10 else "")
    subline = " ".join(words[10:20]) + ("..." if len(words) > 20 else "")
    if not subline:
        subline = f"Bagian {idx + 1} dari {total} pembahasan"

    return {
        "icon": icon,
        "badge": badge,
        "stat": m_num.group(1).upper() if m_num else "",
        "headline": headline,
        "subline": subline,
    }


def make_page(title: str, words: list, duration: float, label: str = None, sentences_meta: list = None) -> str:
    palette = PALETTES[sum(ord(c) for c in title) % len(PALETTES)]
    data = {
        "title": title,
        "label": label or LABEL,
        "palette": list(palette),
        "duration": round(duration, 3),
        "words": words,
        "sentences": sentences_meta or [],
    }
    blob = json.dumps(data, ensure_ascii=False).replace("</", "<\/")
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

    words, sentences_meta, t0 = [], [], 0.0
    total_sent = len(sentences)
    for idx, (sentence, ac, marks) in enumerate(zip(sentences, clips, all_marks)):
        s_start = round(t0, 3)
        s_end = round(t0 + ac.duration, 3)
        vis = _extract_sentence_visual(sentence, idx, total_sent)
        sentences_meta.append({
            "start": s_start,
            "end": s_end,
            "text": sentence,
            **vis,
        })
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
    audio.set_duration(total).write_audiofile(str(mix), fps=44100, logger=None)

    html = make_page(item["title"], words, total, item.get("label"), sentences_meta=sentences_meta)
    out = js_video.render_html_to_mp4(html, total, mix, out_path, workdir)
    safe_export(item["title"], sentences, [c.duration for c in clips], all_marks, total, out)
    return out
  
