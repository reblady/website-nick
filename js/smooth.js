// Smooth scrolling for mouse wheels and keys. Instead of jumping in steps,
// the page follows a target position like a critically damped spring: it
// speeds up smoothly, then eases out exponentially. Touch keeps the phone's
// own momentum scrolling. Anything else that scrolls the page (the page
// buttons, the browser) is picked up and becomes the new resting point.

const root = document.documentElement;
// Spring stiffness: higher follows the wheel more tightly.
const OMEGA = 9;
const LINE = 40;

export function initSmoothScroll() {
  let target = window.scrollY;
  let position = window.scrollY;
  let velocity = 0;
  let running = false;
  let last = 0;
  let written = position;

  const maxScroll = () => root.scrollHeight - window.innerHeight;
  // Only once the intro has handed over, and not while a page jump morphs.
  const active = () => root.classList.contains('is-revealed') && !root.classList.contains('is-paging');

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Critically damped spring towards the target.
    const acceleration = OMEGA * OMEGA * (target - position) - 2 * OMEGA * velocity;
    velocity += acceleration * dt;
    position += velocity * dt;
    if (Math.abs(target - position) < 0.5 && Math.abs(velocity) < 5) {
      position = target;
      velocity = 0;
    }
    written = Math.round(position);
    window.scrollTo(0, written);
    if (position !== target) requestAnimationFrame(frame);
    else running = false;
  }

  function scrollBy(delta) {
    target = Math.min(maxScroll(), Math.max(0, target + delta));
    if (running) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  window.addEventListener('wheel', (event) => {
    if (!active() || event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? LINE : event.deltaMode === 2 ? window.innerHeight : 1;
    scrollBy(event.deltaY * unit);
  }, { passive: false });

  window.addEventListener('keydown', (event) => {
    if (!active() || event.altKey || event.ctrlKey || event.metaKey) return;
    const page = window.innerHeight * 0.9;
    const steps = {
      ArrowDown: LINE * 2,
      ArrowUp: -LINE * 2,
      PageDown: page,
      PageUp: -page,
      ' ': event.shiftKey ? -page : page,
      Home: -Infinity,
      End: Infinity,
    };
    if (!(event.key in steps)) return;
    event.preventDefault();
    scrollBy(steps[event.key]);
  });

  // Someone else scrolled (touch, page buttons, find in page): follow along.
  window.addEventListener('scroll', () => {
    if (Math.abs(window.scrollY - written) <= 1) return;
    target = position = written = window.scrollY;
    velocity = 0;
  }, { passive: true });
}
