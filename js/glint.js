// Light on the glass: a fixed grid of 4px cells, lined up with the scanlines,
// that the cursor (or a finger) tints as it passes. The pixels stay put; the
// light fades in towards the edge of the spot and fades out behind it. Old
// consoles had no real transparency, so instead of blending, each cell is
// either fully lit or off and the fade is faked with an ordered (Bayer)
// dither pattern, like the mesh transparency of the 32-bit era.

const CELL = 4;
export const RADIUS = 56;
const FADE_IN = 8;
const FADE_OUT = 2.5;
// Brightest density in the middle of the spot, so it never turns solid.
const MAX = 0.8;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

// The grid itself, shared by the glass glints and the touch light
// (js/touch.js). `colorFrom` is the element whose --glass-glint colours it.
export function createLightGrid(canvas, colorFrom) {
  const g = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let cols = 0;
  let rows = 0;
  let alpha = null;

  function resize(w, h) {
    if (w === width && h === height) return;
    width = w;
    height = h;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    cols = Math.ceil(width / CELL);
    rows = Math.ceil(height / CELL);
    alpha = new Float32Array(cols * rows);
  }

  // Moves every cell towards target(x, y) (0…1 at the cell centre, or no
  // target: everything fades out) and draws it. Returns whether anything is
  // still lit or lighting up.
  function step(dt, target) {
    g.clearRect(0, 0, width, height);
    g.fillStyle = getComputedStyle(colorFrom).getPropertyValue('--glass-glint');
    let active = false;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const i = y * cols + x;
        const goal = target ? target((x + 0.5) * CELL, (y + 0.5) * CELL) * MAX : 0;
        const a = alpha[i];
        const next = goal > a ? Math.min(goal, a + dt * FADE_IN) : Math.max(goal, a - dt * FADE_OUT);
        alpha[i] = next;
        if (next < 0.01) continue;
        active = true;
        if (next <= BAYER[(y % 4) * 4 + (x % 4)]) continue;
        // 3×3 cell between the 1px scanlines.
        g.fillRect(x * CELL, y * CELL + 1, CELL - 1, CELL - 1);
      }
    }
    return active;
  }

  return { resize, step };
}

// Brightness of a round spot around (sx, sy) at the point (x, y).
export function spot(x, y, sx, sy) {
  const r = Math.hypot(x - sx, y - sy) / RADIUS;
  return r < 1 ? 1 - r : 0;
}

function attach(el) {
  const canvas = document.createElement('canvas');
  canvas.className = 'glass__glint';
  canvas.setAttribute('aria-hidden', 'true');
  el.appendChild(canvas);
  const grid = createLightGrid(canvas, el);

  let cursor = null;
  let running = false;
  let last = 0;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const target = cursor && ((x, y) => spot(x, y, cursor.x, cursor.y));
    if (grid.step(dt, target) || cursor) requestAnimationFrame(frame);
    else running = false;
  }

  function point(clientX, clientY) {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    grid.resize(width, height);
    // Local coordinates, undoing hover scale transforms.
    const rect = el.getBoundingClientRect();
    cursor = {
      x: ((clientX - rect.left) * width) / rect.width,
      y: ((clientY - rect.top) * height) / rect.height,
    };
    if (!running) {
      running = true;
      last = performance.now();
      requestAnimationFrame(frame);
    }
  }

  const release = () => {
    cursor = null;
  };

  el.addEventListener('pointerenter', (event) => {
    if (event.pointerType === 'mouse') point(event.clientX, event.clientY);
  });
  el.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'mouse') point(event.clientX, event.clientY);
  });
  el.addEventListener('pointerleave', (event) => {
    if (event.pointerType === 'mouse') release();
  });

  // Touch: lit while a finger rests or slides on it, even when the page
  // starts scrolling (touch events keep coming then, pointer events don't).
  const touch = (event) => point(event.touches[0].clientX, event.touches[0].clientY);
  el.addEventListener('touchstart', touch, { passive: true });
  el.addEventListener('touchmove', touch, { passive: true });
  el.addEventListener('touchend', release);
  el.addEventListener('touchcancel', release);
}

export function initGlint() {
  document.querySelectorAll('.glass').forEach(attach);
}
