(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================================
     THEME TOGGLE — persists via localStorage, falls back to system preference
  ===================================================================== */
  const root = document.body;
  const themeToggle = document.getElementById('themeToggle');
  const THEME_KEY = 'reblady-theme';

  function applyTheme(theme) {
    root.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  const savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  } else {
    const prefersLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    applyTheme(prefersLight ? 'light' : 'dark');
  }

  themeToggle.addEventListener('click', () => {
    const current = root.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  /* =====================================================================
     CONDENSED HEADER — fades in once the hero has scrolled mostly out of view
     Single cheap IntersectionObserver, no scroll listener needed for this part.
  ===================================================================== */
  const hero = document.getElementById('hero');
  const condensedHeader = document.getElementById('condensedHeader');
  const bigName = document.getElementById('bigName');

  new IntersectionObserver(([entry]) => {
    const pastHero = !entry.isIntersecting;
    condensedHeader.classList.toggle('visible', pastHero);
    bigName.style.opacity = pastHero ? '0.35' : '1';
  }, { threshold: 0.15 }).observe(hero);

  /* =====================================================================
     PINNED HORIZONTAL LINK GALLERY
     Vertical scroll inside the tall wrapper is converted into horizontal
     motion of the card row while it's pinned. Skipped entirely under
     prefers-reduced-motion — the CSS fallback turns it into a plain,
     natively scrollable row instead, so no JS positioning is needed there.
  ===================================================================== */
  const hOuter = document.getElementById('hOuter');
  const hRow = document.getElementById('hRow');
  const dockWrap = document.getElementById('dockWrap');

  if (!reduceMotion) {
    let hDistance = 0;

    function measure() {
      const rowWidth = hRow.scrollWidth;
      hDistance = Math.max(0, rowWidth - window.innerWidth + 64);
      hOuter.style.height = (window.innerHeight + hDistance) + 'px';
    }
    measure();
    window.addEventListener('resize', measure);

    let ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const rect = hOuter.getBoundingClientRect();
        const start = -rect.top;
        const progress = Math.min(Math.max(start / (hDistance || 1), 0), 1);
        hRow.style.transform = `translate3d(${-progress * hDistance}px,0,0)`;

        const active = rect.top <= 0 && rect.bottom > window.innerHeight;
        dockWrap.classList.toggle('hidden', active);

        ticking = false;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* =====================================================================
     LANYARD — live Discord presence for the status dot
     Replace DISCORD_USER_ID below with your actual Discord user ID
     (Discord Settings → Advanced → Developer Mode, then right-click your
     name → "Copy User ID"). You must also be a member of the Lanyard
     Discord server for this to work: https://discord.gg/lanyard
  ===================================================================== */
  const DISCORD_USER_ID = 'DISCORD_USER_ID'; // <-- replace this
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');

  async function updateDiscordStatus() {
    if (DISCORD_USER_ID === 'DISCORD_USER_ID') return; // not configured yet
    try {
      const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
      const json = await res.json();
      if (!json.success) return;

      const status = json.data.discord_status; // "online" | "idle" | "dnd" | "offline"
      statusDot.className = 'dot ' + (status === 'offline' ? '' : status);

      const labels = { online: 'Online', idle: 'Abwesend', dnd: 'Nicht stören', offline: 'Offline' };
      statusText.textContent = labels[status] || 'Discord';
    } catch (err) {
      // fails silently — the dot just stays in its default (offline) state
      console.warn('Lanyard status could not be loaded:', err);
    }
  }

  updateDiscordStatus();
  setInterval(updateDiscordStatus, 60000); // refresh every minute, no need for anything faster
})();
