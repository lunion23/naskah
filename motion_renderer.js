// motion_renderer.js v15 — Mesin Infografis & Presenter Dinamis Anti-Bosan (1080x1920)
// Fitur: Transisi Kamera Halus, 9 Tipe Infografis Kaya Visual, Stempel/Sticker Pop-up,
//        Partikel Latar Hidup, Teleprompter Beranimasi, dan Presenter dengan Pergerakan Halus (Lerp).

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

function easeOutBack(x) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function easeOutCubic(x) {
  return 1 - Math.pow(1 - x, 3);
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp01(v) {
  return Math.min(Math.max(v, 0), 1);
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
  if (!isSpeakingAt(t)) return 0.14;
  return 0.38 + Math.abs(Math.sin(t * 14)) * 0.44 + Math.abs(Math.cos(t * 23)) * 0.22;
}

// Palet warna kaya variasi per tema agar tiap adegan terasa segar
const THEMES = {
  cream:    { top: '#FFFBEB', mid: '#FEF3C7', bot: '#E0F2FE', accent: '#EA580C', alt: '#2563EB', dark: '#0F172A' },
  mint:     { top: '#ECFDF5', mid: '#D1FAE5', bot: '#CCFBF1', accent: '#059669', alt: '#0284C7', dark: '#064E3B' },
  lavender: { top: '#F5F3FF', mid: '#EDE9FE', bot: '#FCE7F3', accent: '#7C3AED', alt: '#DB2777', dark: '#1E1B4B' },
  coral:    { top: '#FFF1F2', mid: '#FFE4E6', bot: '#FFEDD5', accent: '#E11D48', alt: '#EA580C', dark: '#4C0519' },
  sky:      { top: '#F0F9FF', mid: '#E0F2FE', bot: '#EEF2FF', accent: '#0284C7', alt: '#4F46E5', dark: '#0C4A6E' },
  dark:     { top: '#0F172A', mid: '#1E293B', bot: '#090D16', accent: '#F97316', alt: '#38BDF8', dark: '#0F172A' }
};

function getThemePalette(themeName) {
  return THEMES[themeName] || THEMES.cream;
}

// =========================================================================
// 1. LATAR DINAMIS DENGAN PARTIKEL MENGAMBANG & GRID BERGERAK
// =========================================================================
function drawDynamicBackground(themeName, t, sceneIndex) {
  const pal = getThemePalette(themeName);
  const isDark = themeName === 'dark';

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, pal.top);
  g.addColorStop(0.55, pal.mid);
  g.addColorStop(1, pal.bot);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // Cahaya aura radial berdenyut di belakang panel atas
  const auraR = 460 + Math.sin(t * 2.2) * 35;
  const rg = ctx.createRadialGradient(W / 2, 430, 40, W / 2, 430, auraR);
  rg.addColorStop(0, isDark ? 'rgba(249, 115, 22, 0.22)' : 'rgba(255, 255, 255, 0.85)');
  rg.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, W, 950);

  // Grid titik bergeser pelan (parallax)
  ctx.fillStyle = isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(15, 23, 42, 0.065)';
  const shiftX = (t * 14) % 64;
  const shiftY = (t * 10) % 64;
  for (let gx = -64 + shiftX; gx < W + 64; gx += 64) {
    for (let gy = -64 + shiftY; gy < H + 64; gy += 64) {
      ctx.beginPath();
      ctx.arc(gx, gy, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Bentuk geometris dekoratif mengambang (lingkaran, segitiga, plus) agar latar tidak mati
  const shapes = [
    { x: 110, y: 260, r: 26, spd: 1.1, kind: 'ring' },
    { x: W - 105, y: 340, r: 22, spd: 1.4, kind: 'plus' },
    { x: 95, y: 1180, r: 30, spd: 0.9, kind: 'dot' },
    { x: W - 95, y: 1090, r: 24, spd: 1.3, kind: 'ring' },
    { x: 150, y: 1510, r: 20, spd: 1.6, kind: 'plus' },
    { x: W - 140, y: 1560, r: 28, spd: 1.2, kind: 'dot' }
  ];
  shapes.forEach((sh, i) => {
    const fy = sh.y + Math.sin(t * sh.spd + i * 1.7 + sceneIndex) * 18;
    const rot = t * 0.5 * (i % 2 === 0 ? 1 : -1);
    ctx.save();
    ctx.translate(sh.x, fy);
    ctx.rotate(rot);
    ctx.globalAlpha = isDark ? 0.22 : 0.16;
    ctx.strokeStyle = i % 2 === 0 ? pal.accent : pal.alt;
    ctx.fillStyle = i % 2 === 0 ? pal.accent : pal.alt;
    ctx.lineWidth = 4;
    if (sh.kind === 'ring') {
      ctx.beginPath(); ctx.arc(0, 0, sh.r, 0, Math.PI * 2); ctx.stroke();
    } else if (sh.kind === 'plus') {
      ctx.beginPath();
      ctx.moveTo(-sh.r * 0.6, 0); ctx.lineTo(sh.r * 0.6, 0);
      ctx.moveTo(0, -sh.r * 0.6); ctx.lineTo(0, sh.r * 0.6);
      ctx.stroke();
    } else {
      ctx.beginPath(); ctx.arc(0, 0, sh.r * 0.45, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  });
}

// =========================================================================
// 2. HEADER ATAS + PROGRESS SEGMENT BAR
// =========================================================================
function drawTopHeader(data, index, pal, isDark) {
  const cat = String(window.CHANNEL_LABEL || data.channel || 'FAKTA & WAWASAN').toUpperCase();
  const badge = String(data.badge || `ADEGAN 0${index + 1}`).toUpperCase();

  ctx.textAlign = 'left';
  ctx.fillStyle = isDark ? '#F8FAFC' : '#0F172A';
  ctx.font = '900 26px Montserrat, sans-serif';
  ctx.fillText('⚡ ' + cat, 70, 92);

  ctx.font = '900 22px Montserrat, sans-serif';
  const bw = Math.min(Math.max(ctx.measureText(badge).width + 48, 200), 420);
  const bx = W - 70 - bw, by = 58, bh = 48;

  // Shadow badge
  roundRect(bx + 4, by + 5, bw, bh, 24);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  roundRect(bx, by, bw, bh, 24);
  ctx.fillStyle = pal.accent;
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(badge, bx + bw / 2, by + 31);
}

// Bingkai Panel Neo-Brutalist dengan Efek Pop-in & Shadow Tebal
function drawPanelCard(x, y, w, h, radius = 26, bgFill = '#FFFFFF') {
  roundRect(x + 9, y + 11, w, h, radius);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  roundRect(x, y, w, h, radius);
  ctx.fillStyle = bgFill;
  ctx.fill();
  ctx.lineWidth = 4.5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();
}

// Stempel / Sticker Pop-up di Sudut Panel Atas
function drawCornerSticker(text, x, y, angleRad, bgColor, scale = 1) {
  if (!text) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angleRad);
  ctx.scale(scale, scale);
  ctx.font = '900 22px Montserrat, sans-serif';
  const tw = ctx.measureText(text).width + 38;
  roundRect(-tw / 2 + 4, -22 + 5, tw, 44, 12);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  roundRect(-tw / 2, -22, tw, 44, 12);
  ctx.fillStyle = bgColor || '#FACC15';
  ctx.fill();
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.fillText(text, 0, 8);
  ctx.restore();
}

// =========================================================================
// 3. PANEL ATAS (Y: 145 .. 715, Tinggi 570px) — 9 TIPE VISUAL INFOGRAFIS
// =========================================================================

// TIPE 1: BIG NUMBER / HOOK ("big_number") — Angka / Fakta Utama Raksasa + Kilau Sinar
function renderTopBigNumber(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28, '#FFFFFF');

  // Sinar berputar lembut di belakang angka utama
  const cx = W / 2, cy = py + 235;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(t * 0.35);
  for (let i = 0; i < 12; i++) {
    ctx.rotate(Math.PI / 6);
    ctx.fillStyle = i % 2 === 0 ? 'rgba(249, 115, 22, 0.08)' : 'rgba(59, 130, 246, 0.06)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-26, -210);
    ctx.lineTo(26, -210);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();

  // Pill kategori atas
  const pill = String(data.pill || 'FAKTA MENGEJUTKAN').toUpperCase();
  roundRect(W / 2 - 190, py + 28, 380, 44, 22);
  ctx.fillStyle = pal.accent;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px Montserrat, sans-serif';
  ctx.fillText(pill, W / 2, py + 57);

  // Angka / Kata Kunci Besar Memantul
  const pop = easeOutBack(clamp01(p * 2.8));
  const mainStat = String(data.stat || data.headline || 'TAHUKAH KAMU?').toUpperCase();
  ctx.save();
  ctx.translate(cx, cy + 15);
  ctx.scale(pop, pop);
  ctx.font = mainStat.length <= 10 ? '900 96px Montserrat, sans-serif' : '900 58px Montserrat, sans-serif';
  ctx.fillStyle = '#0F172A';
  if (mainStat.length <= 14) {
    ctx.fillText(mainStat, 0, 24);
  } else {
    drawWrappedText(mainStat, 0, -18, pw - 110, 68);
  }
  ctx.restore();

  // Kotak kesimpulan bawah
  roundRect(px + 38, py + 412, pw - 76, 112, 18);
  ctx.fillStyle = '#FEF3C7';
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.fillStyle = '#0F172A';
  ctx.font = '800 28px Montserrat, sans-serif';
  drawWrappedText(data.subheadline || 'Simak penjelasan lengkapnya berikut ini!', W / 2, py + 462, pw - 120, 38);

  drawCornerSticker(data.sticker || 'WAJIB TAHU!', px + pw - 115, py + 28, 0.14, '#FACC15', pop);
}

// TIPE 2: CHAT HOOK ("chat_hook") — Gelembung Chat Netizen vs Balasan
function renderTopChatHook(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 28px Montserrat, sans-serif';
  ctx.fillText('💬  ' + (data.header || 'Pertanyaan Populer vs Fakta'), px + 36, py + 58);

  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(px + 32, py + 82); ctx.lineTo(px + pw - 32, py + 82); ctx.stroke();

  // Bubble 1 (Kiri - Pertanyaan)
  const b1 = easeOutBack(clamp01(p * 3.5));
  ctx.save();
  ctx.translate(px + 38, py + 112);
  ctx.scale(b1, b1);
  roundRect(0, 0, pw - 190, 165, 24);
  ctx.fillStyle = '#F1F5F9';
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#CBD5E1'; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 31px Montserrat, sans-serif';
  drawWrappedText(data.question || 'Benarkah hal ini sering bikin orang salah paham?', 28, 56, pw - 245, 44);
  ctx.restore();

  // Indikator mengetik sebelum bubble 2 muncul
  if (p > 0.18 && p <= 0.36) {
    roundRect(px + pw - 190, py + 315, 150, 64, 32);
    ctx.fillStyle = pal.alt;
    ctx.fill();
    for (let d = 0; d < 3; d++) {
      const dy = Math.sin(t * 12 + d * 1.3) * 6;
      ctx.beginPath();
      ctx.arc(px + pw - 142 + d * 26, py + 347 + dy, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
  }

  // Bubble 2 (Kanan - Jawaban Fakta)
  if (p > 0.34) {
    const b2 = easeOutBack(clamp01((p - 0.34) * 3.5));
    const b2w = pw - 190;
    ctx.save();
    ctx.translate(px + pw - 38, py + 312);
    ctx.scale(b2, b2);
    roundRect(-b2w, 0, b2w, 175, 24);
    ctx.fillStyle = pal.alt;
    ctx.fill();
    ctx.lineWidth = 3.5; ctx.strokeStyle = '#0F172A'; ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '800 31px Montserrat, sans-serif';
    drawWrappedText(data.reply || 'Ini dia fakta sebenarnya yang jarang dibahas!', -b2w + 28, 56, b2w - 56, 44);
    ctx.restore();
  }
}

// TIPE 3: STATEMENT CARD ("statement_card") — Kartu Sorotan Fakta dengan Ikon Besar & Angka Highlight
function renderTopStatementCard(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const badge = String(data.badge || 'POIN PENTING').toUpperCase();
  roundRect(px + 34, py + 28, 280, 44, 12);
  ctx.fillStyle = pal.accent;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px Montserrat, sans-serif';
  ctx.fillText(badge, px + 174, py + 57);

  // Kotak Ikon Kiri beranimasi melayang
  const floatY = Math.sin(t * 3.5) * 8;
  const pop = easeOutBack(clamp01(p * 3));
  ctx.save();
  ctx.translate(px + 150, py + 245 + floatY);
  ctx.scale(pop, pop);
  roundRect(-95, -95, 190, 190, 32);
  ctx.fillStyle = '#FEF3C7';
  ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.font = '104px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(data.icon || '💡', 0, 36);
  ctx.restore();

  // Teks Kanan (Highlight Angka + Penjelasan)
  const textX = px + 280;
  const textMaxW = pw - 320;
  ctx.textAlign = 'left';

  if (data.highlight) {
    ctx.fillStyle = pal.accent;
    ctx.font = '900 54px Montserrat, sans-serif';
    ctx.fillText(String(data.highlight), textX, py + 185);
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 32px Montserrat, sans-serif';
    drawWrappedText(data.body || '', textX, py + 245, textMaxW, 44);
  } else {
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 34px Montserrat, sans-serif';
    drawWrappedText(data.body || '', textX, py + 195, textMaxW, 46);
  }

  // Bar highlight bawah
  roundRect(px + 34, py + 436, pw - 68, 86, 16);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#CBD5E1'; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#1E3A8A';
  ctx.font = '800 26px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Fakta Kunci yang Perlu Diingat', W / 2, py + 488);
}

// TIPE 4: GAUGE / PERCENTAGE METER ("gauge_meter") — Meteran Persentase / Skor Melingkar
function renderTopGaugeMeter(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const pill = String(data.pill || 'DATA & STATISTIK').toUpperCase();
  roundRect(W / 2 - 180, py + 26, 360, 44, 22);
  ctx.fillStyle = pal.alt;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 22px Montserrat, sans-serif';
  ctx.fillText(pill, W / 2, py + 55);

  const targetPct = Math.min(Math.max(Number(data.percent || 85), 5), 100);
  const animProg = easeOutCubic(clamp01(p * 1.6));
  const curPct = Math.round(targetPct * animProg);

  const cx = W / 2, cy = py + 265, radius = 145;

  // Lingkaran dasar
  ctx.lineWidth = 28;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#E2E8F0';
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 0.75, Math.PI * 2.25);
  ctx.stroke();

  // Lingkaran progres aktif
  const endAngle = Math.PI * 0.75 + (Math.PI * 1.5) * (curPct / 100);
  ctx.strokeStyle = pal.accent;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 0.75, endAngle);
  ctx.stroke();

  // Angka tengah
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 84px Montserrat, sans-serif';
  ctx.fillText(curPct + '%', cx, cy + 22);

  ctx.fillStyle = '#64748B';
  ctx.font = '800 24px Montserrat, sans-serif';
  ctx.fillText(String(data.sub_label || 'TINGKAT DAMPAK').toUpperCase(), cx, cy + 64);

  // Keterangan bawah
  roundRect(px + 38, py + 448, pw - 76, 78, 16);
  ctx.fillStyle = '#FFF7ED';
  ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = pal.accent; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 27px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Angka ini menunjukkan pengaruh yang sangat besar!', W / 2, py + 496);
}

// TIPE 5: LINE CHART ("line_chart") — Grafik Tren 2 Kurva + Area Gradien
function renderTopLineChart(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const pill = String(data.pill || 'GRAFIK PERKEMBANGAN').toUpperCase();
  roundRect(px + 30, py + 28, 360, 44, 12);
  ctx.fillStyle = pal.accent;
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 210, py + 57);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1E3A8A';
  ctx.font = '800 25px Montserrat, sans-serif';
  ctx.fillText(data.right_label || 'Tren vs Standar', px + pw - 34, py + 58);

  const gx = px + 40, gy = py + 95, gw = pw - 80, gh = 335;
  roundRect(gx, gy, gw, gh, 16);
  ctx.fillStyle = '#F8FAFC';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 1; i <= 3; i++) {
    const ly = gy + (gh / 4) * i;
    ctx.beginPath(); ctx.moveTo(gx + 16, ly); ctx.lineTo(gx + gw - 16, ly); ctx.stroke();
  }

  const drawProg = easeOutCubic(clamp01(p * 1.6));
  const startX = gx + 36, endX = gx + gw - 36;
  const curEndX = startX + (endX - startX) * drawProg;

  ctx.save();
  ctx.setLineDash([12, 8]);
  ctx.strokeStyle = '#3B82F6';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(startX, gy + gh - 45);
  ctx.quadraticCurveTo(gx + gw * 0.5, gy + gh - 68, curEndX, gy + gh - 95 * drawProg - 45 * (1 - drawProg));
  ctx.stroke();
  ctx.restore();

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
  ctx.strokeStyle = pal.accent;
  ctx.lineWidth = 7;
  ctx.stroke();

  ctx.lineTo(lastX, gy + gh - 12);
  ctx.lineTo(startX, gy + gh - 12);
  ctx.closePath();
  const ag = ctx.createLinearGradient(0, gy, 0, gy + gh);
  ag.addColorStop(0, 'rgba(249, 115, 22, 0.28)');
  ag.addColorStop(1, 'rgba(249, 115, 22, 0.02)');
  ctx.fillStyle = ag;
  ctx.fill();

  ctx.beginPath(); ctx.arc(lastX, lastY, 11, 0, Math.PI * 2);
  ctx.fillStyle = pal.accent; ctx.fill();
  ctx.lineWidth = 3; ctx.strokeStyle = '#FFFFFF'; ctx.stroke();
  ctx.restore();

  roundRect(gx + gw - 315, gy + 18, 295, 42, 10);
  ctx.fillStyle = '#DCFCE7'; ctx.fill();
  ctx.strokeStyle = '#16A34A'; ctx.lineWidth = 2; ctx.stroke();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#15803D';
  ctx.font = '800 20px Montserrat, sans-serif';
  ctx.fillText(data.top_tag || 'Meningkat Tajam 🚀', gx + gw - 167, gy + 46);

  roundRect(gx + 22, gy + gh - 66, 285, 42, 10);
  ctx.fillStyle = '#FEF3C7'; ctx.fill();
  ctx.strokeStyle = '#D97706'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#B45309';
  ctx.font = '800 20px Montserrat, sans-serif';
  ctx.fillText(data.bot_tag || 'Cara Lama Tertinggal 🐢', gx + 164, gy + gh - 38);

  roundRect(gx, py + 452, gw, 74, 14);
  ctx.fillStyle = '#F8FAFC'; ctx.fill();
  ctx.strokeStyle = '#CBD5E1'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 26px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Perbedaan Hasilnya Terlihat Sangat Jelas!', W / 2, py + 498);
}

