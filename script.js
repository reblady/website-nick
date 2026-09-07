(() => {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================================
     ADAPTIVE LOW-POWER MODE
     Measures real frame timing instead of guessing from the browser name
     (which doesn't work reliably anyway — Zen Browser, for example,
     identifies itself as plain Firefox). Two passes:
       1. A quick idle probe right at load, to catch browsers/devices that
          are already struggling before any interaction happens.
       2. Continuous monitoring while the pinned horizontal gallery is
          engaged, since that's the heaviest moment on the page.
     A confirmed "low power" verdict is remembered in localStorage, so a
     returning visitor on the same device gets the lightweight version
     immediately, without re-suffering through the laggy first attempt.
  ===================================================================== */
  const LOW_POWER_KEY = 'reblady-low-power';

  function enableLowPower() {
    document.documentElement.classList.add('low-power');
    localStorage.setItem(LOW_POWER_KEY, '1');
  }

  if (localStorage.getItem(LOW_POWER_KEY) === '1') {
    document.documentElement.classList.add('low-power');
  } else if (!reduceMotion) {
    // idle probe: sample ~40 frames right after load
    let frames = 0, badFrames = 0, last = performance.now();
    function idleProbe(now) {
      const delta = now - last;
      last = now;
      frames++;
      if (delta > 32) badFrames++; // slower than ~30fps for this frame
      if (frames < 40) {
        requestAnimationFrame(idleProbe);
      } else if (badFrames / frames > 0.35) {
        enableLowPower();
      }
    }
    requestAnimationFrame(idleProbe);

    // live probe: keep sampling specifically while the horizontal gallery is active,
    // since that's the real stress test (scroll + fixed glass elements together)
    let galleryFrames = 0, galleryBadFrames = 0, galleryLast = null;
    window.__reportGalleryFrame = function (now, isActive) {
      if (!isActive) { galleryLast = null; return; }
      if (galleryLast !== null) {
        const delta = now - galleryLast;
        galleryFrames++;
        if (delta > 32) galleryBadFrames++;
        if (galleryFrames > 30 && galleryBadFrames / galleryFrames > 0.35) {
          enableLowPower();
        }
      }
      galleryLast = now;
    };
  }

  // manual escape hatch: if the automatic probe ever misses a genuinely
  // struggling browser, one click fixes it permanently for that device
  const perfToggle = document.getElementById('perfToggle');
  function syncPerfToggleLabel() {
    const isLow = document.documentElement.classList.contains('low-power');
    perfToggle.textContent = isLow ? 'Leichter Modus (aktiv)' : 'Leichter Modus';
    perfToggle.classList.toggle('active', isLow);
  }
  perfToggle.addEventListener('click', () => {
    const isLow = document.documentElement.classList.toggle('low-power');
    localStorage.setItem(LOW_POWER_KEY, isLow ? '1' : '0');
    syncPerfToggleLabel();
  });
  syncPerfToggleLabel();

  // global scroll-state flag: softens (never fully removes) the blur on every
  // .glass element anywhere on the page while motion is happening, then restores
  // it shortly after scrolling stops. Smooth CSS transition avoids any visible pop.
  if (!reduceMotion) {
    let scrollEndTimer = null;
    window.addEventListener('scroll', () => {
      document.documentElement.classList.add('is-scrolling');
      clearTimeout(scrollEndTimer);
      scrollEndTimer = setTimeout(() => {
        document.documentElement.classList.remove('is-scrolling');
      }, 180);
    }, { passive: true });
  }

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
        if (window.__reportGalleryFrame) window.__reportGalleryFrame(performance.now(), active);

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
