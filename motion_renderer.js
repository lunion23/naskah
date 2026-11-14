// motion_renderer.js v6 — Mesin Animasi Infografis & Karakter 2D Sinematik (1080x1920)
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
  grad.addColorStop(0.5, 'rgba(255,255,255,0.24)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}

// Percikan konfeti/bintang emas untuk momen klimaks
function drawGoldBurst(cx, cy, t, triggerP, p) {
  if (p < triggerP) return;
  const age = Math.min((p - triggerP) / Math.max(1 - triggerP, 0.2), 1);
  const alpha = Math.max(0, 1 - age * 1.15);
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  for (let i = 0; i < 22; i++) {
    const ang = (i / 22) * Math.PI * 2 + (i % 3) * 0.15;
    const dist = (70 + (i % 5) * 45) * easeOutCubic(age) * 2.2;
    const px = cx + Math.cos(ang) * dist;
    const py = cy + Math.sin(ang) * dist + age * age * 140;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(ang + t * 5);
    ctx.fillStyle = i % 2 === 0 ? '#FFD600' : '#FFF3B0';
    ctx.fillRect(-10, -6, 20, 12);
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

// Latar belakang dinamis dengan parallax & cahaya atmosferik
function drawBackground(theme, t) {
  if (theme === 'sky') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#6bb8f7');
    g.addColorStop(0.62, '#f5e9d3');
    g.addColorStop(1, '#dfd0b8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Matahari hangat berdenyut halus
    const sunR = 110 + Math.sin(t * 2) * 5;
    const sg = ctx.createRadialGradient(860, 260, 20, 860, 260, sunR * 2.1);
    sg.addColorStop(0, 'rgba(255, 244, 180, 0.9)');
    sg.addColorStop(0.45, 'rgba(255, 224, 120, 0.35)');
    sg.addColorStop(1, 'rgba(255, 224, 120, 0)');
    ctx.fillStyle = sg;
    ctx.beginPath(); ctx.arc(860, 260, sunR * 2.1, 0, Math.PI * 2); ctx.fill();

    // Awan berlapis 2 kecepatan
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    for (let i = 0; i < 4; i++) {
      const speed = i % 2 === 0 ? 22 : 14;
      const cx = ((i * 360 + t * speed) % (W + 340)) - 170;
      const cy = 190 + i * 95;
      roundRect(cx, cy, 240, 58, 29);
      ctx.fill();
    }

    // Bukit latar
    ctx.fillStyle = '#7bb661';
    ctx.beginPath();
    ctx.moveTo(0, 1460);
    ctx.quadraticCurveTo(280, 1360, 580, 1460);
    ctx.quadraticCurveTo(860, 1370, W, 1460);
    ctx.lineTo(W, 1500);
    ctx.lineTo(0, 1500);
    ctx.fill();

    // Tanah rumput
    ctx.fillStyle = '#4e9a51';
    ctx.fillRect(0, 1460, W, H - 1460);
    ctx.strokeStyle = '#111';
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

  // Default: "dark" (Navy radial + grid lantai bergerak + partikel emas berkilau)
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.5, H * 0.85);
  g.addColorStop(0, '#122b59');
  g.addColorStop(1, '#050b1a');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Sorotan lampu atas lembut
  const spot = ctx.createRadialGradient(W / 2, 180, 20, W / 2, 320, 650);
  spot.addColorStop(0, 'rgba(72, 138, 255, 0.16)');
  spot.addColorStop(1, 'rgba(72, 138, 255, 0)');
  ctx.fillStyle = spot;
  ctx.fillRect(0, 0, W, H);

  // Grid lantai perspektif bergerak maju perlahan
  ctx.save();
  ctx.strokeStyle = 'rgba(90, 145, 255, 0.16)';
  ctx.lineWidth = 2;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 90, 1280);
    ctx.lineTo(W / 2 + i * 240, H);
    ctx.stroke();
  }
  const scroll = (t * 0.35) % 1;
  for (let r = 0; r < 7; r++) {
    const frac = Math.min((r + scroll) / 6, 1);
    const y = 1280 + Math.pow(frac, 1.45) * 640;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  // Partikel emas melayang
  for (let i = 0; i < 28; i++) {
    const px = ((i * 197 + t * (14 + (i % 5) * 4) + Math.sin(t + i) * 18) % (W + 80)) - 40;
    const py = ((i * 311 - t * (22 + (i % 4) * 7)) % H + H) % H;
    const pulse = 0.65 + 0.35 * Math.sin(t * 3 + i);
    ctx.fillStyle = i % 3 === 0
      ? `rgba(255, 214, 0, ${(0.52 * pulse).toFixed(2)})`
      : `rgba(255, 255, 255, ${(0.24 * pulse).toFixed(2)})`;
    ctx.beginPath();
    ctx.arc(px, py, (i % 3) + 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 1. BIG NUMBER / HOOK
function renderBigNumber(data, p, t) {
  const pop = 0.86 + 0.14 * easeOutBack(Math.min(p * 2.6, 1));
  const breathe = 1 + Math.sin(t * 2.6) * 0.018;
  const floatY = Math.sin(t * 2.2) * 10;
  const headline = String(data.headline || 'RP25.000 TRILIUN').toUpperCase();
  const subheadline = data.subheadline ? String(data.subheadline) : '';

  const headSize = headline.length > 42 ? 72 : (headline.length > 26 ? 86 : 102);
  const headLineH = Math.round(headSize * 1.14);
  const subSize = 42;
  const subLineH = 54;

  ctx.font = `900 ${headSize}px Montserrat, sans-serif`;
  const headLines = wrapLines(headline, 920);

  ctx.font = `700 ${subSize}px Montserrat, sans-serif`;
  const subLines = subheadline ? wrapLines(subheadline, 880) : [];

  const gap = subLines.length ? 44 : 0;
  const totalH = headLines.length * headLineH + gap + subLines.length * subLineH;
  const centerY = 740 + floatY;
  const startY = -totalH / 2 + headSize * 0.85;

  ctx.save();
  ctx.translate(W / 2, centerY);
  ctx.scale(pop * breathe, pop * breathe);

  if (data.rays) {
    ctx.save();
    ctx.rotate(t * 0.28);
    for (let i = 0; i < 18; i++) {
      ctx.rotate(Math.PI / 9);
      ctx.strokeStyle = i % 2 === 0 ? 'rgba(255, 214, 0, 0.16)' : 'rgba(255, 214, 0, 0.06)';
      ctx.lineWidth = i % 2 === 0 ? 4 : 2;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -720); ctx.stroke();
    }
    ctx.restore();
  }

  // Glow halus di belakang teks utama
  ctx.shadowColor = 'rgba(255, 214, 0, 0.35)';
  ctx.shadowBlur = 28;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = `900 ${headSize}px Montserrat, sans-serif`;
  headLines.forEach((l, i) => {
    ctx.fillText(l, 0, startY + i * headLineH);
  });
  ctx.shadowBlur = 0;

  if (subLines.length) {
    const subStartY = startY + headLines.length * headLineH + gap - (headLineH - headSize);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = `700 ${subSize}px Montserrat, sans-serif`;
    subLines.forEach((l, i) => {
      ctx.fillText(l, 0, subStartY + i * subLineH);
    });
  }
  ctx.restore();
}

// 1B. STATEMENT CARD
function renderStatementCard(data, p, t) {
  const enter = easeOutBack(Math.min(p * 2.5, 1));
  const floatY = Math.sin(t * 2.4) * 8;
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 410 + (1 - enter) * 95 + floatY;

  ctx.save();
  ctx.globalAlpha = Math.min(enter * 1.5, 1);

  roundRect(cx, cy, cw, ch, 32);
  ctx.fillStyle = 'rgba(13, 28, 60, 0.94)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFD600';
  ctx.stroke();
  drawGlossSweep(cx, cy, cw, ch, 32, t, 3.6);

  // Badge atas
  const badge = String(data.badge || 'POIN PENTING').toUpperCase();
  roundRect(W / 2 - 220, cy - 36, 440, 72, 36);
  ctx.fillStyle = '#FFD600';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#111';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#111111';
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
    ctx.fillStyle = '#FFD600';
    ctx.font = '900 64px Montserrat, sans-serif';
    const hLines = drawWrappedText(String(data.highlight).toUpperCase(), W / 2, cy + 295, cw - 110, 74);
    textStartY = cy + 295 + hLines * 74 + 28;
  }

  const body = data.body || data.subheadline || data.headline || '';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 42px Montserrat, sans-serif';
  drawWrappedText(body, W / 2, textStartY, cw - 120, 56);

  ctx.restore();
}

// 2. THREE CARDS (dengan floating bergantian & kilau kartu)
function renderThreeCards(data, p, t) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
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
    roundRect(cx, cy, cardW, cardH, 24);
    ctx.fillStyle = '#F7F5EE';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
    ctx.stroke();
    drawGlossSweep(cx, cy, cardW, cardH, 24, t + idx * 0.7, 3.4);

    // Ikon dengan ayunan kecil
    ctx.save();
    ctx.translate(cx + cardW / 2, cy + 245);
    ctx.rotate(Math.sin(t * 3 + idx) * 0.08);
    ctx.font = '120px sans-serif';
    ctx.fillText(data.icons?.[idx] || icons[idx], 0, 35);
    ctx.restore();

    roundRect(cx + 24, cy + 480, cardW - 48, 76, 14);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    ctx.fillStyle = '#111111';
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
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(data.badge, 0, 11);
    ctx.restore();
  }
}

// 3. BAR CHART
function renderBarChart(data, p, t) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 48px Montserrat, sans-serif';
  ctx.fillText(data.title || 'GRAFIK DATA TAHUNAN', W / 2, 190);

  if (data.subtitle) {
    ctx.fillStyle = '#9BB8ED';
    ctx.font = '700 30px Montserrat, sans-serif';
    ctx.fillText(data.subtitle, W / 2, 245);
  }

  if (data.summary_value) {
    roundRect(140, 290, W - 280, 140, 20);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawGlossSweep(140, 290, W - 280, 140, 20, t, 3.0);

    ctx.fillStyle = '#A8C5F0';
    ctx.font = '700 28px Montserrat, sans-serif';
    ctx.fillText(data.summary_label || 'TOTAL AKUMULASI', W / 2, 342);
    ctx.fillStyle = '#FFD600';
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
    ctx.strokeStyle = '#FFD600';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(chartX, ty); ctx.lineTo(chartX + chartW, ty); ctx.stroke();
    ctx.restore();
    ctx.textAlign = 'right';
    ctx.fillStyle = '#FFD600';
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

    roundRect(bx, by, barW, bh, 10);
    ctx.fillStyle = b.highlight ? '#F5B82E' : '#5882C4';
    ctx.fill();
    if (b.highlight && bh > 20) {
      drawGlossSweep(bx, by, barW, bh, 10, t, 2.5);
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = b.highlight ? '#FFD600' : '#DCE8FF';
    ctx.font = '800 24px Montserrat, sans-serif';
    ctx.fillText(b.display || b.value, bx + barW / 2, by - 14);

    ctx.fillStyle = '#9BB8ED';
    ctx.font = '700 26px Montserrat, sans-serif';
    ctx.fillText(b.label, bx + barW / 2, chartY + 42);
  });

  if (data.source) {
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '700 22px Montserrat, sans-serif';
    ctx.fillText('SUMBER: ' + data.source, 90, 1410);
  }
}