// TIPE 6: TWO CARDS / VS ("two_cards" / "comparison_vs") — Duel Mitos vs Fakta dengan Badge VS
function renderTopTwoCards(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const pill = String(data.pill || 'MITOS VS FAKTA').toUpperCase();
  roundRect(px + 30, py + 28, 360, 44, 12);
  ctx.fillStyle = pal.accent; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 210, py + 57);

  const cards = [
    {
      icon: data.left_icon || '❌',
      title: data.left_title || 'ANGGAPAN UMUM',
      desc: data.left_desc || 'Sering Dipercaya Banyak Orang',
      active: p < 0.48,
      color: '#E11D48',
      bg: '#FFF1F2'
    },
    {
      icon: data.right_icon || '✅',
      title: data.right_title || 'FAKTA SEBENARNYA',
      desc: data.right_desc || 'Terbukti Secara Nyata!',
      active: p >= 0.48,
      color: '#16A34A',
      bg: '#F0FDF4'
    }
  ];

  const cw = (pw - 110) / 2, ch = 325, cy = py + 98;
  cards.forEach((c, i) => {
    const cx = px + 38 + i * (cw + 34);
    const scaleCard = c.active ? 1.02 : 0.96;
    ctx.save();
    ctx.translate(cx + cw / 2, cy + ch / 2);
    ctx.scale(scaleCard, scaleCard);
    ctx.globalAlpha = c.active ? 1.0 : 0.55;
    roundRect(-cw / 2, -ch / 2, cw, ch, 20);
    ctx.fillStyle = c.active ? c.bg : '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = c.active ? 4.5 : 2.5;
    ctx.strokeStyle = c.active ? c.color : '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '76px sans-serif';
    ctx.fillText(c.icon, 0, -35);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 28px Montserrat, sans-serif';
    ctx.fillText(String(c.title).toUpperCase(), 0, 35);

    ctx.fillStyle = '#475569';
    ctx.font = '700 23px Montserrat, sans-serif';
    drawWrappedText(c.desc, 0, 78, cw - 36, 32);
    ctx.restore();
  });

  // Lencana VS di tengah
  ctx.save();
  ctx.translate(W / 2, cy + ch / 2);
  ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2);
  ctx.fillStyle = '#0F172A'; ctx.fill();
  ctx.fillStyle = '#FACC15';
  ctx.font = '900 24px Montserrat, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('VS', 0, 9);
  ctx.restore();

  roundRect(px + 38, py + 450, pw - 76, 76, 14);
  ctx.fillStyle = '#FEFCE8'; ctx.fill();
  ctx.strokeStyle = '#EAB308'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 26px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Jangan Sampai Tertukar Lagi Ya!', W / 2, py + 497);
}

