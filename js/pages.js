// Page buttons: one small socket per section ([data-page], its value names
// the section for screen readers). The lit fill never leaves the sockets: as
// you scroll it drains from one and grows in the next. Clicking a socket
// morphs over to that section with a View Transition that travels in the
// direction you'd scroll.

import { sfx } from './sound.js';

const root = document.documentElement;

export function initPages() {
  const nav = document.querySelector('.pages');
  const sections = [...document.querySelectorAll('[data-page]')];

  const buttons = sections.map((section, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pages__button';
    button.setAttribute('aria-label', `Zu Abschnitt ${i + 1}: ${section.dataset.page}`);
    button.addEventListener('mouseenter', () => sfx.hover());
    button.addEventListener('click', () => jump(section));
    nav.append(button);
    return button;
  });

  // Scroll position as a fractional section index: 1.5 = halfway from the
  // second section to the third.
  function progress() {
    const y = window.scrollY;
    for (let i = sections.length - 1; i >= 0; i--) {
      const top = sections[i].offsetTop;
      if (y < top && i > 0) continue;
      if (i === sections.length - 1) return i;
      const next = sections[i + 1].offsetTop;
      return i + Math.min(1, Math.max(0, (y - top) / (next - top)));
    }
    return 0;
  }

  function update() {
    const p = progress();
    const current = Math.round(p);
    buttons.forEach((button, i) => {
      button.style.setProperty('--fill', Math.max(0, 1 - Math.abs(p - i)).toFixed(3));
      button.setAttribute('aria-current', String(i === current));
    });
  }

  function jump(section) {
    const top = section.offsetTop;
    if (Math.abs(top - window.scrollY) < 2) return;
    sfx.page();
    if (!document.startViewTransition) {
      window.scrollTo({ top, behavior: 'smooth' });
      return;
    }
    root.style.setProperty('--page-dir', top > window.scrollY ? '1' : '-1');
    root.classList.add('is-paging');
    const transition = document.startViewTransition(() => {
      window.scrollTo({ top, behavior: 'instant' });
      update();
    });
    transition.finished.finally(() => root.classList.remove('is-paging'));
  }

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}
