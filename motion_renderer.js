// motion_renderer.js v12 — Mesin Animasi Gaya Editorial Guru / Presenter (1080x1920)
// Terinspirasi gaya kartu 2-panel (Visual Atas + Kartu Teks Teleprompter Tengah + Karakter Berpindah Sisi di Bawah)

function roundRect(x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function wrapLines(text, maxWidth) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  let line = '', lines = [];
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawWrappedText(text, x, y, maxWidth, lineHeight) {
  const lines = wrapLines(text, maxWidth);
  lines.forEach((l, i) => ctx.fillText(l, x, y + i * lineHeight));
  return lines.length;
}

function isSpeakingAt(t) {
  if (!window.SUBTITLES || !window.SUBTITLES.length) return true;
  for (const s of window.SUBTITLES) {
    if (t >= s.start && t <= s.end) {
      if (!s.words || !s.words.length) return true;
      return s.words.some(w => t >= w.start - 0.04 && t <= w.end + 0.04);
    }
  }
  return false;
}

function getSpeechEnergy(t) {
  if (!isSpeakingAt(t)) return 0.12;
  return 0.35 + Math.abs(Math.sin(t * 14)) * 0.45 + Math.abs(Math.cos(t * 23)) * 0.2;
}

// Latar gradien hangat & bersih (Krem Atas -> Biru Muda Lembut Bawah)
function drawEditorialBackground(theme, t) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  if (theme === 'mint') {
    g.addColorStop(0, '#F5FBF8');
    g.addColorStop(0.55, '#ECF7F3');
    g.addColorStop(1, '#D8EFEA');
  } else if (theme === 'lavender') {
    g.addColorStop(0, '#F9F6FE');
    g.addColorStop(0.55, '#F2ECFC');
    g.addColorStop(1, '#E2DCF5');
  } else {
    g.addColorStop(0, '#FAF7EE');
    g.addColorStop(0.55, '#F4F3EC');
    g.addColorStop(1, '#DCEAF2');
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Grid titik halus editorial
  ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
  for (let gx = 60; gx < W; gx += 64) {
    for (let gy = 60; gy < H; gy += 64) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Header Atas (Kiri: Kategori Video, Kanan: Badge Poin Aktif)
function drawTopHeader(data, index) {
  const cat = String(window.CHANNEL_LABEL || data.channel || 'EDUKASI PINTAR').toUpperCase();
  const badge = String(data.badge || `POIN 0${index + 1}`).toUpperCase();

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 28px Montserrat, sans-serif';
  ctx.fillText('▶  ' + cat, 70, 96);

  ctx.font = '900 24px Montserrat, sans-serif';
  const bw = Math.min(Math.max(ctx.measureText(badge).width + 52, 210), 420);
  const bx = W - 70 - bw, by = 62, bh = 50;
  roundRect(bx, by, bw, bh, 25);
  ctx.fillStyle = '#EA580C';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badge, bx + bw / 2, by + 33);
}

// Bingkai Panel Neo-Brutalist Putih dengan Shadow Hitam Tebal
function drawPanelCard(x, y, w, h, radius = 26) {
  roundRect(x + 8, y + 10, w, h, radius);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  roundRect(x, y, w, h, radius);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();
}

// =========================================================================
// PANEL ATAS (Y: 165 .. 715, Tinggi 550px) — 6 TIPE VISUAL INFOGRAFIS
// =========================================================================

// 1. CHAT BUBBLE ("chat_hook") — Gelembung Komentar Netizen vs Balasan Biru
function renderTopChatHook(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  // Header panel
  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 28px Montserrat, sans-serif';
  ctx.fillText('💬  ' + (data.header || 'Komentar Netizen vs Fakta'), px + 36, py + 58);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(px + 32, py + 82); ctx.lineTo(px + pw - 32, py + 82); ctx.stroke();

  // Bubble 1 (Kiri Abu-abu - Pertanyaan/Mitos)
  const b1 = easeOutBack(Math.min(p * 3.5, 1));
  ctx.save();
  ctx.translate(px + 38, py + 115);
  ctx.scale(b1, b1);
  roundRect(0, 0, pw - 210, 155, 22);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.fillStyle = '#0F172A';
  ctx.font = '700 31px Montserrat, sans-serif';
  drawWrappedText(data.question || 'Katanya bikin video animasi itu susah dan butuh PC mahal...', 28, 52, pw - 265, 44);
  ctx.restore();

  // Bubble 2 (Kanan Biru - Balasan Presenter)
  if (p > 0.35) {
    const b2 = easeOutBack(Math.min((p - 0.35) * 3.5, 1));
    const b2w = pw - 210;
    ctx.save();
    ctx.translate(px + pw - 38, py + 305);
    ctx.scale(b2, b2);
    roundRect(-b2w, 0, b2w, 155, 22);
    ctx.fillStyle = '#2563EB';
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 31px Montserrat, sans-serif';
    drawWrappedText(data.reply || 'Masa sih?! 🤯 Coba kita bedah faktanya!', -b2w + 28, 52, b2w - 56, 44);
    ctx.restore();
  }
}

// 2. LINE CHART ("line_chart") — Grafik Garis 2 Kurva + Label + Banner Bawah
function renderTopLineChart(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  // Pill judul oranye kiri & subjudul kanan
  const pill = String(data.pill || '01 • PERKEMBANGAN').toUpperCase();
  roundRect(px + 30, py + 28, 360, 44, 12);
  ctx.fillStyle = '#EA580C';
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 210, py + 57);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1E3A8A';
  ctx.font = '800 25px Montserrat, sans-serif';
  ctx.fillText(data.right_label || 'Tren vs Standar', px + pw - 34, py + 58);

  // Area Grafik
  const gx = px + 40, gy = py + 95, gw = pw - 80, gh = 325;
  roundRect(gx, gy, gw, gh, 16);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Garis grid horizontal
  for (let i = 1; i <= 3; i++) {
    const ly = gy + (gh / 4) * i;
    ctx.beginPath(); ctx.moveTo(gx + 16, ly); ctx.lineTo(gx + gw - 16, ly); ctx.stroke();
  }

  const drawProg = easeOutCubic(Math.min(p * 1.6, 1));
  const startX = gx + 36, endX = gx + gw - 36;
  const curEndX = startX + (endX - startX) * drawProg;

  // Kurva Bawah (Biru Putus-putus - Lambat)
  ctx.save();
  ctx.setLineDash([12, 8]);
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(startX, gy + gh - 45);
  ctx.quadraticCurveTo(gx + gw * 0.5, gy + gh - 68, curEndX, gy + gh - 95 * drawProg - 45 * (1 - drawProg));
  ctx.stroke();
  ctx.restore();

  // Kurva Atas (Oranye Tebal dengan Area Gradien - Melesat)
  const topEndY = gy + 55;
  const topStartY = gy + gh - 50;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(startX, topStartY);
  const steps = 40;
  const maxStep = Math.max(1, Math.floor(steps * drawProg));
  let lastX = startX, lastY = topStartY;
  for (let s = 1; s <= maxStep; s++) {
    const u = s / steps;
    lastX = startX + (endX - startX) * u;
    lastY = topStartY - (topStartY - topEndY) * Math.pow(u, 1.45);
    ctx.lineTo(lastX, lastY);
  }
  ctx.strokeStyle = '#F97316';
  ctx.lineWidth = 7;
  ctx.stroke();

  // Area lembut di bawah kurva oranye
  ctx.lineTo(lastX, gy + gh - 12);
  ctx.lineTo(startX, gy + gh - 12);
  ctx.closePath();
  const ag = ctx.createLinearGradient(0, gy, 0, gy + gh);
  ag.addColorStop(0, 'rgba(249, 115, 22, 0.25)');
  ag.addColorStop(1, 'rgba(249, 115, 22, 0.02)');
  ctx.fillStyle = ag;
  ctx.fill();

  // Titik akhir + Label Kurva Atas & Bawah
  ctx.beginPath(); ctx.arc(lastX, lastY, 10, 0, Math.PI * 2);
  ctx.fillStyle = '#F97316'; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  ctx.restore();

  // Badge label atas kanan
  roundRect(gx + gw - 315, gy + 18, 295, 42, 10);
  ctx.fillStyle = '#DCFCE7'; ctx.fill();
  ctx.strokeStyle = '#16A34A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#15803D';
  ctx.font = '800 20px Montserrat, sans-serif';
  ctx.fillText(data.top_tag || 'Standar Industri Melesat 🚀', gx + gw - 167, gy + 46);

  // Badge label bawah kiri
  roundRect(gx + 22, gy + gh - 66, 285, 42, 10);
  ctx.fillStyle = '#FEF3C7'; ctx.fill();
  ctx.strokeStyle = '#D97706'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#B45309';
  ctx.font = '800 20px Montserrat, sans-serif';
  ctx.fillText(data.bot_tag || 'Cara Lama Tertinggal 🐢', gx + 164, gy + gh - 38);

  // Banner kesimpulan bawah panel
  roundRect(gx, py + 440, gw, 72, 14);
  ctx.fillStyle = '#F8FAFC'; ctx.fill();
  ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 26px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Perubahan Berjalan Cepat Tiap Tahun!', W / 2, py + 485);
}

// 3. TWO CARDS ("two_cards") — Perbandingan 2 Kartu Kiri vs Kanan (dengan Highlight Aktif)
function renderTopTwoCards(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  const pill = String(data.pill || '02 • PERBANDINGAN').toUpperCase();
  roundRect(px + 30, py + 28, 360, 44, 12);
  ctx.fillStyle = '#EA580C'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 210, py + 57);

  const cards = [
    {
      icon: data.left_icon || '✅',
      title: data.left_title || 'HARD SKILL',
      desc: data.left_desc || 'Jago Secara Teknis',
      active: p < 0.5,
      color: '#16A34A',
      bg: '#F0FDF4'
    },
    {
      icon: data.right_icon || '❗',
      title: data.right_title || 'SOFT SKILL',
      desc: data.right_desc || 'Sering Lupa Dikembangkan!',
      active: p >= 0.5,
      color: '#EA580C',
      bg: '#FFF7ED'
    }
  ];

  const cw = (pw - 110) / 2, ch = 315, cy = py + 98;
  cards.forEach((c, i) => {
    const cx = px + 38 + i * (cw + 34);
    ctx.save();
    ctx.globalAlpha = c.active ? 1.0 : 0.48;
    roundRect(cx, cy, cw, ch, 18);
    ctx.fillStyle = c.active ? c.bg : '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = c.active ? 4.5 : 2.5;
    ctx.strokeStyle = c.active ? c.color : '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '72px sans-serif';
    ctx.fillText(c.icon, cx + cw / 2, cy + 125);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 30px Montserrat, sans-serif';
    ctx.fillText(String(c.title).toUpperCase(), cx + cw / 2, cy + 195);

    ctx.fillStyle = '#475569';
    ctx.font = '700 23px Montserrat, sans-serif';
    drawWrappedText(c.desc, cx + cw / 2, cy + 238, cw - 36, 32);
    ctx.restore();
  });

  roundRect(px + 38, py + 438, pw - 76, 74, 14);
  ctx.fillStyle = '#FEFCE8'; ctx.fill();
  ctx.strokeStyle = '#EAB308'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 26px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Keduanya Harus Seimbang Agar Sukses!', W / 2, py + 484);
}