// TIPE 7: THREE CARDS ("three_cards") — 3 Kartu Berjajar dengan Highlight Bergantian
function renderTopThreeCards(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const pill = String(data.pill || '3 POIN UTAMA').toUpperCase();
  roundRect(px + 30, py + 28, 380, 44, 12);
  ctx.fillStyle = pal.alt; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 220, py + 57);

  const items = (data.cards || [
    { icon: '1️⃣', title: 'Poin Pertama', desc: 'Dasar Utama' },
    { icon: '2️⃣', title: 'Poin Kedua', desc: 'Proses Kunci' },
    { icon: '3️⃣', title: 'Poin Ketiga', desc: 'Hasil Akhir' }
  ]).slice(0, 3);

  const activeIdx = Math.min(2, Math.floor(p * 3));
  const gap = 22, cw = (pw - 76 - gap * 2) / 3, ch = 325, cy = py + 98;

  items.forEach((it, i) => {
    const isAct = i === activeIdx;
    const cx = px + 38 + i * (cw + gap);
    const title = typeof it === 'string' ? it : it.title;
    const desc = typeof it === 'string' ? '' : (it.desc || '');
    const icon = (typeof it === 'object' && it.icon) ? it.icon : (data.icons?.[i] || ['💡', '⚙️', '🚀'][i]);

    ctx.save();
    ctx.translate(cx + cw / 2, cy + ch / 2 + (isAct ? -8 : 0));
    ctx.globalAlpha = isAct ? 1.0 : 0.56;
    roundRect(-cw / 2, -ch / 2, cw, ch, 18);
    ctx.fillStyle = isAct ? '#EFF6FF' : '#F8FAFC';
    ctx.fill();
    ctx.lineWidth = isAct ? 4.5 : 2.5;
    ctx.strokeStyle = isAct ? pal.alt : '#CBD5E1';
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.font = '68px sans-serif';
    ctx.fillText(icon, 0, -42);

    ctx.fillStyle = '#0F172A';
    ctx.font = '900 25px Montserrat, sans-serif';
    drawWrappedText(title, 0, 22, cw - 20, 30);

    ctx.fillStyle = '#475569';
    ctx.font = '700 21px Montserrat, sans-serif';
    drawWrappedText(desc, 0, 82, cw - 22, 28);
    ctx.restore();
  });

  roundRect(px + 38, py + 450, pw - 76, 76, 14);
  ctx.fillStyle = '#FEFCE8'; ctx.fill();
  ctx.strokeStyle = '#EAB308'; ctx.lineWidth = 2.5; ctx.stroke();
  ctx.fillStyle = '#0F172A';
  ctx.font = '800 25px Montserrat, sans-serif';
  ctx.fillText(data.footer || 'Ketiga Faktor Ini Saling Berkaitan Erat!', W / 2, py + 497);
}

