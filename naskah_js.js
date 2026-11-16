// durasi: 5
// narasi: Pengujian mode JavaScript berhasil dijalankan.
function draw(t) {
  ctx.fillStyle = 'hsl(' + (t * 60) + ',70%,25%)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 90px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('TES /JS: ' + t.toFixed(1) + 's', W / 2, H / 2);
}