// 4. THREE CARDS ("three_cards") — 3 Kartu Berjajar dengan Highlight Bergantian
function renderTopThreeCards(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  const pill = String(data.pill || '3 PILAR UTAMA').toUpperCase();
  roundRect(px + 30, py + 28, 380, 44, 12);
  ctx.fillStyle = '#1E3A8A'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 220, py + 57);

  const items = (data.cards || [
    { icon: '💬', title: 'Komunikasi', desc: 'Bicara Jelas & Efektif' },
    { icon: '🔄', title: 'Adaptasi', desc: 'Cepat Belajar Hal Baru' },
    { icon: '🤝', title: 'Kerja Tim', desc: 'Mudah Diajak Kolaborasi' }
  ]).slice(0, 3);

  const activeIdx = Math.min(2, Math.floor(p * 3));
  const gap = 22, cw = (pw - 76 - gap * 2) / 3, ch = 315, cy = py + 98;

  items.forEach((it, i) => {
    const isAct = i === activeIdx;
    const cx = px + 38 + i * (cw + gap);
    const title = typeof it === 'string' ? it : it.title;
    const desc = typeof it === 'string' ? '' : (it.desc || '');
    const icon = (typeof it === 'object' && it.icon) ? it.icon : (data.icons?.[i] || ['💬', '🔄', '🤝'][i]);

    ctx.save();
    ctx.globalAlpha = isAct ? 1.0 : 0.55;
    roundRect(cx, cy, cw, ch, 18);
    ctx.fillStyle = isAct ? '#EFF6FF' : '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = isAct ? 4.5 : 2.5;
    ctx.strokeStyle = isAct ? '#2563EB' : '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '64px sans-serif';
    ctx.fillText(icon, cx + cw / 2, cy + 115);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 26px Montserrat, sans-serif';
    ctx.fillText(title, cx + cw / 2, cy + 185);

    ctx.fillStyle = '#475569';
    ctx.font = '700 21px Montserrat, sans-serif';
    drawWrappedText(desc, cx + cw / 2, cy + 228, cw - 24, 28);
    ctx.restore();
  });

  roundRect(px + 38, py + 438, pw - 76, 74, 14);
  ctx.fillStyle = '#FEFCE8'; ctx.fill();
  ctx.strokeStyle = '#EAB308'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 25px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Tiga Kemampuan Ini Nilainya Sangat Mahal!', W / 2, py + 484);
}