// TIPE 8: CHECKLIST ("checklist") — Langkah Tercentang Berurutan
function renderTopChecklist(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  const pill = String(data.pill || 'LANGKAH & RANGKAIAN').toUpperCase();
  roundRect(px + 30, py + 28, 380, 44, 12);
  ctx.fillStyle = pal.accent; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '800 22px Montserrat, sans-serif';
  ctx.fillText(pill, px + 220, py + 57);

  const steps = (data.steps || [
    'Pahami Konsep Dasarnya Terlebih Dahulu',
    'Terapkan Secara Konsisten Setiap Hari',
    'Evaluasi Hasil & Perbaiki Kekurangan',
    'Rasakan Perubahan Signifikan!'
  ]).slice(0, 4);

  const doneCount = Math.min(steps.length, Math.floor(p * (steps.length + 0.6)));
  steps.forEach((st, i) => {
    const ry = py + 100 + i * 106;
    const isDone = i < doneCount;
    const isCurrent = i === doneCount;

    roundRect(px + 36, ry, pw - 72, 88, 16);
    ctx.fillStyle = isDone ? '#ECFDF5' : (isCurrent ? '#FFF7ED' : '#F8FAFC');
    ctx.fill();
    ctx.lineWidth = (isDone || isCurrent) ? 3.5 : 2;
    ctx.strokeStyle = isDone ? '#10B981' : (isCurrent ? pal.accent : '#CBD5E1');
    ctx.stroke();

    roundRect(px + 54, ry + 20, 48, 48, 12);
    ctx.fillStyle = isDone ? '#10B981' : (isCurrent ? pal.accent : '#E2E8F0');
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = (isDone || isCurrent) ? '#FFFFFF' : '#475569';
    ctx.font = '900 26px Montserrat, sans-serif';
    ctx.fillText(isDone ? '✓' : String(i + 1), px + 78, ry + 53);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 27px Montserrat, sans-serif';
    ctx.fillText(st, px + 124, ry + 54);
  });
}

