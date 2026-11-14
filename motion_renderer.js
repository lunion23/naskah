// motion_renderer.js — Mesin Animasi Infografis & Karakter 2D (1080x1920)
function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
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

// Latar belakang dinamis: "dark" (navy + grid), "sky" (cerah + rumput), "sunset" (senja + gedung)
function drawBackground(theme, t) {
  if (theme === 'sky') {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7cc0f8');
    g.addColorStop(0.65, '#f2e6d0');
    g.addColorStop(1, '#d9cbb3');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // Awan lembut bergerak pelan
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    for (let i = 0; i < 3; i++) {
      const cx = ((i * 420 + t * 18) % (W + 300)) - 150;
      const cy = 220 + i * 110;
      roundRect(cx, cy, 220, 56, 28);
      ctx.fill();
    }

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

  // Default: "dark" (Navy radial + grid lantai perspektif + partikel emas)
  const g = ctx.createRadialGradient(W / 2, H * 0.35, 80, W / 2, H * 0.5, H * 0.85);
  g.addColorStop(0, '#10254d');
  g.addColorStop(1, '#060d1f');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.strokeStyle = 'rgba(90, 145, 255, 0.14)';
  ctx.lineWidth = 2;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(W / 2 + i * 90, 1280);
    ctx.lineTo(W / 2 + i * 240, H);
    ctx.stroke();
  }
  for (let r = 0; r < 6; r++) {
    const y = 1280 + Math.pow(r / 5, 1.4) * 640;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }
  ctx.restore();

  for (let i = 0; i < 24; i++) {
    const px = ((i * 197 + t * (12 + (i % 5) * 4)) % (W + 80)) - 40;
    const py = ((i * 311 - t * (18 + (i % 4) * 6)) % H + H) % H;
    ctx.fillStyle = i % 3 === 0 ? 'rgba(255,214,0,0.45)' : 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.arc(px, py, (i % 3) + 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
}

// 1. BIG NUMBER / HOOK (posisi dinamis agar judul & subjudul tidak pernah bertabrakan)
function renderBigNumber(data, p) {
  const scale = 0.88 + 0.12 * easeOutBack(Math.min(p * 2.5, 1));
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
  const centerY = 740;
  const startY = -totalH / 2 + headSize * 0.85;

  ctx.save();
  ctx.translate(W / 2, centerY);
  ctx.scale(scale, scale);

  if (data.rays) {
    ctx.save();
    ctx.rotate(p * 0.4);
    for (let i = 0; i < 16; i++) {
      ctx.rotate(Math.PI / 8);
      ctx.strokeStyle = 'rgba(255, 214, 0, 0.14)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -680); ctx.stroke();
    }
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = `900 ${headSize}px Montserrat, sans-serif`;
  headLines.forEach((l, i) => {
    ctx.fillText(l, 0, startY + i * headLineH);
  });

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

// 1B. STATEMENT CARD (Kartu Narasi / Fakta untuk mode teks maupun storyboard)
function renderStatementCard(data, p) {
  const enter = easeOutBack(Math.min(p * 2.4, 1));
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 410 + (1 - enter) * 90;

  ctx.save();
  ctx.globalAlpha = Math.min(enter * 1.5, 1);

  roundRect(cx, cy, cw, ch, 32);
  ctx.fillStyle = 'rgba(13, 28, 60, 0.94)';
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#FFD600';
  ctx.stroke();

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

  // Ikon visual
  ctx.font = '115px sans-serif';
  ctx.fillText(data.icon || '💡', W / 2, cy + 195);

  // Angka / Sorotan utama jika ada
  let textStartY = cy + 310;
  if (data.highlight) {
    ctx.fillStyle = '#FFD600';
    ctx.font = '900 64px Montserrat, sans-serif';
    const hLines = drawWrappedText(String(data.highlight).toUpperCase(), W / 2, cy + 295, cw - 110, 74);
    textStartY = cy + 295 + hLines * 74 + 28;
  }

  // Isi kalimat utama
  const body = data.body || data.subheadline || data.headline || '';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 42px Montserrat, sans-serif';
  drawWrappedText(body, W / 2, textStartY, cw - 120, 56);

  ctx.restore();
}

// 2. THREE CARDS
function renderThreeCards(data, p) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 52px Montserrat, sans-serif';
  drawWrappedText(data.title || 'SUMBER PENDAPATAN', W / 2, 230, 940, 62);

  const cards = (data.cards || ['POIN 1', 'POIN 2', 'POIN 3']).slice(0, 3);
  const icons = ['🧾', '🚢', '📦'];
  const cardW = 290, cardH = 620, gap = 32;
  const startX = (W - (cardW * 3 + gap * 2)) / 2;

  cards.forEach((label, idx) => {
    const enter = easeOutBack(Math.max(0, Math.min((p * 2.2) - idx * 0.22, 1)));
    const cx = startX + idx * (cardW + gap);
    const cy = 440 + (1 - enter) * 180;

    ctx.save();
    ctx.globalAlpha = Math.min(enter * 1.4, 1);
    roundRect(cx, cy, cardW, cardH, 24);
    ctx.fillStyle = '#F7F5EE';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    ctx.font = '120px sans-serif';
    ctx.fillText(data.icons?.[idx] || icons[idx], cx + cardW / 2, cy + 280);

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
    roundRect(W / 2 - 220, 1140, 440, 74, 18);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(data.badge, W / 2, 1188);
  }
}

// 3. BAR CHART
function renderBarChart(data, p) {
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

    ctx.fillStyle = '#A8C5F0';
    ctx.font = '700 28px Montserrat, sans-serif';
    ctx.fillText(data.summary_label || 'TOTAL AKUMULASI', W / 2, 342);
    ctx.fillStyle = '#FFFFFF';
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
    const grow = easeOutCubic(Math.max(0, Math.min((p * 1.8) - i * 0.08, 1)));
    const bh = (b.value / maxVal) * chartH * grow;
    const bx = chartX + i * slotW + (slotW - barW) / 2;
    const by = chartY - bh;

    roundRect(bx, by, barW, bh, 10);
    ctx.fillStyle = b.highlight ? '#F5B82E' : '#5882C4';
    ctx.fill();

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

// 4. CALCULATOR + FALLING COINS
function renderCalculator(data, p) {
  for (let i = 0; i < 10; i++) {
    const cx = 140 + ((i * 173) % (W - 280));
    const cy = ((p * 950 + i * 190) % 620) + 60;
    ctx.beginPath();
    ctx.arc(cx, cy, 44, 0, Math.PI * 2);
    ctx.fillStyle = '#F5B82E';
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.fillStyle = '#111';
    ctx.textAlign = 'center';
    ctx.font = '900 22px Montserrat, sans-serif';
    ctx.fillText(String(2015 + (i % 10)), cx, cy + 8);
  }

  const cw = 640, ch = 820, cx = (W - cw) / 2, cy = 620;
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
  const curNum = Math.round(targetNum * easeOutCubic(Math.min(p * 1.4, 1)));
  ctx.textAlign = 'right';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 72px Montserrat, sans-serif';
  ctx.fillText(`${curNum.toLocaleString('id-ID')} ${data.unit || 'T'}`, cx + cw - 68, cy + 145);

  const keys = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+'];
  keys.forEach((k, idx) => {
    const r = Math.floor(idx / 4), c = idx % 4;
    const bx = cx + 44 + c * 142, by = cy + 230 + r * 112;
    roundRect(bx, by, 124, 92, 16);
    ctx.fillStyle = c === 3 ? '#39558A' : '#283B61';
    ctx.fill();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFF';
    ctx.font = '800 38px Montserrat, sans-serif';
    ctx.fillText(k, bx + 62, by + 60);
  });

  roundRect(cx + 44, cy + 680, cw - 88, 92, 18);
  ctx.fillStyle = '#F5B82E';
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.font = '900 48px Montserrat, sans-serif';
  ctx.fillText('=', cx + cw / 2, cy + 742);
}

// 5. CHARACTER STORY (mendukung kartu angka/nilai ATAU gelembung cerita dari teks)
function renderCharacterStory(data, p) {
  const walkX = W / 2 + Math.sin(p * Math.PI * 2) * 35;
  const bobY = Math.abs(Math.sin(p * Math.PI * 6)) * 12;

  const cardPop = easeOutBack(Math.min(p * 2.5, 1));
  ctx.save();
  ctx.translate(W / 2, 450);
  ctx.scale(cardPop, cardPop);

  if (data.card_value) {
    roundRect(-310, -110, 620, 220, 24);
    ctx.fillStyle = data.card_color || '#4F8A5B';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '900 68px Montserrat, sans-serif';
    ctx.fillText(data.card_value, 0, 24);
  } else if (data.quote) {
    roundRect(-410, -135, 820, 270, 28);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#111111';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#111111';
    ctx.font = '800 38px Montserrat, sans-serif';
    drawWrappedText(data.quote, 0, -42, 740, 50);
  }
  ctx.restore();

  const cy = 1140 - bobY;
  ctx.save();
  ctx.translate(walkX, cy);
  ctx.lineWidth = 6;
  ctx.strokeStyle = '#111111';

  // Kaki
  ctx.beginPath(); ctx.moveTo(-22, 190); ctx.lineTo(-22, 310); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(22, 190); ctx.lineTo(22, 310); ctx.stroke();

  // Gaun Trapesium Oranye
  ctx.beginPath();
  ctx.moveTo(-42, 30); ctx.lineTo(42, 30);
  ctx.lineTo(76, 195); ctx.lineTo(-76, 195);
  ctx.closePath();
  ctx.fillStyle = '#E86A33';
  ctx.fill(); ctx.stroke();

  // Sanggul & Kepala
  ctx.beginPath(); ctx.arc(0, -108, 32, 0, Math.PI * 2); ctx.fillStyle = '#1A1A1A'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -42, 56, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(0, -52, 56, Math.PI, 0); ctx.fillStyle = '#1A1A1A'; ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(-18, -36, 5, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(18, -36, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  if (data.banner) {
    roundRect(110, 810, W - 220, 86, 18);
    ctx.fillStyle = '#FFD600';
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#111';
    ctx.stroke();
    ctx.textAlign = 'center';
    ctx.fillStyle = '#111';
    ctx.font = '900 34px Montserrat, sans-serif';
    ctx.fillText(String(data.banner).toUpperCase(), W / 2, 866);
  }
}

// 6. DASHBOARD KEUANGAN
function renderDashboard(data, p) {
  const cw = 900, ch = 760, cx = (W - cw) / 2, cy = 440;
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
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 54px Montserrat, sans-serif';
  ctx.fillText(data.main_value || 'Rp15.000.000', W / 2, cy + 238);

  const items = (data.items || ['MAKAN', 'LISTRIK', 'INTERNET', 'TABUNGAN']).slice(0, 4);
  const icons = ['🍜', '⚡', '📶', '💰'];
  items.forEach((it, i) => {
    const bw = 186, bx = cx + 46 + i * 206, by = cy + 315;
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

// 7. CALENDAR GRID
function renderCalendarGrid(data, p) {
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

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
  const totalBoxes = Math.min(Number(data.count || 15), 15);

  for (let i = 0; i < totalBoxes; i++) {
    const r = Math.floor(i / 5), c = i % 5;
    const bw = 148, bh = 136;
    const bx = cx + 48 + c * 164, by = cy + 120 + r * 154;
    const active = p >= (i / totalBoxes) * 0.75;

    roundRect(bx, by, bw, bh, 16);
    ctx.fillStyle = active ? '#E5B238' : '#1B2F59';
    ctx.fill();
    ctx.fillStyle = active ? '#111' : '#DCE8FF';
    ctx.font = '800 28px Montserrat, sans-serif';
    ctx.fillText(months[i], bx + bw / 2, by + 56);
    ctx.font = '900 24px Montserrat, sans-serif';
    ctx.fillText(data.unit_label || '10 JT ✓', bx + bw / 2, by + 104);
  }

  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 42px Montserrat, sans-serif';
  ctx.fillText(data.formula || 'Rp10 JT × 15 = Rp150 JT', W / 2, cy + 685);

  if (p > 0.72 && data.stamp) {
    ctx.save();
    ctx.translate(W / 2, 1280);
    ctx.rotate(-0.07);
    roundRect(-260, -55, 520, 110, 18);
    ctx.fillStyle = '#0B1938';
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#FFD600';
    ctx.stroke();
    ctx.fillStyle = '#FFD600';
    ctx.font = '900 54px Montserrat, sans-serif';
    ctx.fillText(data.stamp, 0, 20);
    ctx.restore();
  }
}

// 8. CTA CLOSING
function renderCtaClosing(data, p) {
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD600';
  ctx.font = '900 62px Montserrat, sans-serif';
  const hLines = drawWrappedText(data.headline || 'BAGAIMANA PENDAPATMU?', W / 2, 560, 920, 76);

  const subY = 560 + hLines * 76 + 34;
  ctx.fillStyle = '#DCE8FF';
  ctx.font = '700 36px Montserrat, sans-serif';
  const sLines = drawWrappedText(
    data.subheadline || 'Tulis di kolom komentar, dan follow untuk video selanjutnya!',
    W / 2,
    subY,
    860,
    48
  );

  const btnY = Math.max(subY + sLines * 48 + 54, 980);
  roundRect(140, btnY, 380, 96, 48);
  ctx.fillStyle = '#2B59A2';
  ctx.fill();
  ctx.fillStyle = '#FFF';
  ctx.font = '900 34px Montserrat, sans-serif';
  ctx.fillText('💬 KOMENTAR', 330, btnY + 60);

  roundRect(560, btnY, 380, 96, 48);
  ctx.fillStyle = '#E5B238';
  ctx.fill();
  ctx.fillStyle = '#111';
  ctx.fillText('♥ FOLLOW', 750, btnY + 60);
}

// Loop Utama
function draw(t) {
  const active = getActiveScene(t);
  if (!active) return;
  const { scene, progress } = active;
  const data = scene.data || {};
  const theme = scene.theme || (scene.type === 'character_story' ? 'sky' : 'dark');

  drawBackground(theme, t);

  switch (scene.type) {
    case 'statement_card':
      renderStatementCard(data, progress);
      break;
    case 'three_cards':
      renderThreeCards(data, progress);
      break;
    case 'bar_chart':
      renderBarChart(data, progress);
      break;
    case 'calculator':
      renderCalculator(data, progress);
      break;
    case 'character_story':
      renderCharacterStory(data, progress);
      break;
    case 'dashboard':
      renderDashboard(data, progress);
      break;
    case 'calendar_grid':
      renderCalendarGrid(data, progress);
      break;
    case 'cta_closing':
      renderCtaClosing(data, progress);
      break;
    case 'big_number':
    default:
      renderBigNumber(data, progress);
      break;
  }
}
