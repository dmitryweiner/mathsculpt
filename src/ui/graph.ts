// The profile graph r(z): a solid of revolution's silhouette on a 2D canvas (z up).

export function drawProfileGraph(canvas: HTMLCanvasElement, radiusFn: (t: number) => number, height: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth || 276;
  const h = canvas.clientHeight || 110;
  if (canvas.width !== Math.round(w * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const N = 96;
  let rMax = 0;
  const rs: number[] = [];
  for (let i = 0; i <= N; i++) {
    const r = radiusFn(i / N);
    rs.push(r);
    rMax = Math.max(rMax, r);
  }
  const pad = 6;
  // the scale: fit both the width (2·rMax) and the height
  const scale = Math.min((w - 2 * pad) / (2 * rMax), (h - 2 * pad) / height);
  const cx = w / 2;
  const y0 = h - pad;

  ctx.beginPath();
  for (let i = 0; i <= N; i++) {
    const y = y0 - (i / N) * height * scale;
    const x = cx + rs[i] * scale;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = N; i >= 0; i--) {
    const y = y0 - (i / N) * height * scale;
    ctx.lineTo(cx - rs[i] * scale, y);
  }
  ctx.closePath();
  ctx.fillStyle = 'rgba(88, 166, 255, 0.18)';
  ctx.fill();
  ctx.strokeStyle = '#58a6ff';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // the axis
  ctx.strokeStyle = 'rgba(139, 152, 165, 0.4)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(cx, y0);
  ctx.lineTo(cx, y0 - height * scale);
  ctx.stroke();
  ctx.setLineDash([]);
}