// TIPE 9: CTA CLOSING ("cta_closing") — Kartu Penutup Interaktif
function renderTopCtaCard(data, p, t, pal) {
  const px = 70, py = 148, pw = W - 140, ph = 562;
  drawPanelCard(px, py, pw, ph, 28);

  roundRect(W / 2 - 180, py + 32, 360, 42, 21);
  ctx.fillStyle = '#E2E8F0'; ctx.fill();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.font = '900 21px Montserrat, sans-serif';
  ctx.fillText(String(data.pill || 'KESIMPULAN UTAMA').toUpperCase(), W / 2, py + 59);

  const starScale = 1 + Math.sin(t * 4.5) * 0.08;
  ctx.save();
  ctx.translate(W / 2, py + 178);
  ctx.scale(starScale, starScale);
  ctx.beginPath(); ctx.arc(0, 0, 58, 0, Math.PI * 2);
  ctx.fillStyle = '#FEF3C7'; ctx.fill();
  ctx.lineWidth = 4; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.font = '60px sans-serif';
  ctx.fillText(data.icon || '🔥', 0, 21);
  ctx.restore();

  ctx.fillStyle = '#0F172A';
  ctx.font = '900 40px Montserrat, sans-serif';
  drawWrappedText(data.headline || 'Sekarang Kamu Sudah Tahu Faktanya!', W / 2, py + 310, pw - 90, 50);

  const pulse = 1 + Math.sin(t * 5) * 0.03;
  ctx.save();
  ctx.translate(W / 2, py + 462);
  ctx.scale(pulse, pulse);
  roundRect(-(pw - 110) / 2, -40, pw - 110, 80, 18);
  ctx.fillStyle = pal.accent; ctx.fill();
  ctx.lineWidth = 3.5; ctx.strokeStyle = '#0F172A'; ctx.stroke();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = '900 26px Montserrat, sans-serif';
  ctx.fillText(data.subheadline || 'Tulis Pendapatmu di Kolom Komentar!', 0, 10);
  ctx.restore();
}