// 5. CHECKLIST ("checklist") — Daftar Langkah Tercentang Satu per Satu
function renderTopChecklist(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  const pill = String(data.pill || 'SOLUSI SIMPEL & NYATA').toUpperCase();
  roundRect(px + 30, py + 28, 380, 44, 12);
  ctx.fillStyle = '#EA580C'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 220, py + 57);

  const steps = (data.steps || [
    'Jangan Cuma Mengandalkan Teori',
    'Update Terus Skill & Praktik Langsung',
    'Aktif Ikut Komunitas & Diskusi',
    'Perbanyak Portofolio Karya Nyata!'
  ]).slice(0, 4);

  const doneCount = Math.min(steps.length, Math.floor(p * (steps.length + 0.6)));
  steps.forEach((st, i) => {
    const ry = py + 98 + i * 102;
    const isDone = i < doneCount;
    const isCurrent = i === doneCount;

    roundRect(px + 36, ry, pw - 72, 84, 14);
    ctx.fillStyle = isDone ? '#ECFDF5' : (isCurrent ? '#FFF7ED' : '#F8FAFC');
    ctx.fill();
    ctx.lineWidth = (isDone || isCurrent) ? 3.5 : 2;
    ctx.strokeStyle = isDone ? '#10B981' : (isCurrent ? '#F97316' : '#CBD5E1');
    ctx.stroke();

    // Kotak nomor / centang
    roundRect(px + 54, ry + 18, 48, 48, 10);
    ctx.fillStyle = isDone ? '#10B981' : (isCurrent ? '#F97316' : '#E2E8F0');
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = (isDone || isCurrent) ? '#FFFFFF' : '#475569';
    ctx.font = '900 26px Montserrat, sans-serif';
    ctx.fillText(isDone ? '✓' : String(i + 1), px + 78, ry + 51);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 28px Montserrat, sans-serif';
    ctx.fillText(st, px + 124, ry + 52);
  });
}

