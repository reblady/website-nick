// Light on the glass: a fixed grid of 4px cells, lined up with the scanlines,
// that the cursor tints as it passes. The pixels stay put; cells fade in
// towards the edge of the spot and fade out behind the cursor, in a few hard
// steps like a low colour depth. Mouse only.

const CELL = 4;
const RADIUS = 56;
const LEVELS = 4;
const FADE_IN = 8;
const FADE_OUT = 2.5;

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
          if (r < 1) target = 1 - r;
        }
        const a = alpha[i];
        const next = target > a ? Math.min(target, a + dt * FADE_IN) : Math.max(target, a - dt * FADE_OUT);
        alpha[i] = next;
        if (next < 0.02) continue;
        active = true;
        // 3×3 cell between the 1px scanlines.
        g.globalAlpha = Math.ceil(next * LEVELS) / LEVELS;
        g.fillRect(x * CELL, y * CELL + 1, CELL - 1, CELL - 1);
      }
    }
    g.globalAlpha = 1;

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
