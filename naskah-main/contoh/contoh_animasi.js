// durasi: 8
// (opsional) narasi: hapus kata "(opsional)" di baris ini agar video diberi suara

function draw(t) {
  // latar gradien yang berubah warna
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, `hsl(${(t * 20 + 220) % 360}, 70%, 28%)`);
  g.addColorStop(1, `hsl(${(t * 20 + 300) % 360}, 70%, 10%)`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // lingkaran yang bergerak
  for (let i = 0; i < 6; i++) {
    const x = W / 2 + Math.sin(t * 1.2 + i) * 350;
    const y = 650 + Math.cos(t * 0.9 + i * 1.7) * 300 + i * 60;
    ctx.beginPath();
    ctx.arc(x, y, 40 + i * 8, 0, Math.PI * 2);
    ctx.fillStyle = `hsla(${(i * 50 + t * 60) % 360}, 90%, 60%, 0.8)`;
    ctx.fill();
  }

  // teks muncul kata demi kata dengan efek pop
  const words = ["Tahukah", "kamu?", "Video", "ini", "dibuat", "dari", "kode", "JavaScript!"];
  const n = Math.min(words.length, Math.floor(t / 0.6) + 1);
  const age = t - (n - 1) * 0.6;
  const pop = 1 + 0.25 * Math.max(0, 1 - age / 0.2);
  ctx.save();
  ctx.translate(W / 2, 1300);
  ctx.scale(pop, pop);
  ctx.font = "bold 84px sans-serif";
  ctx.textAlign = "center";
  ctx.lineWidth = 10;
  ctx.strokeStyle = "#000";
  ctx.fillStyle = "#fff";
  const line = words.slice(0, n).join(" ");
  ctx.strokeText(line.length > 18 ? words[n - 1] : line, 0, 0);
  ctx.fillText(line.length > 18 ? words[n - 1] : line, 0, 0);
  ctx.restore();
}