// 6. CTA CARD ("cta_closing") — Kartu Ajakan Bertindak di Atas
function renderTopCtaCard(data, p, t) {
  const px = 70, py = 165, pw = W - 140, ph = 545;
  drawPanelCard(px, py, pw, ph, 26);

  roundRect(W / 2 - 180, py + 32, 360, 42, 21);
  ctx.fillStyle = '#E2E8F0'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 21px Montserrat, sans-serif';
  ctx.fillText(String(data.pill || 'SAATNYA BUKTIKAN!').toUpperCase(), W / 2, py + 59);

  // Bintang ikon tengah
  const starScale = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.translate(W / 2, py + 175);
  ctx.scale(starScale, starScale);
  ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF3C7'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.font = '58px sans-serif';
  ctx.fillText(data.icon || '⭐', 0, 20);
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 42px Montserrat, sans-serif';
  drawWrappedText(data.headline || 'Kamu Pasti Bisa Berkualitas!', W / 2, py + 305, pw - 90, 52);

  const pulse = 1 + Math.sin(t * 5) * 0.025;
  ctx.save();
  ctx.translate(W / 2, py + 448);
  ctx.scale(pulse, pulse);
  roundRect(-(pw - 110) / 2, -38, pw - 110, 76, 16);
  ctx.fillStyle = '#F97316'; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 27px Montserrat, sans-serif';
  ctx.fillText(data.subheadline || 'Next Bahas Apa Lagi? Tulis di Komentar Bawah!', 0, 10);
  ctx.restore();
}