// 4. CALCULATOR + FALLING COINS + GOLD BURST
function renderCalculator(data, p, t) {
  for (let i = 0; i < 12; i++) {
    const cx = 130 + ((i * 173) % (W - 260));
    const cy = ((t * 320 + i * 190) % 620) + 50;
    const spin = Math.abs(Math.cos(t * 3 + i));
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(Math.max(0.25, spin), 1);
    ctx.beginPath();
    ctx.arc(0, 0, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#F5B82E';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText('Rp', 0, 8);
    ctx.restore();
  }

  const floatY = Math.sin(t * 2.5) * 6;
  const cw = 640, ch = 820, cx = (W - cw) / 2, cy = 620 + floatY;
  roundRect(cx, cy, cw, ch, 34);
  ctx.fillStyle = '#1E2D4A';
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#3B5687';
  ctx.stroke();

  roundRect(cx + 42, cy + 46, cw - 84, 150, 18);
  ctx.fillStyle = '#0D172A';
  ctx.fill();
  const targetNum = Number(data.number || 25000);
  const countP = Math.min(p * 1.45, 1);
  const curNum = Math.round(targetNum * easeOutCubic(countP));
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 72px Montserrat, sans-serif';
  ctx.fillText(`${curNum.toLocaleString('id-ID')} ${data.unit || 'T'}`, cx + cw - 68, cy + 145);

  const keys = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+'];
  const activeKey = Math.floor(t * 5) % keys.length;
  keys.forEach((k, idx) => {
    const r = Math.floor(idx / 4), c = idx % 4;
    const bx = cx + 44 + c * 142, by = cy + 230 + r * 112;
    const pressed = countP < 0.95 && idx === activeKey;
    roundRect(bx, by + (pressed ? 4 : 0), 124, 92, 16);
    ctx.fillStyle = pressed ? '#4E74BA' : (c === 3 ? '#39558A' : '#283B61');
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF';
    ctx.font = '800 38px Montserrat, sans-serif';
    ctx.fillText(k, bx + 62, by + 60 + (pressed ? 4 : 0));
  });

  const eqPressed = countP >= 0.95;
  roundRect(cx + 44, cy + 680, cw - 88, 92, 18);
  ctx.fillStyle = eqPressed ? '#FFD600' : '#F5B82E';
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = '900 48px Montserrat, sans-serif';
  ctx.fillText('=', cx + cw / 2, cy + 742);

  drawGoldBurst(W / 2, cy + 120, t, 0.72, p);
}

// 5. CHARACTER STORY (Karakter 2D bergerak alami: langkah kaki, ayun tangan, kedip mata, lip-sync)
function renderCharacterStory(data, p, t) {
  const walkX = W / 2 + Math.sin(t * 2.1) * 42;
  const stride = Math.sin(t * 6.5);
  const bobY = Math.abs(stride) * 14;
  const speaking = isSpeakingAt(t);
  const blinking = (t % 3.4) > 3.24;

  // Kartu / Gelembung dialog di atas karakter
  const cardPop = easeOutBack(Math.min(p * 2.6, 1));
  const cardFloat = Math.sin(t * 2.6) * 8;
  ctx.save();
  ctx.translate(W / 2, 430 + cardFloat);
  ctx.scale(cardPop, cardPop);

  if (data.card_value) {
    roundRect(-320, -112, 640, 224, 26);
    ctx.fillStyle = data.card_color || '#4F8A5B';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
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
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    // Ekor gelembung bicara
    ctx.beginPath();
    ctx.moveTo(-24, 138);
    ctx.lineTo(0, 174);
    ctx.lineTo(28, 138);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.font = '800 38px Montserrat, sans-serif';
    drawWrappedText(data.quote, 0, -42, 745, 50);
  }
  ctx.restore();

  // Karakter 2D Artikulasi Penuh
  const cy = 1145 - bobY;
  ctx.save();
  ctx.translate(walkX, cy);
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#111111';

  // Bayangan di rumput
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 315 + bobY, 85 - bobY * 0.6, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Lengan kiri (berayun)
  ctx.save();
  ctx.translate(-46, 52);
  ctx.rotate(0.28 + stride * 0.25);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26, 95); ctx.stroke();
  ctx.beginPath(); ctx.arc(-26, 102, 11, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.restore();

  // Lengan kanan (menunjuk ke atas ke arah kartu!)
  ctx.save();
  ctx.translate(46, 52);
  ctx.rotate(-0.45 + Math.sin(t * 4) * 0.14);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(44, -78); ctx.stroke();
  ctx.beginPath(); ctx.arc(46, -86, 12, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.restore();

  // Kaki & Sepatu melangkah
  const legSwing = stride * 24;
  ctx.beginPath(); ctx.moveTo(-22, 190); ctx.lineTo(-24 - legSwing, 305); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 190); ctx.lineTo(24 + legSwing, 305); ctx.stroke();
  roundRect(-42 - legSwing, 296, 36, 18, 8); ctx.fillStyle = '#222'; ctx.fill(); ctx.stroke();
  roundRect(8 + legSwing, 296, 36, 18, 8); ctx.fillStyle = '#222'; ctx.fill(); ctx.stroke();

  // Gaun Trapesium Oranye
  ctx.beginPath();
  ctx.moveTo(-44, 30); ctx.lineTo(44, 30);
  ctx.lineTo(78, 195); ctx.lineTo(-78, 195);
  ctx.closePath();
  ctx.fillStyle = '#E86A33';
  ctx.fill(); ctx.stroke();

  // Sanggul & Kepala (sedikit mengangguk saat bicara)
  ctx.save();
  ctx.rotate(speaking ? Math.sin(t * 8) * 0.03 : 0);
  ctx.beginPath(); ctx.arc(0, -108, 32, 0, Math.PI * 2); ctx.fillStyle = '#1A1A1A'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -42, 56, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -52, 56, Math.PI, 0); ctx.fillStyle = '#1A1A1A'; ctx.fill(); ctx.stroke();

  // Mata (berkedip otomatis)
  ctx.fillStyle = '#111';
  if (blinking) {
    ctx.beginPath(); ctx.moveTo(-25, -36); ctx.lineTo(-11, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(11, -36); ctx.lineTo(25, -36); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-18, -36, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(18, -36, 5.5, 0, Math.PI * 2); ctx.fill();
  }

  // Mulut lip-sync sinkron narasi
  if (speaking) {
    const openH = 4 + Math.abs(Math.sin(t * 19)) * 9;
    ctx.fillStyle = '#8B2635';
    ctx.beginPath();
    ctx.ellipse(0, -14, 11, openH, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.arc(0, -18, 12, 0.2, Math.PI - 0.2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();

  if (data.banner) {
    roundRect(110, 810, W - 220, 86, 18);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    drawGlossSweep(110, 810, W - 220, 86, 18, t, 3.2);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(String(data.banner).toUpperCase(), W / 2, 866);
  }
}

// 6. DASHBOARD KEUANGAN
function renderDashboard(data, p, t) {
  const enter = easeOutBack(Math.min(p * 2.5, 1));
  const floatY = Math.sin(t * 2.2) * 6;
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 440 + (1 - enter) * 80 + floatY;

  roundRect(cx, cy, cw, ch, 30);
  ctx.fillStyle = '#101F3D';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#33538F';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.title || 'DASHBOARD KEUANGAN', W / 2, cy + 78);

  roundRect(cx + 46, cy + 165, cw - 92, 110, 18);
  ctx.fillStyle = '#E5B238';
  ctx.fill();
  drawGlossSweep(cx + 46, cy + 165, cw - 92, 110, 18, t, 2.8);
  ctx.fillStyle = '#111';
  ctx.font = '900 54px Montserrat, sans-serif';
  ctx.fillText(data.main_value || 'Rp15.000.000', W / 2, cy + 238);

  const items = (data.items || ['MAKAN', 'LISTRIK', 'INTERNET', 'TABUNGAN']).slice(0, 4);
  const icons = ['🍜', '⚡', '📶', '💰'];
  items.forEach((it, i) => {
    const bw = 186, bx = cx + 46 + i * 206, by = cy + 315 + Math.sin(t * 3 + i) * 5;
    roundRect(bx, by, bw, 175, 16);
    ctx.fillStyle = '#182C54';
    ctx.fill();
    ctx.strokeStyle = '#385A99';
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.font = '56px sans-serif';
    ctx.fillText(icons[i], bx + bw / 2, by + 84);
    ctx.fillStyle = '#DCE8FF';
    ctx.font = '800 22px Montserrat, sans-serif';
    ctx.fillText(String(it).toUpperCase(), bx + bw / 2, by + 144);
  });

  roundRect(cx + 46, cy + 565, cw - 92, 100, 18);
  ctx.fillStyle = '#182C54';
  ctx.fill();
  ctx.strokeStyle = '#E86A33';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 46px Montserrat, sans-serif';
  ctx.fillText(data.sub_value || 'Rp1.500.000', cx + 78, cy + 632);
}

// 7. CALENDAR GRID + GOLD BURST
function renderCalendarGrid(data, p, t) {
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 380;
  roundRect(cx, cy, cw, ch, 30);
  ctx.fillStyle = '#101F3D';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#33538F';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
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
    ctx.fillStyle = active ? '#E5B238' : '#1B2F59';
    ctx.fill();
    ctx.fillStyle = active ? '#111' : '#DCE8FF';
    ctx.font = '800 26px Montserrat, sans-serif';
    ctx.fillText((data.labels?.[i] || months[i]), bx + bw / 2, by + 56);
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText(data.unit_label || '10 JT ✓', bx + bw / 2, by + 104);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.formula || 'Rp10 JT × 15 = Rp150 JT', W / 2, cy + 685);

  if (p > 0.72 && data.stamp) {
    const stampP = easeOutBack(Math.min((p - 0.72) * 5, 1));
    ctx.save();
    ctx.translate(W / 2, 1280);
    ctx.scale(stampP, stampP);
    ctx.rotate(-0.06);
    roundRect(-275, -55, 550, 110, 18);
    ctx.fillStyle = '#0B1938';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFD600';
    ctx.stroke();
    ctx.fillStyle = '#FFD600';
    ctx.font = '900 50px Montserrat, sans-serif';
    ctx.fillText(data.stamp, 0, 18);
    ctx.restore();
    drawGoldBurst(W / 2, 1280, t, 0.72, p);
  }
}

// 8. COMPARISON VS (Perbandingan Kiri vs Kanan)
function renderComparisonVs(data, p, t) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 50px Montserrat, sans-serif';
  drawWrappedText(data.title || 'PERBANDINGAN PILIHAN', W / 2, 220, 940, 60);

  const leftEnter = easeOutBack(Math.min(p * 2.6, 1));
  const rightEnter = easeOutBack(Math.max(0, Math.min((p - 0.12) * 2.6, 1)));
  const cardW = 420, cardH = 740, topY = 390;

  // Kartu Kiri
  ctx.save();
  ctx.translate(90 + cardW / 2 - (1 - leftEnter) * 260, topY + cardH / 2 + Math.sin(t * 2.5) * 7);
  ctx.globalAlpha = Math.min(leftEnter * 1.4, 1);
  roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  ctx.fillStyle = '#1B2D52';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FF6B6B';
  ctx.stroke();
  ctx.font = '115px sans-serif';
  ctx.fillText(data.left_icon || '❌', 0, -140);
  ctx.fillStyle = '#FF8787';
  ctx.font = '900 36px Montserrat, sans-serif';
  drawWrappedText(data.left_title || 'PILIHAN A', 0, -20, cardW - 50, 44);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px Montserrat, sans-serif';
  drawWrappedText(data.left_value || '', 0, 130, cardW - 50, 52);
  ctx.restore();

  // Kartu Kanan
  ctx.save();
  ctx.translate(W - 90 - cardW / 2 + (1 - rightEnter) * 260, topY + cardH / 2 + Math.sin(t * 2.5 + 1.5) * 7);
  ctx.globalAlpha = Math.min(rightEnter * 1.4, 1);
  roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 28);
  ctx.fillStyle = '#13334C';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFD600';
  ctx.stroke();
  drawGlossSweep(-cardW / 2, -cardH / 2, cardW, cardH, 28, t, 3.0);
  ctx.font = '115px sans-serif';
  ctx.fillText(data.right_icon || '✅', 0, -140);
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 36px Montserrat, sans-serif';
  drawWrappedText(data.right_title || 'PILIHAN B', 0, -20, cardW - 50, 44);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 44px Montserrat, sans-serif';
  drawWrappedText(data.right_value || '', 0, 130, cardW - 50, 52);
  ctx.restore();

  // Lencana VS di tengah
  const vsScale = easeOutBack(Math.min(p * 3, 1)) * (1 + Math.sin(t * 5) * 0.05);
  ctx.save();
  ctx.translate(W / 2, topY + cardH / 2);
  ctx.scale(vsScale, vsScale);
  ctx.beginPath(); ctx.arc(0, 0, 62, 0, Math.PI * 2);
  ctx.fillStyle = '#FFD600'; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = '#111'; ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText('VS', 0, 15);
  ctx.restore();
}

// 9. CTA CLOSING
function renderCtaClosing(data, p, t) {
  const pulse = 1 + Math.sin(t * 4.5) * 0.04;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 62px Montserrat, sans-serif';
  const hLines = drawWrappedText(data.headline || 'BAGAIMANA PENDAPATMU?', W / 2, 540, 920, 76);

  const subY = 540 + hLines * 76 + 34;
  ctx.fillStyle = '#DCE8FF';
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
  ctx.fillStyle = '#2B59A2';
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = '900 34px Montserrat, sans-serif';
  ctx.fillText('💬 KOMENTAR', 330, btnY + 60);

  ctx.save();
  ctx.translate(750, btnY + 48);
  ctx.scale(pulse, pulse);
  roundRect(-190, -48, 380, 96, 48);
  ctx.fillStyle = '#E5B238';
  ctx.fill();
  drawGlossSweep(-190, -48, 380, 96, 48, t, 2.2);
  ctx.fillStyle = '#111';
  ctx.font = '900 34px Montserrat, sans-serif';
  ctx.fillText('♥ FOLLOW', 0, 12);
  ctx.restore();

  drawGoldBurst(W / 2, 480, t, 0.15, p);
}

// HUD Atas: Progress Bar Waktu Video & Indikator Adegan
function drawTopHud(t, activeIndex, totalScenes) {
  const totalDur = window.SCENES.length ? window.SCENES[window.SCENES.length - 1].end : 1;
  const globalP = Math.min(Math.max(t / Math.max(totalDur, 0.1), 0), 1);

  // Garis progres tipis di bagian paling atas layar
  ctx.fillStyle = 'rgba(255, 255, 255, 0.18)';
  ctx.fillRect(0, 0, W, 12);
  ctx.fillStyle = '#FFD600';
  ctx.fillRect(0, 0, W * globalP, 12);

  // Indikator titik adegan di kanan atas
  if (totalScenes > 1) {
    const dotGap = 24;
    const startX = W - 64 - (totalScenes - 1) * dotGap;
    for (let i = 0; i < totalScenes; i++) {
      ctx.beginPath();
      ctx.arc(startX + i * dotGap, 54, i === activeIndex ? 8 : 5, 0, Math.PI * 2);
      ctx.fillStyle = i === activeIndex ? '#FFD600' : 'rgba(255, 255, 255, 0.35)';
      ctx.fill();
    }
  }
}

// Loop Utama dengan Transisi Masuk/Keluar Antar-Adegan
function draw(t) {
  const active = getActiveScene(t);
  if (!active) return;
  const { index, scene, localT, progress } = active;
  const dur = Math.max(scene.end - scene.start, 0.1);
  const data = scene.data || {};
  const theme = scene.theme || (scene.type === 'character_story' ? 'sky' : 'dark');

  drawBackground(theme, t);

  // Transisi masuk (0.28 detik pertama) & keluar (0.22 detik terakhir)
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
      renderStatementCard(data, progress, t);
      break;
    case 'three_cards':
      renderThreeCards(data, progress, t);
      break;
    case 'bar_chart':
      renderBarChart(data, progress, t);
      break;
    case 'calculator':
      renderCalculator(data, progress, t);
      break;
    case 'character_story':
      renderCharacterStory(data, progress, t);
      break;
    case 'dashboard':
      renderDashboard(data, progress, t);
      break;
    case 'calendar_grid':
      renderCalendarGrid(data, progress, t);
      break;
    case 'comparison_vs':
      renderComparisonVs(data, progress, t);
      break;
    case 'cta_closing':
      renderCtaClosing(data, progress, t);
      break;
    case 'big_number':
    default:
      renderBigNumber(data, progress, t);
      break;
  }
  ctx.restore();

  drawTopHud(t, index, window.SCENES.length);
}
