// Light on the glass: a fixed grid of 4px cells, lined up with the scanlines,
// that the cursor tints as it passes. The pixels stay put; the light fades in
// towards the edge of the spot and fades out behind the cursor. Old consoles
// had no real transparency, so instead of blending, each cell is either fully
// lit or off and the fade is faked with an ordered (Bayer) dither pattern,
// like the mesh transparency of the 32-bit era. Mouse only.

const CELL = 4;
const RADIUS = 56;
const FADE_IN = 8;
const FADE_OUT = 2.5;
// Brightest density in the middle of the spot, so it never turns solid.
const MAX = 0.8;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

function attach(el) {
  const canvas = document.createElement('canvas');
  canvas.className = 'glass__glint';
  canvas.setAttribute('aria-hidden', 'true');
  el.appendChild(canvas);
  const g = canvas.getContext('2d');

  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let alpha = null;
  let cursor = null;
  let running = false;
  let last = 0;

  function resize() {
    if (el.offsetWidth === width && el.offsetHeight === height) return;
    width = el.offsetWidth;
    height = el.offsetHeight;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL);
    rows = Math.ceil(height / CELL);
    alpha = new Float32Array(cols * rows);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    g.clearRect(0, 0, width, height);
    g.fillStyle = getComputedStyle(el).getPropertyValue('--glass-glint');

    let active = cursor !== null;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        let target = 0;
        if (cursor) {
          const r = Math.hypot((x + 0.5) * CELL - cursor.x, (y + 0.5) * CELL - cursor.y) / RADIUS;
          if (r < 1) target = (1 - r) * MAX;
        }
        const a = alpha[i];
        const next = target > a ? Math.min(target, a + dt * FADE_IN) : Math.max(target, a - dt * FADE_OUT);
        alpha[i] = next;
        if (next < 0.01) continue;
        active = true;
        if (next <= BAYER[(y % 4) * 4 + (x % 4)]) continue;
        // 3×3 cell between the 1px scanlines.
        g.fillRect(x * CELL, y * CELL + 1, CELL - 1, CELL - 1);
      }
    }

    if (active) requestAnimationFrame(frame);
    else running = false;
  }

  function move(event) {
    if (event.pointerType !== 'mouse') return;
    resize();
    // Local coordinates, undoing hover scale transforms.
    const rect = el.getBoundingClientRect();
    cursor = {
      x: ((event.clientX - rect.left) * width) / rect.width,
      y: ((event.clientY - rect.top) * height) / rect.height,
    };
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  el.addEventListener('pointerenter', move);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerleave', () => {
    cursor = null;
  });
}

export function initGlint() {
  document.querySelectorAll('.glass').forEach(attach);
}
