// motion_renderer.js v8 — Mesin Animasi Infografis & Karakter 2D Cerah & Modern (1080x1920)
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

// Palet warna berdasarkan tema (cerah sebagai default, tetap dukung dark/sunset)
function getPalette(theme) {
  if (theme === 'dark' || theme === 'sunset') {
    return {
      isDark: true,
      bgTop: '#122b59',
      bgBot: '#050b1a',
      ink: '#FFFFFF',
      subInk: '#DCE8FF',
      mutedInk: '#9BB8ED',
      accent: '#FFD600',
      accentAlt: '#F5B82E',
      accentText: '#111111',
      cardBg: 'rgba(13, 28, 60, 0.94)',
      cardBorder: '#FFD600',
      gridColor: 'rgba(90, 145, 255, 0.16)',
      blobA: 'rgba(72, 138, 255, 0.16)',
      blobB: 'rgba(255, 214, 0, 0.10)',
    };
  }
  if (theme === 'mint') {
    return {
      isDark: false,
      bgTop: '#ECFDF5',
      bgBot: '#CFFAFE',
      ink: '#0F172A',
      subInk: '#1E293B',
      mutedInk: '#475569',
      accent: '#059669',
      accentAlt: '#FACC15',
      accentText: '#FFFFFF',
      cardBg: '#FFFFFF',
      cardBorder: '#0F172A',
      gridColor: 'rgba(5, 150, 105, 0.11)',
      blobA: 'rgba(16, 185, 129, 0.18)',
      blobB: 'rgba(6, 182, 212, 0.16)',
    };
  }
  if (theme === 'lavender') {
    return {
      isDark: false,
      bgTop: '#F5F3FF',
      bgBot: '#FCE7F3',
      ink: '#1E1B4B',
      subInk: '#312E81',
      mutedInk: '#4C1D95',
      accent: '#7C3AED',
      accentAlt: '#FBBF24',
      accentText: '#FFFFFF',
      cardBg: '#FFFFFF',
      cardBorder: '#1E1B4B',
      gridColor: 'rgba(124, 58, 237, 0.10)',
      blobA: 'rgba(167, 139, 250, 0.22)',
      blobB: 'rgba(244, 114, 182, 0.18)',
    };
  }
  if (theme === 'coral') {
    return {
      isDark: false,
      bgTop: '#FFF7ED',
      bgBot: '#FEF3C7',
      ink: '#1C1917',
      subInk: '#292524',
      mutedInk: '#57534E',
      accent: '#EA580C',
      accentAlt: '#FACC15',
      accentText: '#FFFFFF',
      cardBg: '#FFFFFF',
      cardBorder: '#1C1917',
      gridColor: 'rgba(234, 88, 12, 0.10)',
      blobA: 'rgba(251, 146, 60, 0.22)',
      blobB: 'rgba(250, 204, 21, 0.24)',
    };
  }
  // Default: "cream" (Warm Editorial Paper / Off-White Cerah & Bersih)
  return {
    isDark: false,
    bgTop: '#FFFDF7',
    bgBot: '#F3EBD8',
    ink: '#0F172A',
    subInk: '#1E293B',
    mutedInk: '#475569',
    accent: '#2563EB',
    accentAlt: '#FACC15',
    accentText: '#FFFFFF',
    cardBg: '#FFFFFF',
    cardBorder: '#0F172A',
    gridColor: 'rgba(37, 99, 235, 0.09)',
    blobA: 'rgba(250, 204, 21, 0.26)',
    blobB: 'rgba(59, 130, 246, 0.15)',
  };
}

// Kilau cahaya menyapu di dalam bentuk roundRect yang sedang aktif
function drawGlossSweep(x, y, w, h, r, t, period = 3.2) {
  const phase = (t % period) / period;
  if (phase > 0.55) return;
  const norm = phase / 0.55;
  ctx.save();
  roundRect(x, y, w, h, r);
  ctx.clip();
  const sx = x - w * 0.4 + norm * (w * 1.8);
  const grad = ctx.createLinearGradient(sx, y, sx + 160, y + h);
  grad.addColorStop(0, 'rgba(255,255,255,0)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.34)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Percikan konfeti warna-warni cerah untuk momen klimaks
function drawGoldBurst(cx, cy, t, triggerP, p) {
  if (p < triggerP) return;
  const age = Math.min((p - triggerP) / Math.max(1 - triggerP, 0.2), 1);
  const alpha = Math.max(0, 1 - age * 1.15);
  if (alpha <= 0) return;

  const colors = ['#FACC15', '#2563EB', '#10B981', '#F97316', '#EC4899'];
  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2 + (i % 3) * 0.15;
    const dist = (70 + (i % 5) * 45) * easeOutCubic(age) * 2.2;
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist + age * age * 140;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang + t * 5);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-11, -6, 22, 12);
    ctx.restore();
  }
  ctx.restore();
}

// Cek apakah narasi sedang bersuara pada detik t (untuk lip-sync karakter)
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