// =========================================================================
// 4. PANEL TENGAH: KARTU TELEPROMPTER KATA-PER-KATA + EQUALIZER
// =========================================================================
function renderTeleprompterCard(scene, t, data, pal) {
  const px = 70, py = 748, pw = W - 140, ph = 492;
  drawPanelCard(px, py, pw, ph, 28, '#FFFFFF');

  const speakerLabel = String(window.SPEAKER_LABEL || data.speaker_label || '🎙️ NARASI').toUpperCase();
  ctx.textAlign = 'center';
  ctx.fillStyle = '#64748B';
  ctx.font = '800 21px Montserrat, sans-serif';
  ctx.fillText(speakerLabel, W / 2, py + 52);

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
      const boxW = ctx.measureText(wText).width + (isAct ? 30 : 4);
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
          roundRect(drawX, drawY - 52, item.boxW, 70, 14);
          ctx.fillStyle = pal.accent;
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
    ctx.fillStyle = '#0F172A';
    ctx.font = '800 44px Montserrat, sans-serif';
    drawWrappedText(scene.narration || '', W / 2, py + 210, pw - 110, 62);
  }

  const barsCount = 17;
  const barW = 10, barGap = 13;
  const totalEqW = barsCount * barW + (barsCount - 1) * barGap;
  const eqStartX = W / 2 - totalEqW / 2;
  const eqCenterY = py + ph - 50;
  const energy = getSpeechEnergy(t);
  const eqColors = [pal.accent, pal.alt, '#0F172A', '#FACC15'];

  for (let b = 0; b < barsCount; b++) {
    const wave = Math.abs(Math.sin(t * 11 + b * 0.75));
    const bh = 8 + wave * 34 * energy;
    roundRect(eqStartX + b * (barW + barGap), eqCenterY - bh / 2, barW, bh, 5);
    ctx.fillStyle = eqColors[b % eqColors.length];
    ctx.fill();
  }
}

