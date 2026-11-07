// Touch light: the phone counterpart to the cursor glint. Wherever a finger
// touches the screen, the same dithered pixel light lights up under it and
// follows it, and every tap sends out a ring that spreads and fades. Drawn on
// a full-screen grid behind the UI, so the glass panels show it blurred and
// bent while their own glints (js/glint.js) light up on top.

import { createLightGrid, spot } from './glint.js';

const RING_SECONDS = 0.4;
const RING_RADIUS = 72;
const RING_WIDTH = 10;

export function initTouchLight() {
  const canvas = document.createElement('canvas');
  canvas.className = 'touch-light';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const grid = createLightGrid(canvas, document.documentElement);

  const fingers = new Map();
  let rings = [];
  let running = false;
  let last = 0;

  // Brightest of all fingers and rings at the point (x, y).
  function target(x, y) {
    let light = 0;
    for (const finger of fingers.values()) light = Math.max(light, spot(x, y, finger.x, finger.y));
    for (const ring of rings) {
      const d = Math.abs(Math.hypot(x - ring.x, y - ring.y) - ring.radius) / RING_WIDTH;
      if (d < 1) light = Math.max(light, (1 - d) * ring.strength);
    }
    return light;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    rings = rings.filter((ring) => (ring.age += dt) < RING_SECONDS);
    for (const ring of rings) {
      const t = ring.age / RING_SECONDS;
      ring.radius = RING_RADIUS * (1 - (1 - t) ** 2);
      ring.strength = 1 - t;
    }
    grid.resize(window.innerWidth, window.innerHeight);
    const busy = fingers.size > 0 || rings.length > 0;
    if (grid.step(dt, busy ? target : null) || busy) requestAnimationFrame(frame);
    else running = false;
  }

  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  function track(event) {
    for (const t of event.changedTouches) fingers.set(t.identifier, { x: t.clientX, y: t.clientY });
    start();
  }

  window.addEventListener('touchstart', (event) => {
    for (const t of event.changedTouches) {
      rings.push({ x: t.clientX, y: t.clientY, age: 0, radius: 0, strength: 1 });
    }
    track(event);
  }, { passive: true });
  window.addEventListener('touchmove', track, { passive: true });
  const lift = (event) => {
    for (const t of event.changedTouches) fingers.delete(t.identifier);
  };
  window.addEventListener('touchend', lift);
  window.addEventListener('touchcancel', lift);
}