// Latar belakang cerah & variatif dengan bentuk organik bergerak + grid halus
function drawBackground(theme, t) {
  if (theme === 'sky') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7CC4FA');
    g.addColorStop(0.62, '#FEF9E7');
    g.addColorStop(1, '#E8DFCA');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Matahari hangat berdenyut halus
    const sunR = 115 + Math.sin(t * 2) * 5;
    const sg = ctx.createRadialGradient(860, 260, 20, 860, 260, sunR * 2.2);
    sg.addColorStop(0, 'rgba(255, 238, 130, 0.95)');
    sg.addColorStop(0.45, 'rgba(255, 224, 120, 0.38)');
    sg.addColorStop(1, 'rgba(255, 224, 120, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(860, 260, sunR * 2.2, 0, Math.PI * 2); ctx.fill();

    // Awan berlapis 2 kecepatan
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (let i = 0; i < 4; i++) {
      const speed = i % 2 === 0 ? 22 : 14;
      const cx = ((i * 360 + t * speed) % (W + 340)) - 170;
      const cy = 190 + i * 95;
      roundRect(cx, cy, 240, 58, 29);
      ctx.fill();
    }

    // Bukit latar cerah
    ctx.fillStyle = '#86EFAC';
    ctx.beginPath();
    ctx.moveTo(0, 1460);
    ctx.quadraticCurveTo(280, 1350, 580, 1460);
    ctx.quadraticCurveTo(860, 1365, W, 1460);
    ctx.lineTo(W, 1500);
    ctx.lineTo(0, 1500);
    ctx.fill();

    // Tanah rumput segar
    ctx.fillStyle = '#4ADE80';
    ctx.fillRect(0, 1460, W, H - 1460);
    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(0, 1460); ctx.lineTo(W, 1460); ctx.stroke();
    return;
  }

  if (theme === 'sunset') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#19183b');
    g.addColorStop(0.55, '#4c2a59');
    g.addColorStop(1, '#9c4a3b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const bldgs = [120, 220, 170, 280, 190, 250, 140, 210];
    bldgs.forEach((bh, i) => {
      const bx = i * 140 - 10, by = 1480 - bh;
      ctx.fillStyle = '#1b263b';
      ctx.fillRect(bx, by, 130, bh + 440);
      ctx.strokeStyle = '#0d1321';
      ctx.lineWidth = 4;
      ctx.strokeRect(bx, by, 130, bh + 440);
    });
    return;
  }

  const pal = getPalette(theme);
  const g = ctx.createLinearGradient(0, 0, W * 0.25, H);
  g.addColorStop(0, pal.bgTop);
  g.addColorStop(1, pal.bgBot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Dua gelembung warna pastel besar yang bergerak lembut
  const b1x = W * 0.22 + Math.sin(t * 0.8) * 70;
  const b1y = H * 0.22 + Math.cos(t * 0.7) * 55;
  const rg1 = ctx.createRadialGradient(b1x, b1y, 20, b1x, b1y, 440);
  rg1.addColorStop(0, pal.blobA);
  rg1.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg1;
  ctx.fillRect(0, 0, W, H);

  const b2x = W * 0.82 + Math.cos(t * 0.65) * 65;
  const b2y = H * 0.72 + Math.sin(t * 0.75) * 60;
  const rg2 = ctx.createRadialGradient(b2x, b2y, 20, b2x, b2y, 480);
  rg2.addColorStop(0, pal.blobB);
  rg2.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = rg2;
  ctx.fillRect(0, 0, W, H);

  // Pola grid kertas modern bergerak perlahan
  ctx.save();
  ctx.strokeStyle = pal.gridColor;
  ctx.lineWidth = 2;
  const step = 90;
  const offX = (t * 14) % step;
  const offY = (t * 14) % step;
  for (let x = -step + offX; x < W + step; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for (let y = -step + offY; y < H + step; y += step) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // Partikel bentuk geometris kecil (lingkaran & plus) melayang
  for (let i = 0; i < 18; i++) {
    const px = ((i * 211 + t * (16 + (i % 4) * 5)) % (W + 80)) - 40;
    const py = ((i * 337 - t * (20 + (i % 3) * 8)) % H + H) % H;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(t * 0.8 + i);
    ctx.strokeStyle = pal.isDark ? 'rgba(255,214,0,0.28)' : 'rgba(15,23,42,0.14)';
    ctx.lineWidth = 3;
    if (i % 2 === 0) {
      ctx.beginPath(); ctx.arc(0, 0, 8, 0, Math.PI * 2); ctx.stroke();
    } else {
      ctx.beginPath(); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.stroke();
    }
    ctx.restore();
  }
}

// 1. BIG NUMBER / HOOK
function renderBigNumber(data, p, t, pal) {
  const pop = 0.86 + 0.14 * easeOutBack(Math.min(p * 2.6, 1));
  const breathe = 1 + Math.sin(t * 2.6) * 0.018;
  const floatY = Math.sin(t * 2.2) * 10;
  const headline = String(data.headline || 'RP25.000 TRILIUN').toUpperCase();
  const subheadline = data.subheadline ? String(data.subheadline) : '';

  const headSize = headline.length > 42 ? 70 : (headline.length > 26 ? 84 : 98);
  const headLineH = Math.round(headSize * 1.15);
  const subSize = 40;
  const subLineH = 52;

  ctx.font = `900 ${headSize}px Montserrat, sans-serif`;
  const headLines = wrapLines(headline, 860);

  ctx.font = `700 ${subSize}px Montserrat, sans-serif`;
  const subLines = subheadline ? wrapLines(subheadline, 840) : [];

  const gap = subLines.length ? 40 : 0;
  const totalH = headLines.length * headLineH + gap + subLines.length * subLineH;
  const centerY = 740 + floatY;
  const startY = -totalH / 2 + headSize * 0.85;

  ctx.save();
  ctx.translate(W / 2, centerY);
  ctx.scale(pop * breathe, pop * breathe);

  if (data.rays) {
    ctx.save();
    ctx.rotate(t * 0.25);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI / 9);
      ctx.strokeStyle = pal.isDark
        ? (i % 2 === 0 ? 'rgba(255, 214, 0, 0.16)' : 'rgba(255, 214, 0, 0.06)')
        : (i % 2 === 0 ? 'rgba(250, 204, 21, 0.34)' : 'rgba(37, 99, 235, 0.10)');
      ctx.lineWidth = i % 2 === 0 ? 5 : 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -720); ctx.stroke();
    }
    ctx.restore();
  }

  // Untuk tema terang, beri kartu sorotan kuning-emas tegas dengan shadow neo-brutalist
  if (!pal.isDark) {
    const boxW = 940;
    const boxH = headLines.length * headLineH + 74;
    const boxY = startY - headSize * 0.85 - 32;
    roundRect(-boxW / 2 + 12, boxY + 14, boxW, boxH, 30);
    ctx.fillStyle = pal.ink;
    ctx.fill();

    roundRect(-boxW / 2, boxY, boxW, boxH, 30);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = pal.ink;
    ctx.stroke();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = `900 ${headSize}px Montserrat, sans-serif`;
  headLines.forEach((l, i) => {
    ctx.fillText(l, 0, startY + i * headLineH);
  });

  if (subLines.length) {
    const subStartY = startY + headLines.length * headLineH + gap - (headLineH - headSize) + (pal.isDark ? 0 : 28);
    ctx.fillStyle = pal.isDark ? '#FFFFFF' : pal.subInk;
    ctx.font = `800 ${subSize}px Montserrat, sans-serif`;
    subLines.forEach((l, i) => {
      ctx.fillText(l, 0, subStartY + i * subLineH);
    });
  }
  ctx.restore();
}

// 1B. STATEMENT CARD
function renderStatementCard(data, p, t, pal) {
  const enter = easeOutBack(Math.min(p * 2.5, 1));
  const floatY = Math.sin(t * 2.4) * 8;
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 410 + (1 - enter) * 95 + floatY;

  ctx.save();
  ctx.globalAlpha = Math.min(enter * 1.5, 1);

  if (!pal.isDark) {
    roundRect(cx + 12, cy + 14, cw, ch, 32);
    ctx.fillStyle = pal.ink;
    ctx.fill();
  }

  roundRect(cx, cy, cw, ch, 32);
  ctx.fillStyle = pal.cardBg;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.cardBorder;
  ctx.stroke();
  drawGlossSweep(cx, cy, cw, ch, 32, t, 3.6);

  // Badge atas
  const badge = String(data.badge || 'POIN PENTING').toUpperCase();
  roundRect(W / 2 - 220, cy - 36, 440, 72, 36);
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.accentAlt;
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 30px Montserrat, sans-serif';
  ctx.fillText(badge, W / 2, cy + 10);

  // Ikon berdenyut lembut
  const iconScale = 1 + Math.sin(t * 4) * 0.06;
  ctx.save();
  ctx.translate(W / 2, cy + 175);
  ctx.scale(iconScale, iconScale);
  ctx.font = '115px sans-serif';
  ctx.fillText(data.icon || '💡', 0, 20);
  ctx.restore();

  let textStartY = cy + 310;
  if (data.highlight) {
    ctx.fillStyle = pal.isDark ? '#FFD600' : pal.accent;
    ctx.font = '900 62px Montserrat, sans-serif';
    const hLines = drawWrappedText(String(data.highlight).toUpperCase(), W / 2, cy + 295, cw - 110, 72);
    textStartY = cy + 295 + hLines * 72 + 28;
  }

  const body = data.body || data.subheadline || data.headline || '';
  ctx.fillStyle = pal.ink;
  ctx.font = '800 42px Montserrat, sans-serif';
  drawWrappedText(body, W / 2, textStartY, cw - 120, 56);

  ctx.restore();
}

