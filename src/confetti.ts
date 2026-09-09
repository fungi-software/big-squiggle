const HUES = ['#2F4BD8', '#17754C', '#E0A32B', '#D9536F', '#5CD39A', '#8098FF'];
const LIFETIME_MS = 2800;

interface Bit {
  x: number; y: number; vx: number; vy: number;
  w: number; h: number; r: number; vr: number; c: string;
}

export function fanfare(canvas: HTMLCanvasElement): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const W = (canvas.width = innerWidth);
  const H = (canvas.height = innerHeight);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.hidden = false;

  const bits: Bit[] = [];
  for (let side = 0; side < 2; side++) {
    // two cannons read as a celebration; one burst reads as debris
    const dir = side ? -1 : 1;
    for (let i = 0; i < 95; i++) {
      bits.push({
        x: side ? W + 18 : -18,
        y: H * (0.82 + Math.random() * 0.12),
        vx: dir * (11 + Math.random() * 16),
        vy: -(13 + Math.random() * 15),
        w: 5 + Math.random() * 7,
        h: 7 + Math.random() * 9,
        r: Math.random() * 6.28,
        vr: (Math.random() - 0.5) * 0.36,
        c: HUES[(Math.random() * HUES.length) | 0]!,
      });
    }
  }

  const t0 = performance.now();
  requestAnimationFrame(function frame(now) {
    const age = now - t0;
    ctx.clearRect(0, 0, W, H);
    for (const b of bits) {
      b.vy += 0.42;
      b.vx *= 0.988;
      b.x += b.vx;
      b.y += b.vy;
      b.r += b.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - age / LIFETIME_MS);
      ctx.translate(b.x, b.y);
      ctx.rotate(b.r);
      ctx.fillStyle = b.c;
      ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      ctx.restore();
    }
    if (age < LIFETIME_MS) {
      requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, W, H);
      canvas.hidden = true;
    }
  });
}
