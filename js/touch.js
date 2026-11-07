// Touch light: the phone counterpart to the cursor glint. Wherever a finger
// touches the screen, the same dithered pixel light lights up under it and
// follows it; when the finger lifts, it dissolves. A quick tap is just a
// short flash. Drawn on a full-screen grid behind the UI, so the glass panels
// show it blurred and bent while their own glints (js/glint.js) light up on
// top.

import { createLightGrid, spot } from './glint.js';

// Even the quickest tap stays lit this long, so it always shows a flash.
const MIN_TOUCH_MS = 120;

export function initTouchLight() {
  const canvas = document.createElement('canvas');
  canvas.className = 'touch-light';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  const grid = createLightGrid(canvas, document.documentElement);

  const fingers = new Map();
  let running = false;
  let last = 0;

  // Brightest of all fingers at the point (x, y).
  function target(x, y) {
    let light = 0;
    for (const finger of fingers.values()) light = Math.max(light, spot(x, y, finger.x, finger.y));
    return light;
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    for (const [id, finger] of fingers) {
      if (finger.lifted && now - finger.start >= MIN_TOUCH_MS) fingers.delete(id);
    }
    grid.resize(window.innerWidth, window.innerHeight);
    const touching = fingers.size > 0;
    if (grid.step(dt, touching ? target : null) || touching) requestAnimationFrame(frame);
    else running = false;
  }

  function track(event) {
    for (const t of event.changedTouches) {
      const finger = fingers.get(t.identifier);
      if (finger && !finger.lifted) Object.assign(finger, { x: t.clientX, y: t.clientY });
      else fingers.set(t.identifier, { x: t.clientX, y: t.clientY, start: performance.now(), lifted: false });
    }
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener('touchstart', track, { passive: true });
  window.addEventListener('touchmove', track, { passive: true });
  const lift = (event) => {
    for (const t of event.changedTouches) {
      const finger = fingers.get(t.identifier);
      if (finger) finger.lifted = true;
    }
  };
  window.addEventListener('touchend', lift);
  window.addEventListener('touchcancel', lift);
}