// 2. THREE CARDS
function renderThreeCards(data, p, t, pal) {
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = '900 52px Montserrat, sans-serif';
  drawWrappedText(data.title || 'SUMBER PENDAPATAN', W / 2, 230, 940, 62);

  const cards = (data.cards || ['POIN 1', 'POIN 2', 'POIN 3']).slice(0, 3);
  const icons = ['🧾', '🚢', '📦'];
  const cardW = 290, cardH = 620, gap = 32;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;

  cards.forEach((label, idx) => {
    const enter = easeOutBack(Math.max(0, Math.min((p * 2.3) - idx * 0.2, 1)));
    const bob = Math.sin(t * 2.8 + idx * 1.4) * 9;
    const cx = startX + idx * (cardW + gap);
    const cy = 440 + (1 - enter) * 180 + bob;

    ctx.save();
    ctx.globalAlpha = Math.min(enter * 1.4, 1);
    if (!pal.isDark) {
      roundRect(cx + 8, cy + 10, cardW, cardH, 24);
      ctx.fillStyle = pal.ink;
      ctx.fill();
    }
    roundRect(cx, cy, cardW, cardH, 24);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    drawGlossSweep(cx, cy, cardW, cardH, 24, t + idx * 0.7, 3.4);

    ctx.save();
    ctx.translate(cx + cardW / 2, cy + 245);
    ctx.rotate(Math.sin(t * 3 + idx) * 0.08);
    ctx.font = '120px sans-serif';
    ctx.fillText(data.icons?.[idx] || icons[idx], 0, 35);
    ctx.restore();

    roundRect(cx + 24, cy + 480, cardW - 48, 76, 14);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 28px Montserrat, sans-serif';
    ctx.fillText(String(label).toUpperCase().slice(0, 14), cx + cardW / 2, cy + 528);
    ctx.restore();
  });

  if (data.badge) {
    const pulse = 1 + Math.sin(t * 4) * 0.03;
    ctx.save();
    ctx.translate(W / 2, 1177);
    ctx.scale(pulse, pulse);
    roundRect(-220, -37, 440, 74, 18);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(data.badge, 0, 11);
    ctx.restore();
  }
}

// 3. BAR CHART
function renderBarChart(data, p, t, pal) {
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.ink;
  ctx.font = '900 48px Montserrat, sans-serif';
  ctx.fillText(data.title || 'GRAFIK DATA TAHUNAN', W / 2, 190);

  if (data.subtitle) {
    ctx.fillStyle = pal.mutedInk;
    ctx.font = '700 30px Montserrat, sans-serif';
    ctx.fillText(data.subtitle, W / 2, 245);
  }

  if (data.summary_value) {
    roundRect(140, 290, W - 280, 140, 22);
    ctx.fillStyle = pal.isDark ? 'rgba(255,255,255,0.08)' : '#FFFFFF';
    ctx.fill();
    ctx.strokeStyle = pal.isDark ? 'rgba(255,255,255,0.35)' : pal.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    drawGlossSweep(140, 290, W - 280, 140, 22, t, 3.0);

    ctx.fillStyle = pal.mutedInk;
    ctx.font = '700 28px Montserrat, sans-serif';
    ctx.fillText(data.summary_label || 'TOTAL AKUMULASI', W / 2, 342);
    ctx.fillStyle = pal.isDark ? '#FFD600' : pal.accent;
    ctx.font = '900 56px Montserrat, sans-serif';
    ctx.fillText(data.summary_value, W / 2, 405);
  }

  const bars = data.bars || [
    { label: '2018', value: 1200 },
    { label: '2019', value: 1450 },
    { label: '2020', value: 1100 },
    { label: '2021', value: 1650 },
    { label: '2022', value: 2050, highlight: true },
    { label: '2023', value: 2350, highlight: true },
  ];
  const maxVal = Math.max(...bars.map(b => b.value), data.target || 1) * 1.15;
  const chartX = 120, chartY = 1260, chartW = W - 240, chartH = 720;

  if (data.target) {
    const ty = chartY - (data.target / maxVal) * chartH;
    ctx.save();
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -t * 28;
    ctx.strokeStyle = pal.isDark ? '#FFD600' : '#EA580C';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(chartX, ty); ctx.lineTo(chartX + chartW, ty); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillStyle = pal.isDark ? '#FFD600' : '#EA580C';
    ctx.font = '800 28px Montserrat, sans-serif';
    ctx.fillText(data.target_label || String(data.target), chartX + chartW, ty - 14);
  }

  const slotW = chartW / bars.length;
  const barW = Math.min(slotW * 0.66, 95);

  bars.forEach((b, i) => {
    const grow = easeOutCubic(Math.max(0, Math.min((p * 1.9) - i * 0.08, 1)));
    const bh = (b.value / maxVal) * chartH * grow;
    const bx = chartX + i * slotW + (slotW - barW) / 2;
    const by = chartY - bh;

    roundRect(bx, by, barW, bh, 12);
    ctx.fillStyle = b.highlight ? '#F59E0B' : (pal.isDark ? '#5882C4' : '#3B82F6');
    ctx.fill();
    if (!pal.isDark) {
      ctx.lineWidth = 4;
      ctx.strokeStyle = pal.ink;
      ctx.stroke();
    }
    if (b.highlight && bh > 20) {
      drawGlossSweep(bx, by, barW, bh, 12, t, 2.5);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = b.highlight ? (pal.isDark ? '#FFD600' : '#D97706') : pal.ink;
    ctx.font = '800 24px Montserrat, sans-serif';
    ctx.fillText(b.display || b.value, bx + barW / 2, by - 14);

    ctx.fillStyle = pal.mutedInk;
    ctx.font = '700 26px Montserrat, sans-serif';
    ctx.fillText(b.label, bx + barW / 2, chartY + 42);
  });

  if (data.source) {
    ctx.textAlign = 'left';
    ctx.fillStyle = pal.mutedInk;
    ctx.font = '700 22px Montserrat, sans-serif';
    ctx.fillText('SUMBER: ' + data.source, 90, 1410);
  }
}

// 4. CALCULATOR + FALLING COINS + GOLD BURST
function renderCalculator(data, p, t, pal) {
  for (let i = 0; i < 12; i++) {
    const cx = 130 + ((i * 173) % (W - 260));
    const cy = ((t * 320 + i * 190) % 620) + 50;
    const spin = Math.abs(Math.cos(t * 3 + i));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.25, spin), 1);
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    ctx.fillStyle = '#0F172A';
    ctx.textAlign = 'center';
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText('Rp', 0, 8);
    ctx.restore();
  }

  const floatY = Math.sin(t * 2.5) * 6;
  const cw = 640, ch = 820, cx = (W - cw) / 2, cy = 620 + floatY;
  if (!pal.isDark) {
    roundRect(cx + 12, cy + 14, cw, ch, 34);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
  }
  roundRect(cx, cy, cw, ch, 34);
  ctx.fillStyle = pal.isDark ? '#1E2D4A' : '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.isDark ? '#3B5687' : '#0F172A';
  ctx.stroke();

  roundRect(cx + 42, cy + 46, cw - 84, 150, 18);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  const targetNum = Number(data.number || 25000);
  const countP = Math.min(p * 1.45, 1);
  const curNum = Math.round(targetNum * easeOutCubic(countP));
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 72px Montserrat, sans-serif';
  ctx.fillText(`${curNum.toLocaleString('id-ID')} ${data.unit || 'T'}`, cx + cw - 68, cy + 145);

  const keys = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+'];
  const activeKey = Math.floor(t * 5) % keys.length;
  keys.forEach((k, idx) => {
    const r = Math.floor(idx / 4), c = idx % 4;
    const bx = cx + 44 + c * 142, by = cy + 230 + r * 112;
    const pressed = countP < 0.95 && idx === activeKey;
    roundRect(bx, by + (pressed ? 4 : 0), 124, 92, 16);
    if (pal.isDark) {
      ctx.fillStyle = pressed ? '#4E74BA' : (c === 3 ? '#39558A' : '#283B61');
      ctx.fill();
      ctx.fillStyle = '#FFF';
    } else {
      ctx.fillStyle = pressed ? '#DBEAFE' : (c === 3 ? '#E0E7FF' : '#F1F5F9');
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
      ctx.fillStyle = '#0F172A';
    }
    ctx.textAlign = 'center';
    ctx.font = '800 38px Montserrat, sans-serif';
    ctx.fillText(k, bx + 62, by + 60 + (pressed ? 4 : 0));
  });

  const eqPressed = countP >= 0.95;
  roundRect(cx + 44, cy + 680, cw - 88, 92, 18);
  ctx.fillStyle = eqPressed ? '#FACC15' : '#F59E0B';
  ctx.fill();
  if (!pal.isDark) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
  }
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 48px Montserrat, sans-serif';
  ctx.fillText('=', cx + cw / 2, cy + 742);

  drawGoldBurst(W / 2, cy + 120, t, 0.72, p);
}