// =========================================================================
// PANEL TENGAH (Y: 755 .. 1255, Tinggi 500px) — KARTU NARASI TELEPROMPTER + EQUALIZER
// =========================================================================
function renderTeleprompterCard(scene, t, data) {
  const px = 70, py = 755, pw = W - 140, ph = 490;
  drawPanelCard(px, py, pw, ph, 26);

  // Label narator kecil di atas tengah kartu
  const speakerLabel = String(window.SPEAKER_LABEL || data.speaker_label || '🎙️ NARASI PENJELASAN').toUpperCase();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(speakerLabel, W / 2, py + 54);

  // Cari kalimat & kata aktif dari window.SUBTITLES
  const curSub = (window.SUBTITLES || []).find(s => t >= s.start && t < s.end) || null;
  const words = curSub && curSub.words ? curSub.words : [];

  if (words.length) {
    let activeIdx = words.findIndex(w => t >= w.start && t <= w.end);
    if (activeIdx < 0) {
      for (let i = words.length - 1; i >= 0; i--) {
        if (t >= words[i].start) { activeIdx = i; break; }
      }
      if (activeIdx < 0) activeIdx = 0;
    }

    // Tampilkan maksimal 7 kata per halaman agar besar, lega & mudah dibaca
    const pageSize = 7;
    const pageStart = Math.floor(activeIdx / pageSize) * pageSize;
    const slice = words.slice(pageStart, pageStart + pageSize);

    ctx.font = '800 52px Montserrat, sans-serif';
    const maxLineW = pw - 110;
    const lines = [];
    let curLine = [], curW = 0;
    const spaceW = 20;

    slice.forEach((wObj, idx) => {
      const globalI = pageStart + idx;
      const isAct = globalI === activeIdx;
      const wText = wObj.text;
      const boxW = ctx.measureText(wText).width + (isAct ? 28 : 4);
      if (curLine.length && curW + spaceW + boxW > maxLineW) {
        lines.push({ items: curLine, width: curW });
        curLine = [{ text: wText, isAct, boxW }];
        curW = boxW;
      } else {
        curLine.push({ text: wText, isAct, boxW });
        curW += (curLine.length > 1 ? spaceW : 0) + boxW;
      }
    });
    if (curLine.length) lines.push({ items: curLine, width: curW });

    const lineH = 82;
    const startY = py + 235 - ((lines.length - 1) * lineH) / 2;

    lines.forEach((ln, li) => {
      let drawX = W / 2 - ln.width / 2;
      const drawY = startY + li * lineH;
      ln.items.forEach(item => {
        if (item.isAct) {
          // Kotak sorotan oranye-kuning dengan outline hitam pada kata yang sedang diucapkan!
          roundRect(drawX, drawY - 52, item.boxW, 70, 14);
          ctx.fillStyle = '#F97316';
          ctx.fill();
          ctx.lineWidth = 3.5;
          ctx.strokeStyle = '#0F172A';
          ctx.stroke();

          ctx.textAlign = 'center';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(item.text, drawX + item.boxW / 2, drawY);
        } else {
          ctx.textAlign = 'center';
          ctx.fillStyle = '#0F172A';
          ctx.fillText(item.text, drawX + item.boxW / 2, drawY);
        }
        drawX += item.boxW + spaceW;
      });
    });
  } else {
    // Fallback jika tanpa timestamps kata
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 44px Montserrat, sans-serif';
    drawWrappedText(scene.narration || '', W / 2, py + 210, pw - 110, 62);
  }

  // Audio Visualizer / Equalizer Bar animasi di bagian bawah kartu tengah
  const barsCount = 15;
  const barW = 10, barGap = 14;
  const totalEqW = barsCount * barW + (barsCount - 1) * barGap;
  const eqStartX = W / 2 - totalEqW / 2;
  const eqCenterY = py + ph - 52;
  const energy = getSpeechEnergy(t);
  const eqColors = ['#F97316', '#3B82F6', '#0F172A', '#FACC15'];

  for (let b = 0; b < barsCount; b++) {
    const wave = Math.abs(Math.sin(t * 11 + b * 0.75));
    const bh = 8 + wave * 34 * energy;
    roundRect(eqStartX + b * (barW + barGap), eqCenterY - bh / 2, barW, bh, 5);
    ctx.fillStyle = eqColors[b % eqColors.length];
    ctx.fill();
  }
}

