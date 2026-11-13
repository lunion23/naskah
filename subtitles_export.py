"""
Ekspor subtitle (.srt) dan file waktu (.json) untuk video yang dibuat bot.
Tanpa dependensi luar, dipakai oleh auto_shorts.py, termux_render.py, dan react_video.py.

Hasil ditulis di samping video: video.mp4 -> video.srt dan video.json
Semua waktu dihitung dari detik ke-0 video (suara dimulai di awal video).
"""

import json
from pathlib import Path

MAX_WORDS_PER_CUE = 6   # kata per baris subtitle SRT


def word_timings(sentence: str, marks, duration: float):
    """[(kata, mulai, selesai)] relatif awal kalimat. Pakai penanda TTS bila jumlahnya cocok, jika tidak dibagi menurut panjang kata."""
    words = sentence.split()
    if not words:
        return []
    if len(marks) == len(words):
        starts = [m[0] for m in marks]
    else:
        weights = [len(w) + 2 for w in words]
        total_w, acc, starts = sum(weights), 0.0, []
        for w in weights:
            starts.append(duration * acc / total_w)
            acc += w
    starts = [min(s, max(duration - 0.05, 0)) for s in starts]
    out = []
    for i, w in enumerate(words):
        end = starts[i + 1] if i + 1 < len(words) else duration
        out.append((w, starts[i], max(end, starts[i] + 0.05)))
    return out


def srt_time(sec: float) -> str:
    ms = max(int(round(sec * 1000)), 0)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def build_timeline(sentences, durations, all_marks):
    """Daftar kalimat dengan waktu absolut: [{teks, mulai, selesai, kata:[{kata, mulai, selesai}]}]."""
    out, t0 = [], 0.0
    for sentence, dur, marks in zip(sentences, durations, all_marks):
        words = [
            {"kata": w, "mulai": round(t0 + a, 3), "selesai": round(t0 + b, 3)}
            for w, a, b in word_timings(sentence, marks, dur)
        ]
        out.append({
            "teks": sentence,
            "mulai": round(t0, 3),
            "selesai": round(t0 + dur, 3),
            "kata": words,
        })
        t0 += dur
    return out


def build_cues(timeline):
    """Bagi tiap kalimat jadi baris SRT berukuran seimbang (maks MAX_WORDS_PER_CUE kata), tanpa baris yatim."""
    groups = []
    for sent in timeline:
        ws = sent["kata"]
        if not ws:
            continue
        n = -(-len(ws) // MAX_WORDS_PER_CUE)      # jumlah baris untuk kalimat ini
        size = -(-len(ws) // n)                    # kata per baris (seimbang)
        groups.extend(ws[i:i + size] for i in range(0, len(ws), size))

    out = []
    for i, ws in enumerate(groups):
        start = ws[0]["mulai"]
        end = max(ws[-1]["selesai"], start + 0.3)
        if i + 1 < len(groups):
            nxt = groups[i + 1][0]["mulai"]
            if nxt > start:
                end = min(end, nxt)
        out.append((start, end, " ".join(x["kata"] for x in ws)))
    return out


def export_subtitles(title, sentences, durations, all_marks, total, video_path):
    """Tulis video.srt dan video.json di samping video. Mengembalikan (path_srt, path_json)."""
    video_path = Path(video_path)
    timeline = build_timeline(sentences, durations, all_marks)
    cues = build_cues(timeline)

    srt_path = video_path.with_suffix(".srt")
    with open(srt_path, "w", encoding="utf-8") as f:
        for n, (a, b, text) in enumerate(cues, 1):
            f.write(f"{n}\n{srt_time(a)} --> {srt_time(b)}\n{text}\n\n")

    json_path = video_path.with_suffix(".json")
    data = {
        "judul": title,
        "durasi_detik": round(total, 3),
        "durasi": srt_time(total).replace(",", "."),
        "jumlah_kalimat": len(timeline),
        "jumlah_kata": sum(len(s["kata"]) for s in timeline),
        "file_video": video_path.name,
        "file_srt": srt_path.name,
        "kalimat": [
            {**s, "tc_mulai": srt_time(s["mulai"]), "tc_selesai": srt_time(s["selesai"])} for s in timeline
        ],
    }
    json_path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
    return srt_path, json_path


def safe_export(title, sentences, durations, all_marks, total, video_path):
    """Seperti export_subtitles, tetapi tidak pernah menggagalkan pembuatan video."""
    try:
        paths = export_subtitles(title, sentences, durations, all_marks, total, video_path)
        print(f"• Subtitle dan waktu: {paths[0].name}, {paths[1].name}")
        return paths
    except Exception as e:
        print(f"[!] Gagal membuat SRT/JSON: {e}")
        return None