// =========================================================================
// 5. KARAKTER PRESENTER BAWAH (DENGAN PERPINDAHAN POSISI SMOOTH & BUBBLE REAKSI)
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

function drawSpeechCallout(text, side) {
  if (!text) return;
  const dir = side === 'right' ? -1 : 1;
  const bx = dir * 235;
  const by = -145;
  ctx.save();
  ctx.translate(bx, by);
  ctx.font = '900 24px Montserrat, sans-serif';
  const bw = Math.min(Math.max(ctx.measureText(text).width + 44, 170), 340);

  roundRect(-bw / 2 + 5, -34 + 6, bw, 68, 18);
  ctx.fillStyle = '#0F172A';
  ctx.fill();

  roundRect(-bw / 2, -34, bw, 68, 18);
  ctx.fillStyle = '#FACC15';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0F172A';
  ctx.stroke();

  ctx.textAlign = 'center';
  ctx.fillStyle = '#0F172A';
  ctx.fillText(text, 0, 9);
  ctx.restore();
}

function drawPresenterHalfBody(t, p, speaking, blinking, side, gestureOverride, calloutText, shirtColor) {
  const autoGesture = Math.floor(t / 2.2) % 5;
  const gMode = typeof gestureOverride === 'number' ? gestureOverride : autoGesture;

  const bobY = Math.sin(t * (speaking ? 6.8 : 2.6)) * 5;
  const headTilt = speaking ? Math.sin(t * 5) * 0.035 : Math.sin(t * 2) * 0.015;
  const shirt = shirtColor || '#1E40AF';

  ctx.save();
  ctx.translate(0, bobY);
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#0F172A';

  // Badan
  roundRect(-115, 45, 230, 260, 44);
  ctx.fillStyle = shirt;
  ctx.fill(); ctx.stroke();

  // Kerah
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  ctx.beginPath();
  ctx.moveTo(-42, 42); ctx.lineTo(0, 92); ctx.lineTo(-55, 112); ctx.closePath();
  ctx.fill(); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(42, 42); ctx.lineTo(0, 92); ctx.lineTo(55, 112); ctx.closePath();
  ctx.fill(); ctx.stroke();

  ctx.beginPath(); ctx.moveTo(0, 92); ctx.lineTo(0, 290); ctx.stroke();

  // Lanyard & ID Card
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

  // Kepala
  ctx.save();
  ctx.rotate(headTilt);
  roundRect(-24, 6, 48, 46, 12);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  ctx.beginPath(); ctx.arc(-108, -96, 20, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();
  ctx.beginPath(); ctx.arc(108, -96, 20, 0, Math.PI * 2); ctx.fillStyle = '#F7C9A9'; ctx.fill(); ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, -104, 104, 102, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#F7C9A9';
  ctx.fill(); ctx.stroke();

  // Rambut
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

  // Mata
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

  // Kacamata
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  roundRect(-76, -128, 64, 46, 12); ctx.stroke();
  roundRect(12, -128, 64, 46, 12); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-12, -106); ctx.lineTo(12, -106); ctx.stroke();

  // Pipi
  ctx.fillStyle = 'rgba(244, 114, 114, 0.38)';
  ctx.beginPath(); ctx.ellipse(-64, -76, 15, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(64, -76, 15, 9, 0, 0, Math.PI * 2); ctx.fill();

  // Mulut Lip-Sync
  ctx.lineWidth = 5;
  if (gMode === 1) {
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

  // Simbol Emosi Melayang
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

  // Lengan & Gestur
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#0F172A';
  if (gMode === 0) {
    ctx.save(); ctx.translate(-112, 85); ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(112, 80); ctx.rotate(-2.35 + Math.sin(t * 7.5) * 0.24);
    roundRect(-18, 0, 36, 118, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 134, Math.PI, 1.35); ctx.restore();
  } else if (gMode === 1) {
    ctx.save(); ctx.translate(-112, 85); ctx.rotate(0.32);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(105, 85); ctx.rotate(-2.55);
    roundRect(-18, 0, 36, 115, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI - 0.3, 1.25); ctx.restore();
  } else if (gMode === 2) {
    ctx.save(); ctx.translate(-112, 85); ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(110, 80); ctx.rotate(-2.45 + Math.sin(t * 7) * 0.14);
    roundRect(-18, 0, 36, 118, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawPointingHand(0, 136, Math.PI); ctx.restore();
  } else if (gMode === 3) {
    ctx.save(); ctx.translate(-110, 82); ctx.rotate(2.25 + Math.sin(t * 7) * 0.16);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI, 1.3); ctx.restore();
    ctx.save(); ctx.translate(110, 82); ctx.rotate(-2.25 - Math.sin(t * 7) * 0.16);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawHandPalm(0, 128, Math.PI, 1.3); ctx.restore();
  } else {
    ctx.save(); ctx.translate(-112, 85); ctx.rotate(0.28);
    roundRect(-18, 0, 36, 120, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.translate(110, 82); ctx.rotate(-1.85 + Math.sin(t * 6) * 0.14);
    roundRect(-18, 0, 36, 112, 18); ctx.fillStyle = shirt; ctx.fill(); ctx.stroke();
    drawThumbsUpHand(0, 128, Math.PI + 0.35); ctx.restore();
  }

  // Balon Reaksi Singkat di Samping Presenter
  if (calloutText) {
    drawSpeechCallout(calloutText, side);
  }

  ctx.restore();
}

// Progress Bar Atas
function drawTopProgressBar(t, pal) {
  const totalDur = window.SCENES.length ? window.SCENES[window.SCENES.length - 1].end : 1;
  const p = clamp01(t / Math.max(totalDur, 0.1));
  ctx.fillStyle = 'rgba(15, 23, 42, 0.12)';
  ctx.fillRect(0, 0, W, 11);
  ctx.fillStyle = pal.accent;
  ctx.fillRect(0, 0, W * p, 11);
}

function getSideX(side) {
  if (side === 'left') return 260;
  if (side === 'right') return W - 260;
  return W / 2;
}

// =========================================================================
// MAIN DRAW LOOP (DENGAN TRANSISI SLIDE/ZOOM ANTAR ADEGAN & LERP PRESENTER)
// =========================================================================
function draw(t) {
  const active = getActiveScene(t);
  if (!active) return;
  const { index, scene, localT, progress } = active;
  const data = scene.data || {};
  const speaking = isSpeakingAt(t);
  const blinking = (t % 3.5) > 3.34;
  const themeName = scene.theme || ['cream', 'sky', 'mint', 'lavender', 'coral'][index % 5];
  const pal = getThemePalette(themeName);
  const isDark = themeName === 'dark';

  // 1. Latar gradien + partikel hidup
  drawDynamicBackground(themeName, t, index);

  // 2. Header kategori & badge poin
  drawTopHeader(data, index, pal, isDark);

  // 3. Panel Atas dengan Transisi Masuk Dinamis (Slide + Pop-in)
  const enterRaw = clamp01(localT / 0.35);
  const enterEase = easeOutBack(enterRaw);
  const slideOffset = (1 - easeOutCubic(enterRaw)) * (index % 2 === 0 ? -90 : 90);

  ctx.save();
  ctx.globalAlpha = clamp01(localT / 0.22);
  ctx.translate(W / 2 + slideOffset, 430);
  ctx.scale(0.92 + 0.08 * enterEase, 0.92 + 0.08 * enterEase);
  ctx.translate(-W / 2, -430);

  switch (scene.type) {
    case 'big_number':
      renderTopBigNumber(data, progress, t, pal);
      break;
    case 'chat_hook':
      renderTopChatHook(data, progress, t, pal);
      break;
    case 'statement_card':
    case 'character_story':
      renderTopStatementCard(data, progress, t, pal);
      break;
    case 'gauge_meter':
      renderTopGaugeMeter(data, progress, t, pal);
      break;
    case 'line_chart':
    case 'bar_chart':
      renderTopLineChart(data, progress, t, pal);
      break;
    case 'two_cards':
    case 'comparison_vs':
      renderTopTwoCards(data, progress, t, pal);
      break;
    case 'three_cards':
      renderTopThreeCards(data, progress, t, pal);
      break;
    case 'checklist':
    case 'flow_diagram':
      renderTopChecklist(data, progress, t, pal);
      break;
    case 'cta_closing':
      renderTopCtaCard(data, progress, t, pal);
      break;
    default:
      renderTopStatementCard(data, progress, t, pal);
      break;
  }
  ctx.restore();

  // 4. Panel Tengah: Kartu Teleprompter Kata-per-Kata + Audio Equalizer
  renderTeleprompterCard(scene, t, data, pal);

  // 5. Karakter Presenter Meluncur Mulus dari Posisi Adegan Sebelumnya ke Posisi Baru
  const prevScene = index > 0 ? window.SCENES[index - 1] : null;
  const prevSide = prevScene
    ? ((prevScene.data && prevScene.data.side) || ((index - 1) % 2 === 0 ? 'center' : ((index - 1) % 4 === 1 ? 'right' : 'left')))
    : 'center';
  const curSide = data.side || (index % 2 === 0 ? 'center' : (index % 4 === 1 ? 'right' : 'left'));

  const moveT = easeInOutCubic(clamp01(localT / 0.45));
  const curX = getSideX(prevSide) + (getSideX(curSide) - getSideX(prevSide)) * moveT;

  ctx.save();
  ctx.translate(curX, 1625);
  ctx.scale(1.18, 1.18);
  drawPresenterHalfBody(
    t,
    progress,
    speaking,
    blinking,
    curSide,
    data.gesture,
    data.callout || '',
    pal.alt
  );
  ctx.restore();

  // 6. Progress Bar Waktu
  drawTopProgressBar(t, pal);
}