// =========================================================================
// KARAKTER PRESENTER BAWAH (Y: 1320 .. 1920) — BERPINDAH KIRI / KANAN + 5 GESTUR
// =========================================================================
function drawHandPalm(x, y, rot, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#F7C9A9';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4.5;
  for (let f = -2; f <= 2; f++) {
    ctx.save();
    ctx.rotate(f * 0.22);
    roundRect(-3.8, -20, 7.6, 20, 3.8);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 2, 15, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPointingHand(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#F7C9A9';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4.5;
  roundRect(-5, -28, 10, 26, 5);
  ctx.fill(); ctx.stroke();
  roundRect(-14, -6, 28, 22, 10);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawThumbsUpHand(x, y, rot) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.fillStyle = '#F7C9A9';
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4.5;
  roundRect(-5, -26, 11, 22, 5.5);
  ctx.fill(); ctx.stroke();
  roundRect(-14, -6, 28, 24, 10);
  ctx.fill(); ctx.stroke();
  ctx.restore();
}

function drawPresenterHalfBody(t, p, speaking, blinking, side, gestureOverride) {
  // 5 Mode Gestur Ekspresif:
  // 0: Wave (Melambai ramah)
  // 1: Thinking (Tangan di dagu + tanda tanya ?)
  // 2: Pointing Up (Menunjuk ke panel info di atas)
  // 3: Open Hands Surprise (Kedua tangan terbuka + tanda seru !!)
  // 4: Thumbs Up (Jempol mantap)
  const autoGesture = Math.floor(t / 2.4) % 5;
  const gMode = typeof gestureOverride === 'number' ? gestureOverride : autoGesture;

  const bobY = Math.sin(t * (speaking ? 6.5 : 2.6)) * 5;
  const headTilt = speaking ? Math.sin(t * 5) * 0.03 : Math.sin(t * 2) * 0.015;

  ctx.save();
  ctx.translate(0, bobY);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0F172A';

  // --- Badan Kemeja Biru Formal + Lanyard ID Card (gaya presenter edukasi) ---
  roundRect(-115, 45, 230, 260, 44);
  ctx.fillStyle = '#1E40AF';
  ctx.fill(); ctx.stroke();

  // Kerah kemeja
  ctx.fillStyle = '#1D4ED8';
  ctx.beginPath();
  ctx.moveTo(-42, 42); ctx.lineTo(0, 92); ctx.lineTo(-55, 112); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(42, 42); ctx.lineTo(0, 92); ctx.lineTo(55, 112); ctx.closePath();
  ctx.fill(); ctx.stroke();

  // Garis kancing tengah
  ctx.beginPath(); ctx.moveTo(0, 92); ctx.lineTo(0, 290); ctx.stroke();

  // Tali Lanyard + Kartu ID di dada
  ctx.strokeStyle = '#38BDF8';
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.moveTo(-46, 46); ctx.lineTo(-18, 175);
  ctx.moveTo(46, 46); ctx.lineTo(18, 175);
  ctx.stroke();
  ctx.strokeStyle = '#0F172A';
  ctx.lineWidth = 4;
  roundRect(-24, 175, 48, 62, 8);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill(); ctx.stroke();
  roundRect(-16, 186, 32, 12, 4);
  ctx.fillStyle = '#2563EB';
  ctx.fill();

  // --- Leher & Kepala ---
  ctx.save();
  ctx.rotate(headTilt);
  roundRect(-24, 6, 48, 46, 12);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Telinga
  ctx.beginPath(); ctx.arc(-108, -96, 20, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(108, -96, 20, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();

  // Wajah
  ctx.beginPath();
  ctx.ellipse(0, -104, 104, 102, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Rambut Hitam Rapi Belah Samping
  ctx.beginPath();
  ctx.moveTo(-104, -110);
  ctx.quadraticCurveTo(-116, -195, -45, -214);
  ctx.quadraticCurveTo(25, -225, 85, -196);
  ctx.quadraticCurveTo(116, -165, 104, -108);
  ctx.quadraticCurveTo(86, -155, 42, -162);
  ctx.lineTo(18, -145);
  ctx.lineTo(0, -165);
  ctx.lineTo(-35, -145);
  ctx.quadraticCurveTo(-78, -155, -104, -110);
  ctx.closePath();
  ctx.fillStyle = '#1E2430';
  ctx.fill(); ctx.stroke();

  // Alis
  const browY = gMode === 3 ? -144 : (speaking ? -138 : -134);
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(-44, browY, 18, Math.PI + 0.3, -0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(44, browY, 18, Math.PI + 0.3, -0.3); ctx.stroke();

  // Mata + Kacamata Persegi Modern
  if (blinking) {
    ctx.beginPath(); ctx.moveTo(-62, -104); ctx.lineTo(-26, -104); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(26, -104); ctx.lineTo(62, -104); ctx.stroke();
  } else {
    [-44, 44].forEach(ex => {
      ctx.beginPath(); ctx.ellipse(ex, -104, 14, 17, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#0F172A'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 4, -110, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
    });
  }

  // Bingkai Kacamata
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  roundRect(-76, -128, 64, 46, 12); ctx.stroke();
  roundRect(12, -128, 64, 46, 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -106); ctx.lineTo(12, -106); ctx.stroke();

  // Rona pipi
  ctx.fillStyle = 'rgba(244, 114, 114, 0.38)';
  ctx.beginPath(); ctx.ellipse(-64, -76, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64, -76, 15, 9, 0, 0, Math.PI * 2); ctx.fill();

  // Mulut Lip-Sync
  ctx.lineWidth = 5;
  if (gMode === 1) {
    // Sedang berpikir (mulut miring berpikir)
    ctx.beginPath(); ctx.moveTo(-16, -54); ctx.quadraticCurveTo(0, -60, 18, -50); ctx.stroke();
  } else if (speaking) {
    const openH = 8 + Math.abs(Math.sin(t * 18)) * 14;
    ctx.fillStyle = '#B8324F';
    ctx.beginPath();
    ctx.ellipse(0, -54, 20, openH, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(0, -62, 20, 0.2, Math.PI - 0.2); ctx.stroke();
  }

  // Simbol Emosi Melayang di Samping Kepala (? atau !!)
  if (gMode === 1) {
    ctx.save();
    ctx.translate(125, -175 + Math.sin(t * 4) * 6);
    ctx.fillStyle = '#2563EB';
    ctx.font = '900 58px Montserrat, sans-serif';
    ctx.fillText('?', 0, 0);
    ctx.restore();
  } else if (gMode === 3) {
    ctx.save();
    ctx.translate(125, -175 + Math.sin(t * 7) * 6);
    ctx.rotate(0.18);
    ctx.fillStyle = '#EA580C';
    ctx.font = '900 58px Montserrat, sans-serif';
    ctx.fillText('!!', 0, 0);
    ctx.restore();
  }
  ctx.restore();

  // --- LENGAN & GESTUR TANGAN EKSPRESIF ---
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  if (gMode === 0) {
    // 0: Melambai ramah dengan tangan kanan
    ctx.save();
    ctx.translate(-112, 85);
    ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(112, 80);
    ctx.rotate(-2.35 + Math.sin(t * 7.5) * 0.24);
    roundRect(-18, 0, 36, 118, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 134, Math.PI, 1.35);
    ctx.restore();
  } else if (gMode === 1) {
    // 1: Pose berpikir (tangan kanan menopang dagu)
    ctx.save();
    ctx.translate(-112, 85);
    ctx.rotate(0.32);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(105, 85);
    ctx.rotate(-2.55);
    roundRect(-18, 0, 36, 115, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI - 0.3, 1.25);
    ctx.restore();
  } else if (gMode === 2) {
    // 2: Menunjuk ke arah panel informasi di atas
    ctx.save();
    ctx.translate(-112, 85);
    ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(110, 80);
    ctx.rotate(-2.45 + Math.sin(t * 7) * 0.14);
    roundRect(-18, 0, 36, 118, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawPointingHand(0, 136, Math.PI);
    ctx.restore();
  } else if (gMode === 3) {
    // 3: Kedua tangan terbuka lebar (antusias menjelaskan)
    ctx.save();
    ctx.translate(-110, 82);
    ctx.rotate(2.25 + Math.sin(t * 7) * 0.16);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI, 1.3);
    ctx.restore();

    ctx.save();
    ctx.translate(110, 82);
    ctx.rotate(-2.25 - Math.sin(t * 7) * 0.16);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI, 1.3);
    ctx.restore();
  } else {
    // 4: Jempol mantap (Thumbs Up)
    ctx.save();
    ctx.translate(-112, 85);
    ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(110, 82);
    ctx.rotate(-1.85 + Math.sin(t * 6) * 0.14);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = '#1E40AF'; ctx.fill(); ctx.stroke();
    drawThumbsUpHand(0, 128, Math.PI + 0.35);
    ctx.restore();
  }

  ctx.restore();
}

// Progress Bar Atas Tipis
function drawTopProgressBar(t, pal) {
  const totalDur = window.SCENES.length ? window.SCENES[window.SCENES.length - 1].end : 1;
  const p = Math.min(Math.max(t / Math.max(totalDur, 0.1), 0), 1);
  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.fillRect(0, 0, W, 10);
  ctx.fillStyle = '#EA580C';
  ctx.fillRect(0, 0, W * p, 10);
}

// =========================================================================
// MAIN DRAW LOOP
// =========================================================================
function draw(t) {
  const active = getActiveScene(t);
  if (!active) return;
  const { index, scene, localT, progress } = active;
  const data = scene.data || {};
  const speaking = isSpeakingAt(t);
  const blinking = (t % 3.5) > 3.34;

  // 1. Latar gradien cerah editorial
  drawEditorialBackground(scene.theme || 'cream', t);

  // 2. Header kategori & badge poin
  drawTopHeader(data, index);

  // 3. Panel Atas (Visual Infografis sesuai tipe adegan)
  const enterT = Math.min(localT / 0.25, 1);
  ctx.save();
  ctx.globalAlpha = enterT;
  switch (scene.type) {
    case 'chat_hook':
      renderTopChatHook(data, progress, t);
      break;
    case 'line_chart':
    case 'bar_chart':
      renderTopLineChart(data, progress, t);
      break;
    case 'two_cards':
    case 'comparison_vs':
      renderTopTwoCards(data, progress, t);
      break;
    case 'three_cards':
      renderTopThreeCards(data, progress, t);
      break;
    case 'checklist':
    case 'flow_diagram':
      renderTopChecklist(data, progress, t);
      break;
    case 'cta_closing':
      renderTopCtaCard(data, progress, t);
      break;
    default:
      renderTopChatHook(data, progress, t);
      break;
  }
  ctx.restore();

  // 4. Panel Tengah: Kartu Teleprompter Kata-per-Kata + Audio Equalizer
  renderTeleprompterCard(scene, t, data);

  // 5. Karakter Presenter di Bawah (Berpindah Kiri <-> Kanan secara dinamis)
  const side = data.side || (index % 2 === 0 ? 'center' : (index % 4 === 1 ? 'right' : 'left'));
  const targetX = side === 'left' ? 270 : (side === 'right' ? W - 270 : W / 2);
  ctx.save();
  ctx.translate(targetX, 1625);
  ctx.scale(1.18, 1.18);
  drawPresenterHalfBody(t, progress, speaking, blinking, side, data.gesture);
  ctx.restore();

  // 6. Progress Bar Waktu
  drawTopProgressBar(t);
}