// 5. CHARACTER STORY — Karakter Kartun 2D Chibi Penuh (Cowok Hoodie Biru / Cewek Sweater Oranye)
function drawBoyCharacter(t, stride, speaking, blinking, waveBoost) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141923';

  const legSwing = stride * 18;

  // --- Kaki & Sepatu Sneakers Merah ---
  // Kaki Kiri
  ctx.save();
  ctx.translate(-28, 132);
  ctx.rotate(legSwing * 0.015);
  roundRect(-20, 0, 40, 118, 14);
  ctx.fillStyle = '#333C4A';
  ctx.fill(); ctx.stroke();
  // Sepatu merah kiri
  roundRect(-30, 108, 56, 30, 14);
  ctx.fillStyle = '#E0433E';
  ctx.fill(); ctx.stroke();
  roundRect(-30, 128, 56, 12, 6);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Kaki Kanan
  ctx.save();
  ctx.translate(28, 132);
  ctx.rotate(-legSwing * 0.015);
  roundRect(-20, 0, 40, 118, 14);
  ctx.fillStyle = '#333C4A';
  ctx.fill(); ctx.stroke();
  // Sepatu merah kanan
  roundRect(-26, 108, 56, 30, 14);
  ctx.fillStyle = '#E0433E';
  ctx.fill(); ctx.stroke();
  roundRect(-26, 128, 56, 12, 6);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // --- Lengan Kiri (Tangan masuk saku hoodie) ---
  ctx.save();
  ctx.translate(-64, 14);
  ctx.rotate(0.18 + stride * 0.06);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-36, 48, -10, 92);
  ctx.lineWidth = 30;
  ctx.strokeStyle = '#141923';
  ctx.stroke();
  ctx.lineWidth = 20;
  ctx.strokeStyle = '#6FB4F5';
  ctx.stroke();
  ctx.restore();

  // --- Lengan Kanan (Melambai ramah) ---
  ctx.save();
  ctx.translate(64, 16);
  const waveAngle = -0.68 + Math.sin(t * (speaking ? 7.5 : 4.2)) * (0.22 + waveBoost);
  ctx.rotate(waveAngle);
  // Lengan jaket biru
  roundRect(-14, -84, 28, 88, 14);
  ctx.fillStyle = '#6FB4F5';
  ctx.fill(); ctx.stroke();
  // Manset biru
  roundRect(-15, -88, 30, 14, 6);
  ctx.fillStyle = '#539BE0';
  ctx.fill(); ctx.stroke();
  // Telapak & 5 jari melambai
  ctx.translate(0, -102);
  ctx.fillStyle = '#F7C9A9';
  for (let f = -2; f <= 2; f++) {
    ctx.save();
    ctx.rotate(f * 0.24);
    roundRect(-4, -22, 8, 22, 4);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath();
  ctx.arc(0, 2, 16, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // --- Badan: Kaos Putih Dalam + Hoodie Biru Terbuka ---
  roundRect(-62, -6, 124, 146, 26);
  ctx.fillStyle = '#6FB4F5';
  ctx.fill(); ctx.stroke();

  // Kaos putih tengah
  roundRect(-24, -4, 48, 142, 8);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill(); ctx.stroke();

  // Kerah & tali hoodie
  ctx.beginPath();
  ctx.moveTo(-26, -4); ctx.lineTo(-14, 18); ctx.lineTo(0, 4);
  ctx.moveTo(26, -4); ctx.lineTo(14, 18); ctx.lineTo(0, 4);
  ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-16, 16); ctx.lineTo(-16, 52); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(16, 16); ctx.lineTo(16, 52); ctx.stroke();

  // Garis saku depan hoodie
  ctx.beginPath();
  ctx.moveTo(-58, 86); ctx.lineTo(-26, 86); ctx.lineTo(-26, 134);
  ctx.moveTo(58, 86); ctx.lineTo(26, 86); ctx.lineTo(26, 134);
  ctx.stroke();

  // --- Leher & Kepala ---
  ctx.save();
  ctx.rotate(speaking ? Math.sin(t * 6) * 0.025 : Math.sin(t * 2) * 0.015);
  roundRect(-16, -24, 32, 24, 8);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Telinga kiri & kanan
  ctx.beginPath(); ctx.arc(-78, -94, 16, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(78, -94, 16, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();

  // Wajah bulat chibi
  ctx.beginPath();
  ctx.ellipse(0, -102, 76, 72, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Rambut cokelat tua berjambul (gaya referensi)
  ctx.beginPath();
  ctx.moveTo(-74, -104);
  ctx.quadraticCurveTo(-86, -158, -42, -172);
  ctx.lineTo(-30, -184);
  ctx.quadraticCurveTo(8, -192, 48, -172);
  ctx.lineTo(74, -162);
  ctx.quadraticCurveTo(84, -134, 74, -104);
  ctx.quadraticCurveTo(64, -132, 44, -134);
  ctx.lineTo(28, -122);
  ctx.lineTo(12, -136);
  ctx.lineTo(-14, -122);
  ctx.lineTo(-34, -136);
  ctx.quadraticCurveTo(-58, -132, -74, -104);
  ctx.closePath();
  ctx.fillStyle = '#4A2E22';
  ctx.fill(); ctx.stroke();

  // Alis ekspresif
  const browLift = speaking ? -3 : 0;
  ctx.lineWidth = 5;
  ctx.beginPath(); ctx.arc(-30, -118 + browLift, 14, Math.PI + 0.3, -0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(30, -118 + browLift, 14, Math.PI + 0.3, -0.3); ctx.stroke();

  // Mata besar dengan kilau putih
  if (blinking) {
    ctx.beginPath(); ctx.moveTo(-42, -98); ctx.lineTo(-18, -98); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, -98); ctx.lineTo(42, -98); ctx.stroke();
  } else {
    [-30, 30].forEach(ex => {
      ctx.beginPath(); ctx.ellipse(ex, -98, 12, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#141923'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 4, -103, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
    });
  }

  // Rona pipi merah muda lembut
  ctx.fillStyle = 'rgba(244, 114, 114, 0.42)';
  ctx.beginPath(); ctx.ellipse(-46, -78, 13, 8, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(46, -78, 13, 8, 0, 0, Math.PI * 2); ctx.fill();

  // Hidung kecil
  ctx.lineWidth = 3.5;
  ctx.beginPath(); ctx.arc(0, -84, 5, -0.5, 1.8); ctx.stroke();

  // Mulut (lip-sync saat narasi bicara)
  ctx.lineWidth = 4.5;
  if (speaking) {
    const openH = 6 + Math.abs(Math.sin(t * 18)) * 11;
    ctx.fillStyle = '#B8324F';
    ctx.beginPath();
    ctx.ellipse(0, -64, 15, openH, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -68, 16, 0.25, Math.PI - 0.25);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function drawGirlCharacter(t, stride, speaking, blinking) {
  ctx.save();
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#141923';

  const legSwing = stride * 16;

  // --- Kaki, Kaos Kaki Putih & Sepatu Kuning ---
  [-24, 24].forEach((lx, idx) => {
    ctx.save();
    ctx.translate(lx, 126);
    ctx.rotate((idx === 0 ? legSwing : -legSwing) * 0.014);
    // Betis kulit
    roundRect(-14, 56, 28, 56, 10);
    ctx.fillStyle = '#F7C9A9';
    ctx.fill(); ctx.stroke();
    // Kaos kaki putih
    roundRect(-15, 86, 30, 26, 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill(); ctx.stroke();
    // Celana jeans selutut
    roundRect(-19, 0, 38, 66, 10);
    ctx.fillStyle = '#3B5875';
    ctx.fill(); ctx.stroke();
    // Sepatu kuning
    roundRect(idx === 0 ? -24 : -20, 108, 46, 28, 13);
    ctx.fillStyle = '#F4B942';
    ctx.fill(); ctx.stroke();
    roundRect(idx === 0 ? -24 : -20, 126, 46, 11, 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // --- Lengan Kiri & Kanan (Sweter Oranye) ---
  [-56, 56].forEach((ax, idx) => {
    ctx.save();
    ctx.translate(ax, 12);
    const baseRot = idx === 0 ? 0.34 : -0.34;
    const animRot = Math.sin(t * 4.5 + idx * 2) * 0.12;
    ctx.rotate(baseRot + animRot);
    roundRect(-13, 0, 26, 86, 13);
    ctx.fillStyle = '#EE723F';
    ctx.fill(); ctx.stroke();
    // Telapak tangan
    ctx.beginPath(); ctx.arc(0, 96, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
    ctx.restore();
  });

  // --- Badan: Sweter Oranye ---
  roundRect(-54, -4, 108, 136, 26);
  ctx.fillStyle = '#EE723F';
  ctx.fill(); ctx.stroke();

  // --- Kuncir Kuda Belakang + Ikat Rambut Kuning ---
  ctx.save();
  ctx.rotate(speaking ? Math.sin(t * 6) * 0.03 : Math.sin(t * 2.2) * 0.02);
  ctx.save();
  ctx.translate(64, -124);
  ctx.rotate(Math.sin(t * 4) * 0.08);
  ctx.beginPath();
  ctx.moveTo(0, -14);
  ctx.quadraticCurveTo(68, -22, 64, 54);
  ctx.quadraticCurveTo(56, 94, 24, 96);
  ctx.quadraticCurveTo(34, 48, 0, 16);
  ctx.closePath();
  ctx.fillStyle = '#232730';
  ctx.fill(); ctx.stroke();
  // Ikat rambut kuning
  roundRect(-12, -16, 22, 32, 10);
  ctx.fillStyle = '#FACC15';
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Leher & Telinga
  roundRect(-14, -22, 28, 22, 8);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(-72, -92, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(72, -92, 15, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

  // Wajah bulat chibi
  ctx.beginPath();
  ctx.ellipse(0, -100, 72, 68, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Rambut Hitam Poni Rata
  ctx.beginPath();
  ctx.arc(0, -106, 75, Math.PI, 0);
  ctx.lineTo(74, -92);
  ctx.lineTo(52, -116);
  ctx.lineTo(30, -114);
  ctx.lineTo(14, -126);
  ctx.lineTo(0, -114);
  ctx.lineTo(-24, -114);
  ctx.lineTo(-50, -116);
  ctx.lineTo(-74, -92);
  ctx.closePath();
  ctx.fillStyle = '#232730';
  ctx.fill(); ctx.stroke();

  // Alis & Mata Bulat
  ctx.lineWidth = 4.5;
  ctx.beginPath(); ctx.arc(-28, -114, 13, Math.PI + 0.3, -0.3); ctx.stroke();
  ctx.beginPath(); ctx.arc(28, -114, 13, Math.PI + 0.3, -0.3); ctx.stroke();

  if (blinking) {
    ctx.beginPath(); ctx.moveTo(-40, -96); ctx.lineTo(-16, -96); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(16, -96); ctx.lineTo(40, -96); ctx.stroke();
  } else {
    [-28, 28].forEach(ex => {
      ctx.beginPath(); ctx.ellipse(ex, -96, 11, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#141923'; ctx.fill();
      ctx.beginPath(); ctx.arc(ex - 3.5, -101, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF'; ctx.fill();
    });
  }

  // Pipi merona
  ctx.fillStyle = 'rgba(244, 114, 114, 0.45)';
  ctx.beginPath(); ctx.ellipse(-44, -76, 12, 7.5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(44, -76, 12, 7.5, 0, 0, Math.PI * 2); ctx.fill();

  // Mulut tersenyum / bicara
  ctx.lineWidth = 4.5;
  if (speaking) {
    const openH = 6 + Math.abs(Math.sin(t * 18)) * 10;
    ctx.fillStyle = '#B8324F';
    ctx.beginPath();
    ctx.ellipse(0, -62, 15, openH, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else {
    ctx.fillStyle = '#B8324F';
    ctx.beginPath();
    ctx.arc(0, -68, 16, 0.1, Math.PI - 0.1);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

function renderCharacterStory(data, p, t) {
  const walkX = W / 2 + Math.sin(t * 1.9) * 32;
  const stride = Math.sin(t * 5.2);
  const bobY = Math.abs(stride) * 10;
  const speaking = isSpeakingAt(t);
  const blinking = (t % 3.4) > 3.24;

  // Kartu angka atau balon ucapan di atas karakter
  const cardPop = easeOutBack(Math.min(p * 2.6, 1));
  const cardFloat = Math.sin(t * 2.6) * 8;
  ctx.save();
  ctx.translate(W / 2, 410 + cardFloat);
  ctx.scale(cardPop, cardPop);

  if (data.card_value) {
    roundRect(-312, -104, 640, 224, 26);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    roundRect(-320, -112, 640, 224, 26);
    ctx.fillStyle = data.card_color || '#10B981';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    drawGlossSweep(-320, -112, 640, 224, 26, t, 3.0);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 66px Montserrat, sans-serif';
    ctx.fillText(data.card_value, 0, 24);
  } else if (data.quote) {
    roundRect(-415, -138, 830, 276, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(-24, 138);
    ctx.lineTo(0, 174);
    ctx.lineTo(28, 138);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 38px Montserrat, sans-serif';
    drawWrappedText(data.quote, 0, -42, 745, 50);
  }
  ctx.restore();

  // Karakter 2D Penuh (pengganti stikman) berdiri di atas rumput (y = 1460)
  const charChoice = String(data.character || 'boy').toLowerCase();
  const baseGroundY = 1460;

  if (charChoice === 'both') {
    // Tampilkan kedua karakter berdampingan
    ctx.save();
    ctx.translate(W / 2 - 145, baseGroundY - bobY);
    ctx.scale(1.12, 1.12);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(0, 268 + bobY * 0.8, 88, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -14);
    drawBoyCharacter(t, stride, speaking, blinking, 0.08);
    ctx.restore();

    ctx.save();
    ctx.translate(W / 2 + 155, baseGroundY - Math.abs(Math.cos(t * 5.2)) * 9);
    ctx.scale(1.10, 1.10);
    ctx.fillStyle = 'rgba(0,0,0,0.16)';
    ctx.beginPath(); ctx.ellipse(0, 268, 84, 18, 0, 0, Math.PI * 2); ctx.fill();
    ctx.translate(0, -14);
    drawGirlCharacter(t + 0.5, -stride, false, blinking);
    ctx.restore();
  } else {
    ctx.save();
    ctx.translate(walkX, baseGroundY - bobY);
    ctx.scale(1.26, 1.26);
    // Bayangan tanah
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    ctx.beginPath();
    ctx.ellipse(0, 266 + bobY * 0.7, 94 - bobY * 0.5, 19, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, -14);
    if (charChoice === 'girl') {
      drawGirlCharacter(t, stride, speaking, blinking);
    } else {
      drawBoyCharacter(t, stride, speaking, blinking, 0.12);
    }
    ctx.restore();
  }

  if (data.banner) {
    roundRect(110, 770, W - 220, 86, 18);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    drawGlossSweep(110, 770, W - 220, 86, 18, t, 3.2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(String(data.banner).toUpperCase(), W / 2, 826);
  }
}

// 6. DASHBOARD KEUANGAN
function renderDashboard(data, p, t, pal) {
  const enter = easeOutBack(Math.min(p * 2.5, 1));
  const floatY = Math.sin(t * 2.2) * 6;
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 440 + (1 - enter) * 80 + floatY;

  if (!pal.isDark) {
    roundRect(cx + 10, cy + 12, cw, ch, 30);
    ctx.fillStyle = pal.ink;
    ctx.fill();
  }
  roundRect(cx, cy, cw, ch, 30);
  ctx.fillStyle = pal.isDark ? '#101F3D' : '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.isDark ? '#33538F' : pal.ink;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = pal.ink;
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.title || 'DASHBOARD KEUANGAN', W / 2, cy + 78);

  roundRect(cx + 46, cy + 165, cw - 92, 110, 18);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  if (!pal.isDark) {
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
  }
  drawGlossSweep(cx + 46, cy + 165, cw - 92, 110, 18, t, 2.8);
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 54px Montserrat, sans-serif';
  ctx.fillText(data.main_value || 'Rp15.000.000', W / 2, cy + 238);

  const items = (data.items || ['MAKAN', 'LISTRIK', 'INTERNET', 'TABUNGAN']).slice(0, 4);
  const icons = ['🍜', '⚡', '📶', '💰'];
  items.forEach((it, i) => {
    const bw = 186, bx = cx + 46 + i * 206, by = cy + 315 + Math.sin(t * 3 + i) * 5;
    roundRect(bx, by, bw, 175, 16);
    ctx.fillStyle = pal.isDark ? '#182C54' : '#F8FAFC';
    ctx.fill();
    ctx.strokeStyle = pal.isDark ? '#385A99' : '#0F172A';
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.font = '56px sans-serif';
    ctx.fillText(icons[i], bx + bw / 2, by + 84);
    ctx.fillStyle = pal.ink;
    ctx.font = '800 22px Montserrat, sans-serif';
    ctx.fillText(String(it).toUpperCase(), bx + bw / 2, by + 144);
  });

  roundRect(cx + 46, cy + 565, cw - 92, 100, 18);
  ctx.fillStyle = pal.isDark ? '#182C54' : '#FFF7ED';
  ctx.fill();
  ctx.strokeStyle = '#EA580C';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = pal.ink;
  ctx.font = '900 46px Montserrat, sans-serif';
  ctx.fillText(data.sub_value || 'Rp1.500.000', cx + 78, cy + 632);
}

// 7. CALENDAR GRID + GOLD BURST
function renderCalendarGrid(data, p, t, pal) {
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 380;
  if (!pal.isDark) {
    roundRect(cx + 10, cy + 12, cw, ch, 30);
    ctx.fillStyle = pal.ink;
    ctx.fill();
  }
  roundRect(cx, cy, cw, ch, 30);
  ctx.fillStyle = pal.isDark ? '#101F3D' : '#FFFFFF';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = pal.isDark ? '#33538F' : pal.ink;
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = pal.ink;
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.title || 'KALENDER MENABUNG', W / 2, cy + 78);

  const months = ['Thn 1', 'Thn 2', 'Thn 3', 'Thn 4', 'Thn 5', 'Thn 6', 'Thn 7', 'Thn 8', 'Thn 9', 'Thn 10', 'Bln 11', 'Bln 12', 'Bln 13', 'Bln 14', 'Bln 15'];
  const totalBoxes = Math.min(Number(data.count || 15), 15);

  for (let i = 0; i < totalBoxes; i++) {
    const r = Math.floor(i / 5), c = i % 5;
    const bw = 148, bh = 136;
    const bx = cx + 48 + c * 164, by = cy + 120 + r * 154;
    const active = p >= (i / totalBoxes) * 0.72;

    roundRect(bx, by, bw, bh, 16);
    ctx.fillStyle = active ? '#FACC15' : (pal.isDark ? '#1B2F59' : '#F1F5F9');
    ctx.fill();
    if (!pal.isDark) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    }
    ctx.fillStyle = active ? '#0F172A' : pal.ink;
    ctx.font = '800 26px Montserrat, sans-serif';
    ctx.fillText((data.labels?.[i] || months[i]), bx + bw / 2, by + 56);
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText(data.unit_label || '10 JT ✓', bx + bw / 2, by + 104);
  }

  ctx.fillStyle = pal.ink;
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.formula || 'Rp10 JT × 15 = Rp150 JT', W / 2, cy + 685);

  if (p > 0.72 && data.stamp) {
    const stampP = easeOutBack(Math.min((p - 0.72) * 5, 1));
    ctx.save();
    ctx.translate(W / 2, 1280);
    ctx.scale(stampP, stampP);
    ctx.rotate(-0.06);
    roundRect(-275, -55, 550, 110, 18);
    ctx.fillStyle = '#0F172A';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FACC15';
    ctx.stroke();
    ctx.fillStyle = '#FACC15';
    ctx.font = '900 50px Montserrat, sans-serif';
    ctx.fillText(data.stamp, 0, 18);
    ctx.restore();
    drawGoldBurst(W / 2, 1280, t, 0.72, p);
  }
}

// 8. COMPARISON VS (Perbandingan Kiri vs Kanan)
function renderComparisonVs(data, p, t, pal) {
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = '900 50px Montserrat, sans-serif';
  drawWrappedText(data.title || 'PERBANDINGAN PILIHAN', W / 2, 220, 940, 60);

  const leftEnter = easeOutBack(Math.min(p * 2.6, 1));
  const rightEnter = easeOutBack(Math.max(0, Math.min((p - 0.12) * 2.6, 1)));
  const cardW = 420, cardH = 740, topY = 390;

  // Kartu Kiri
  ctx.save();
  ctx.translate(90 + cardW / 2 - (1 - leftEnter) * 260, topY + cardH / 2 + Math.sin(t * 2.5) * 7);
  ctx.globalAlpha = Math.min(leftEnter * 1.4, 1);
  if (!pal.isDark) {
    roundRect(-cardW / 2 + 8, -cardH / 2 + 10, cardW, cardH, 28);
    ctx.fillStyle = pal.ink;
    ctx.fill();
  }
  roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  ctx.fillStyle = pal.isDark ? '#1B2D52' : '#FFF1F2';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.isDark ? '#FF6B6B' : '#E11D48';
  ctx.stroke();
  ctx.font = '115px sans-serif';
  ctx.fillText(data.left_icon || '❌', 0, -140);
  ctx.fillStyle = pal.isDark ? '#FF8787' : '#BE123C';
  ctx.font = '900 36px Montserrat, sans-serif';
  drawWrappedText(data.left_title || 'PILIHAN A', 0, -20, cardW - 50, 44);
  ctx.fillStyle = pal.ink;
  ctx.font = '900 44px Montserrat, sans-serif';
  drawWrappedText(data.left_value || '', 0, 130, cardW - 50, 52);
  ctx.restore();

  // Kartu Kanan
  ctx.save();
  ctx.translate(W - 90 - cardW / 2 + (1 - rightEnter) * 260, topY + cardH / 2 + Math.sin(t * 2.5 + 1.5) * 7);
  ctx.globalAlpha = Math.min(rightEnter * 1.4, 1);
  if (!pal.isDark) {
    roundRect(-cardW / 2 + 8, -cardH / 2 + 10, cardW, cardH, 28);
    ctx.fillStyle = pal.ink;
    ctx.fill();
  }
  roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  ctx.fillStyle = pal.isDark ? '#13334C' : '#ECFDF5';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = pal.isDark ? '#FFD600' : '#059669';
  ctx.stroke();
  drawGlossSweep(-cardW / 2, -cardH / 2, cardW, cardH, 28, t, 3.0);
  ctx.font = '115px sans-serif';
  ctx.fillText(data.right_icon || '✅', 0, -140);
  ctx.fillStyle = pal.isDark ? '#FFD600' : '#047857';
  ctx.font = '900 36px Montserrat, sans-serif';
  drawWrappedText(data.right_title || 'PILIHAN B', 0, -20, cardW - 50, 44);
  ctx.fillStyle = pal.ink;
  ctx.font = '900 44px Montserrat, sans-serif';
  drawWrappedText(data.right_value || '', 0, 130, cardW - 50, 52);
  ctx.restore();

  // Lencana VS di tengah
  const vsScale = easeOutBack(Math.min(p * 3, 1)) * (1 + Math.sin(t * 5) * 0.05);
  ctx.save();
  ctx.translate(W / 2, topY + cardH / 2);
  ctx.scale(vsScale, vsScale);
  ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fillStyle = '#FACC15'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText('VS', 0, 15);
  ctx.restore();
}

// 9. CTA CLOSING
function renderCtaClosing(data, p, t, pal) {
  const pulse = 1 + Math.sin(t * 4.5) * 0.04;
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = '900 62px Montserrat, sans-serif';
  const hLines = drawWrappedText(data.headline || 'BAGAIMANA PENDAPATMU?', W / 2, 540, 920, 76);

  const subY = 540 + hLines * 76 + 34;
  ctx.fillStyle = pal.subInk;
  ctx.font = '700 36px Montserrat, sans-serif';
  const sLines = drawWrappedText(
    data.subheadline || 'Tulis di kolom komentar, dan follow untuk video selanjutnya!',
    W / 2,
    subY,
    860,
    48
  );

  const btnY = Math.max(subY + sLines * 48 + 54, 960);
  roundRect(140, btnY, 380, 96, 48);
  ctx.fillStyle = '#2563EB';
  ctx.fill();
  if (!pal.isDark) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
  }
  ctx.fillStyle = '#FFF';
  ctx.font = '900 34px Montserrat, sans-serif';
  ctx.fillText('💬 KOMENTAR', 330, btnY + 60);

  ctx.save();
  ctx.translate(750, btnY + 48);
  ctx.scale(pulse, pulse);
  roundRect(-190, -48, 380, 96, 48);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  if (!pal.isDark) {
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
  }
  drawGlossSweep(-190, -48, 380, 96, 48, t, 2.2);
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 34px Montserrat, sans-serif';
  ctx.fillText('♥ FOLLOW', 0, 12);
  ctx.restore();

  drawGoldBurst(W / 2, 480, t, 0.15, p);
}


// 10. CODE TERMINAL (Jendela Kode / Log dengan Animasi Mengetik Real-Time)
function renderCodeTerminal(data, p, t, pal) {
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = '900 48px Montserrat, sans-serif';
  drawWrappedText(data.title || 'KODE & LOG SISTEM', W / 2, 220, 940, 58);

  const enter = easeOutBack(Math.min(p * 2.6, 1));
  const cw = 920, ch = 820, cx = (W - cw) / 2, cy = 350 + (1 - enter) * 80;

  ctx.save();
  ctx.globalAlpha = Math.min(enter * 1.4, 1);

  // Neo-brutalist shadow
  roundRect(cx + 12, cy + 14, cw, ch, 26);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  // Dark VSCode-style editor window (kontras tajam di atas latar cerah)
  roundRect(cx, cy, cw, ch, 26);
  ctx.fillStyle = '#0F172A';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  // Top titlebar
  roundRect(cx, cy, cw, 68, 26);
  ctx.fillStyle = '#1E293B';
  ctx.fill();
  ctx.fillRect(cx, cy + 40, cw, 28);

  // Window traffic dots
  ['#EF4444', '#FACC15', '#22C55E'].forEach((col, i) => {
    ctx.beginPath();
    ctx.arc(cx + 42 + i * 32, cy + 34, 11, 0, Math.PI * 2);
    ctx.fillStyle = col;
    ctx.fill();
  });

  ctx.textAlign = 'left';
  ctx.fillStyle = '#94A3B8';
  ctx.font = '700 24px Montserrat, sans-serif';
  ctx.fillText(data.filename || 'bot.py — terminal', cx + 150, cy + 42);

  // Animated typewriter lines
  const lines = data.lines || [
    '$ python bot.py',
    '✓ Menerima naskah JSON dari Telegram...',
    '✓ Membuat suara TTS (24 kata)...',
    '✓ Render 1080x1920 @ 30fps...',
    '🎬 Video MP4 siap dikirim!'
  ];
  const fullText = lines.join('\n');
  const revealCount = Math.floor(fullText.length * Math.min(p * 1.35, 1));
  const visibleLines = fullText.slice(0, revealCount).split('\n');

  ctx.font = '700 30px monospace';
  visibleLines.forEach((ln, idx) => {
    const ly = cy + 135 + idx * 66;
    if (ly > cy + ch - 45) return;
    // Line number
    ctx.fillStyle = '#475569';
    ctx.fillText(String(idx + 1).padStart(2, '0'), cx + 32, ly);

    // Syntax color highlighting
    if (ln.startsWith('$') || ln.startsWith('>')) {
      ctx.fillStyle = '#38BDF8';
    } else if (ln.includes('✓') || ln.includes('🎬') || ln.includes('SUCCESS')) {
      ctx.fillStyle = '#4ADE80';
    } else if (ln.includes('ERROR') || ln.includes('Gagal')) {
      ctx.fillStyle = '#F87171';
    } else if (ln.includes(':') || ln.includes('=')) {
      ctx.fillStyle = '#FACC15';
    } else {
      ctx.fillStyle = '#F8FAFC';
    }

    const displayLn = ln.length > 36 ? ln.slice(0, 36) : ln;
    ctx.fillText(displayLn, cx + 95, ly);

    // Blinking cursor on active last line
    if (idx === visibleLines.length - 1 && Math.floor(t * 4) % 2 === 0) {
      const tw = ctx.measureText(displayLn).width;
      ctx.fillStyle = '#FACC15';
      ctx.fillRect(cx + 102 + tw, ly - 26, 16, 32);
    }
  });

  if (data.badge) {
    roundRect(cx + cw / 2 - 230, cy + ch - 42, 460, 74, 37);
    ctx.fillStyle = '#FACC15';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 30px Montserrat, sans-serif';
    ctx.fillText(String(data.badge).toUpperCase(), cx + cw / 2, cy + ch + 5);
  }
  ctx.restore();
}

// 11. FLOW DIAGRAM (Diagram Alur Sistem dengan Titik Data Bergerak)
function renderFlowDiagram(data, p, t, pal) {
  ctx.textAlign = 'center';
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.ink;
  ctx.font = '900 48px Montserrat, sans-serif';
  drawWrappedText(data.title || 'ALUR KERJA OTOMATIS', W / 2, 220, 940, 58);

  const steps = (data.steps || [
    { icon: '📲', title: 'KIRIM NASKAH', desc: 'Chat atau file .json di Telegram' },
    { icon: '⚡', title: 'CLOUD RENDER', desc: 'GitHub Actions + Playwright 30 FPS' },
    { icon: '🎬', title: 'VIDEO MP4 JADI', desc: 'Otomatis terkirim balik siap upload' }
  ]).slice(0, 3);

  const boxW = 820, boxH = 225, startX = (W - boxW) / 2, startY = 340, gapY = 95;

  steps.forEach((st, i) => {
    const enter = easeOutBack(Math.max(0, Math.min(p * 2.4 - i * 0.22, 1)));
    const bx = startX + (1 - enter) * (i % 2 === 0 ? -160 : 160);
    const by = startY + i * (boxH + gapY);

    ctx.save();
    ctx.globalAlpha = Math.min(enter * 1.4, 1);

    // Connector line + moving energy dot to next node
    if (i < steps.length - 1) {
      const lineX = W / 2;
      const y1 = by + boxH;
      const y2 = by + boxH + gapY;
      ctx.strokeStyle = pal.ink;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(lineX, y1);
      ctx.lineTo(lineX, y2);
      ctx.stroke();

      // Arrowhead
      ctx.fillStyle = pal.ink;
      ctx.beginPath();
      ctx.moveTo(lineX - 14, y2 - 18);
      ctx.lineTo(lineX + 14, y2 - 18);
      ctx.lineTo(lineX, y2 - 2);
      ctx.fill();

      // Animated data pulse traveling down
      const pulseY = y1 + ((t * 1.8 + i * 0.3) % 1) * (gapY - 16);
      ctx.beginPath();
      ctx.arc(lineX, pulseY, 12, 0, Math.PI * 2);
      ctx.fillStyle = '#FACC15';
      ctx.fill();
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0F172A';
      ctx.stroke();
    }

    // Card shadow & body
    roundRect(bx + 10, by + 12, boxW, boxH, 26);
    ctx.fillStyle = '#0F172A';
    ctx.fill();

    roundRect(bx, by, boxW, boxH, 26);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();
    drawGlossSweep(bx, by, boxW, boxH, 26, t + i * 0.6, 3.2);

    // Left icon circle
    ctx.beginPath();
    ctx.arc(bx + 115, by + boxH / 2, 68, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#DBEAFE' : (i === 1 ? '#FEF3C7' : '#DCFCE7');
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#0F172A';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '68px sans-serif';
    ctx.fillText(st.icon || '⚡', bx + 115, by + boxH / 2 + 24);

    // Text on right
    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = '900 36px Montserrat, sans-serif';
    ctx.fillText(String(st.title || '').toUpperCase(), bx + 215, by + 92);

    ctx.fillStyle = '#475569';
    ctx.font = '700 28px Montserrat, sans-serif';
    drawWrappedText(st.desc || '', bx + 215, by + 142, boxW - 245, 36);

    ctx.restore();
  });
}

// Mini Presenter PiP di pojok atas (opsional saat data.presenter = "boy" / "girl")
function drawMiniPresenter(charType, t) {
  if (!charType) return;
  const speaking = isSpeakingAt(t);
  const blinking = (t % 3.4) > 3.24;
  const stride = Math.sin(t * 4);
  const px = 148, py = 165;

  ctx.save();
  // Lingkaran avatar berbingkai
  ctx.beginPath();
  ctx.arc(px + 5, py + 6, 86, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(px, py, 86, 0, Math.PI * 2);
  ctx.fillStyle = '#E0F2FE';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(px, py, 83, 0, Math.PI * 2);
  ctx.clip();

  ctx.translate(px, py + 82);
  ctx.scale(0.68, 0.68);
  if (String(charType).toLowerCase() === 'girl') {
    drawGirlCharacter(t, stride * 0.2, speaking, blinking);
  } else {
    drawBoyCharacter(t, stride * 0.2, speaking, blinking, 0.05);
  }
  ctx.restore();
}

// HUD Atas: Progress Bar Waktu Video & Indikator Adegan
function drawTopHud(t, activeIndex, totalScenes, pal) {
  const totalDur = window.SCENES.length ? window.SCENES[window.SCENES.length - 1].end : 1;
  const globalP = Math.min(Math.max(t / Math.max(totalDur, 0.1), 0), 1);

  ctx.fillStyle = pal.isDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(15, 23, 42, 0.14)';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillStyle = pal.isDark ? '#FFD600' : pal.accent;
  ctx.fillRect(0, 0, W * globalP, 12);

  if (totalScenes > 1) {
    const dotGap = 24;
    const startX = W - 64 - (totalScenes - 1) * dotGap;
    for (let i = 0; i < totalScenes; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * dotGap, 54, i === activeIndex ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === activeIndex
        ? (pal.isDark ? '#FFD600' : pal.accent)
        : (pal.isDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(15, 23, 42, 0.25)');
      ctx.fill();
    }
  }
}

// Rotasi tema cerah otomatis antar-adegan agar video selalu segar & tidak monoton
const BRIGHT_ROTATION = ['cream', 'mint', 'lavender', 'coral'];

function draw(t) {
  const active = getActiveScene(t);
  if (!active) return;
  const { index, scene, localT, progress } = active;
  const dur = Math.max(scene.end - scene.start, 0.1);
  const data = scene.data || {};
  const defaultTheme = scene.type === 'character_story'
    ? 'sky'
    : BRIGHT_ROTATION[index % BRIGHT_ROTATION.length];
  const theme = scene.theme || defaultTheme;
  const pal = getPalette(theme);

  drawBackground(theme, t);

  const enterT = Math.min(localT / 0.28, 1);
  const exitT = Math.min(Math.max((dur - localT) / 0.22, 0), 1);
  const alpha = Math.min(enterT, exitT);
  const camScale = 0.96 + 0.04 * easeOutCubic(enterT) + progress * 0.025;
  const slideY = (1 - easeOutCubic(enterT)) * 45;

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, alpha);
  ctx.translate(W / 2, H / 2 + slideY);
  ctx.scale(camScale, camScale);
  ctx.translate(-W / 2, -H / 2);

  switch (scene.type) {
    case 'statement_card':
      renderStatementCard(data, progress, t, pal);
      break;
    case 'three_cards':
      renderThreeCards(data, progress, t, pal);
      break;
    case 'bar_chart':
      renderBarChart(data, progress, t, pal);
      break;
    case 'calculator':
      renderCalculator(data, progress, t, pal);
      break;
    case 'character_story':
      renderCharacterStory(data, progress, t);
      break;
    case 'dashboard':
      renderDashboard(data, progress, t, pal);
      break;
    case 'calendar_grid':
      renderCalendarGrid(data, progress, t, pal);
      break;
    case 'comparison_vs':
      renderComparisonVs(data, progress, t, pal);
      break;
    case 'code_terminal':
      renderCodeTerminal(data, progress, t, pal);
      break;
    case 'flow_diagram':
      renderFlowDiagram(data, progress, t, pal);
      break;
    case 'cta_closing':
      renderCtaClosing(data, progress, t, pal);
      break;
    case 'big_number':
    default:
      renderBigNumber(data, progress, t, pal);
      break;
  }
  ctx.restore();

  if (scene.type !== 'character_story' && data.presenter) {
    drawMiniPresenter(data.presenter, t);
  }
  drawTopHud(t, index, window.SCENES.length, pal);
}
