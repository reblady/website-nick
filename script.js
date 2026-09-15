(() => {
  "use strict";

  const html = document.documentElement;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const pointerFine = window.matchMedia("(pointer: fine)").matches;
  let applyRefractionState = () => {}; // replaced below if the browser supports it

  /* ---------------- Icons ---------------- */
  document.querySelectorAll("[data-icon]").forEach((el) => {
    const name = el.getAttribute("data-icon");
    el.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
  });

  /* ---------------- Theme ---------------- */
  const THEME_KEY = "reblady-theme";
  const themeToggles = [document.getElementById("themeToggle"), document.getElementById("themeToggleMini")];

  function applyTheme(theme) {
    document.body.setAttribute("data-theme", theme);
    themeToggles.forEach((btn) => btn && btn.setAttribute("aria-pressed", theme === "light"));
  }

  const storedTheme = localStorage.getItem(THEME_KEY);
  applyTheme(storedTheme || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));

  function toggleTheme(event) {
    const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";

    function applyAndPulse() {
      applyTheme(next);
      localStorage.setItem(THEME_KEY, next);
      if (!prefersReducedMotion) {
        document.querySelectorAll(".theme-toggle__dot").forEach((dot) => {
          dot.classList.remove("is-pulsing");
          void dot.offsetWidth; // restart the animation even on rapid clicks
          dot.classList.add("is-pulsing");
        });
        themeToggles.forEach((btn) => {
          if (!btn) return;
          btn.classList.remove("is-glinting");
          void btn.offsetWidth;
          btn.classList.add("is-glinting");
        });
      }
    }

    // Circular reveal from the toggle — supported in Chromium, degrades to
    // a plain instant swap elsewhere (still correct, just less fancy).
    if (typeof document.startViewTransition !== "function" || prefersReducedMotion) {
      applyAndPulse();
      return;
    }
    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;
    const endRadius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
    const transition = document.startViewTransition(applyAndPulse);
    transition.ready.then(() => {
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`] },
        { duration: 650, easing: "cubic-bezier(0.65, 0, 0.35, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  }
  themeToggles.forEach((btn) => btn && btn.addEventListener("click", toggleTheme));

  /* ---------------- Mini header + back-to-top ---------------- */
  const hero = document.getElementById("hero");
  const miniHeader = document.getElementById("miniHeader");
  const backToTop = document.getElementById("backToTop");
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(
      ([entry]) => {
        const pastHero = !entry.isIntersecting;
        if (miniHeader) {
          miniHeader.classList.toggle("is-visible", pastHero);
          miniHeader.setAttribute("aria-hidden", pastHero ? "false" : "true");
        }
        if (backToTop) backToTop.classList.toggle("is-visible", pastHero);
      },
      { rootMargin: "-70% 0px 0px 0px" }
    ).observe(hero);
  }
  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ---------------- Cursor-tracked glass highlight + card tilt ----------------
     Every .glass element gets a spotlight that follows the pointer (drives
     --mx/--my, read by the radial-gradient in styles.css). Link cards
     additionally tilt toward the pointer — together they're what sells
     "glass" now that moving cards carry no backdrop-filter blur. */
  if (pointerFine) {
    document.querySelectorAll(".glass").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${((e.clientX - rect.left) / rect.width) * 100}%`);
        el.style.setProperty("--my", `${((e.clientY - rect.top) / rect.height) * 100}%`);
      });
      el.addEventListener("pointerleave", () => {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      });
    });

    if (!prefersReducedMotion) {
      document.querySelectorAll(".link-card").forEach((card) => {
        card.addEventListener("pointermove", (e) => {
          const rect = card.getBoundingClientRect();
          const dx = (e.clientX - rect.left) / rect.width - 0.5;
          const dy = (e.clientY - rect.top) / rect.height - 0.5;
          card.style.setProperty("--tilt-x", `${(-dy * 10).toFixed(2)}deg`);
          card.style.setProperty("--tilt-y", `${(dx * 10).toFixed(2)}deg`);
        });
        card.addEventListener("pointerleave", () => {
          card.style.setProperty("--tilt-x", "0deg");
          card.style.setProperty("--tilt-y", "0deg");
        });
      });
    }
  }

  /* ---------------- Pinned horizontal link gallery ---------------- */
  const galleryPin = document.getElementById("galleryPin");
  const galleryRow = document.getElementById("galleryRow");
  let galleryTick = null; // set below if the gallery is active

  if (galleryPin && galleryRow && !prefersReducedMotion) {
    let targetX = 0;
    let currentX = 0;
    let rafId = null;

    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function setPinHeight() {
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      galleryPin.style.height = `calc(100svh + ${maxScroll * 1.1}px)`;
    }

    function computeTarget() {
      const total = galleryPin.offsetHeight - window.innerHeight;
      if (total <= 0) { targetX = 0; return; }
      const rect = galleryPin.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      targetX = -easeInOutQuad(progress) * maxScroll;
    }

    function tick() {
      currentX += (targetX - currentX) * 0.16;
      if (Math.abs(targetX - currentX) < 0.05) currentX = targetX;
      galleryRow.style.transform = `translate3d(${currentX}px, 0, 0)`;
      if (currentX !== targetX) {
        rafId = requestAnimationFrame(tick);
      } else {
        rafId = null;
      }
    }

    galleryTick = () => {
      computeTarget();
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    function recalc() {
      setPinHeight();
      galleryTick();
    }

    recalc();
    window.addEventListener("resize", recalc);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(recalc);
    if ("ResizeObserver" in window) new ResizeObserver(recalc).observe(galleryRow);
  }

  /* ---------------- Scroll: gallery drive + blur reduction + low-power ----------------
     One rAF-throttled scroll listener drives everything scroll-position-
     dependent: the pinned gallery's target, and a transient "is-scrolling"
     flag that temporarily drops the real-glass blur radius (see
     styles.css) — backdrop-filter blur is the single most expensive thing
     on this page, especially while something is actively moving. */
  const LOW_POWER_KEY = "reblady-low-power";
  const lowPowerToggles = document.querySelectorAll("[data-low-power-toggle]");

  function setLowPower(on, persist) {
    html.classList.toggle("is-low-power", on);
    if (persist) localStorage.setItem(LOW_POWER_KEY, on ? "1" : "0");
    lowPowerToggles.forEach((btn) => btn.setAttribute("aria-pressed", String(on)));
    applyRefractionState();
  }
  setLowPower(localStorage.getItem(LOW_POWER_KEY) === "1", false);
  lowPowerToggles.forEach((btn) => {
    btn.addEventListener("click", () => setLowPower(!html.classList.contains("is-low-power"), true));
  });

  let scrollTicking = false;
  let scrollSettleTimer = null;
  window.addEventListener(
    "scroll",
    () => {
      if (!scrollTicking) {
        scrollTicking = true;
        requestAnimationFrame(() => {
          html.classList.add("is-scrolling");
          applyRefractionState();
          if (galleryTick) galleryTick();
          scrollTicking = false;
        });
      }
      clearTimeout(scrollSettleTimer);
      scrollSettleTimer = setTimeout(() => {
        html.classList.remove("is-scrolling");
        applyRefractionState();
      }, 160);
    },
    { passive: true }
  );

  // Adaptive low-power detection: sample real frame times after the first
  // scroll; sustained jank (median > ~30fps) flips low-power on for good.
  if (!html.classList.contains("is-low-power") && !prefersReducedMotion) {
    window.addEventListener(
      "scroll",
      () => {
        let samples = [];
        let last = null;
        function sampleFrame(t) {
          if (last !== null) samples.push(t - last);
          last = t;
          if (samples.length < 60) {
            requestAnimationFrame(sampleFrame);
            return;
          }
          const sorted = [...samples].sort((a, b) => a - b);
          if (sorted[Math.floor(sorted.length / 2)] > 32) setLowPower(true, true);
        }
        requestAnimationFrame(sampleFrame);
      },
      { once: true, passive: true }
    );
  }

  /* ---------------- Advanced glass refraction (mini-header, back-to-top) ----------------
     Adapted (MIT) from nikdelvin/liquid-glass: a per-element SVG
     displacement map — edges bump/refract via an X/Y gradient rounded-rect
     bump map — run through three feDisplacementMap passes (one per RGB
     channel, at slightly different strengths) for real chromatic
     aberration, applied via `backdrop-filter: url(#displace)`.

     This filters the *real* backdrop, so it's meaningfully more expensive
     than the plain blur it replaces. It's therefore reserved for the two
     .glass--blur elements only (never the moving link cards) and switched
     off outright whenever it would actually cost something: while
     scrolling — the page behind these fixed elements still changes every
     frame even though the elements themselves don't move, which is the
     exact case the project's performance notes warn about — and in
     Leichter Modus. Both cases fall straight back to the plain CSS blur
     that's already there (see .glass--blur in styles.css). */
  const supportsBackdropFilterUrl = (() => {
    const test = document.createElement("div");
    test.style.cssText = "backdrop-filter: url(#test)";
    return test.style.backdropFilter === "url(#test)" || test.style.backdropFilter === 'url("#test")';
  })();

  if (supportsBackdropFilterUrl && !prefersReducedMotion) {
    const REFRACTION = { depth: 10, strength: 55, chromaticAberration: 6 };

    function getDisplacementFilter({ width, height, radius, depth, strength, chromaticAberration }) {
      const map =
        "data:image/svg+xml;utf8," +
        encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <style>.mix { mix-blend-mode: screen; }</style>
          <defs>
            <linearGradient id="Y" x1="0" x2="0" y1="${Math.ceil((radius / height) * 15)}%" y2="${Math.floor(100 - (radius / height) * 15)}%">
              <stop offset="0%" stop-color="#0F0" /><stop offset="100%" stop-color="#000" />
            </linearGradient>
            <linearGradient id="X" x1="${Math.ceil((radius / width) * 15)}%" x2="${Math.floor(100 - (radius / width) * 15)}%" y1="0" y2="0">
              <stop offset="0%" stop-color="#F00" /><stop offset="100%" stop-color="#000" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" height="${height}" width="${width}" fill="#808080" />
          <g filter="blur(2px)">
            <rect x="0" y="0" height="${height}" width="${width}" fill="#000080" />
            <rect x="0" y="0" height="${height}" width="${width}" fill="url(#Y)" class="mix" />
            <rect x="0" y="0" height="${height}" width="${width}" fill="url(#X)" class="mix" />
            <rect x="${depth}" y="${depth}" height="${height - 2 * depth}" width="${width - 2 * depth}" fill="#808080" rx="${radius}" ry="${radius}" filter="blur(${depth}px)" />
          </g>
        </svg>`);

      return (
        "data:image/svg+xml;utf8," +
        encodeURIComponent(`<svg height="${height}" width="${width}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="displace" color-interpolation-filters="sRGB">
              <feImage x="0" y="0" height="${height}" width="${width}" href="${map}" result="displacementMap" />
              <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration * 2}" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedR" />
              <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength + chromaticAberration}" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="displacedG" />
              <feDisplacementMap in="SourceGraphic" in2="displacementMap" scale="${strength}" xChannelSelector="R" yChannelSelector="G" />
              <feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="displacedB" />
              <feBlend in="displacedR" in2="displacedG" mode="screen" />
              <feBlend in2="displacedB" mode="screen" />
            </filter>
          </defs>
        </svg>`) +
        "#displace"
      );
    }

    const refractionEls = Array.from(document.querySelectorAll(".glass--blur"));
    const refractionCache = new WeakMap();

    function regenerateRefraction() {
      refractionEls.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const width = Math.round(rect.width);
        const height = Math.round(rect.height);
        if (!width || !height) return;
        const radius = parseFloat(getComputedStyle(el).borderRadius) || 0;
        const filterUrl = getDisplacementFilter({ width, height, radius, ...REFRACTION });
        refractionCache.set(el, `blur(4px) url('${filterUrl}') blur(20px) brightness(1.05) saturate(1.45)`);
      });
    }

    applyRefractionState = () => {
      const active = !html.classList.contains("is-scrolling") && !html.classList.contains("is-low-power");
      refractionEls.forEach((el) => {
        if (active && refractionCache.has(el)) {
          el.style.setProperty("backdrop-filter", refractionCache.get(el));
          el.style.setProperty("-webkit-backdrop-filter", refractionCache.get(el));
        } else {
          el.style.removeProperty("backdrop-filter");
          el.style.removeProperty("-webkit-backdrop-filter");
        }
      });
    };

    regenerateRefraction();
    applyRefractionState();
    window.addEventListener("resize", () => {
      regenerateRefraction();
      applyRefractionState();
    });
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => {
        regenerateRefraction();
        applyRefractionState();
      });
    }
  }

  /* ---------------- Aktuelles feed ---------------- */
  const updatesList = document.getElementById("updatesList");
  if (updatesList) {
    fetch("data/updates.json")
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((items) => {
        if (!Array.isArray(items) || items.length === 0) {
          updatesList.innerHTML = `<li class="updates__item updates__item--empty">Noch keine Updates.</li>`;
          return;
        }
        const formatter = new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "short" });
        updatesList.innerHTML = items
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .map((item) => {
            const d = new Date(item.date);
            const label = isNaN(d) ? "" : formatter.format(d);
            return `<li class="updates__item"><time datetime="${item.date}">${label}</time><span>${item.text}</span></li>`;
          })
          .join("");
      })
      .catch(() => {
        updatesList.innerHTML = `<li class="updates__item updates__item--empty">Updates konnten nicht geladen werden.</li>`;
      });
  }

  /* ---------------- Discord live presence (Lanyard) ----------------
     TODO: replace with the real Discord user ID once available.
     Requires membership in the Lanyard Discord server to work. */
  const DISCORD_USER_ID = "REPLACE_WITH_DISCORD_USER_ID";
  const statusBox = document.getElementById("discordStatus");
  const statusDot = document.getElementById("discordStatusDot");
  const statusText = document.getElementById("discordStatusText");
  const STATUS_LABELS = { online: "Online", idle: "Abwesend", dnd: "Nicht stören", offline: "Offline" };

  if (statusBox && DISCORD_USER_ID !== "REPLACE_WITH_DISCORD_USER_ID") {
    fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json) => {
        const data = json && json.data;
        if (!data) return;
        const state = data.discord_status || "offline";
        statusDot.setAttribute("data-state", state);
        const spotify = data.listening_to_spotify && data.spotify;
        statusText.textContent = spotify ? `Hört gerade ${spotify.song} — ${spotify.artist}` : STATUS_LABELS[state] || "Offline";
        statusBox.hidden = false;
      })
      .catch(() => {
        /* nice-to-have, not critical — silently stay hidden on failure */
      });
  }

  /* ---------------- Discord invite placeholder ----------------
     TODO: replace with the real, non-expiring invite link. */
  const DISCORD_INVITE = null; // e.g. "https://discord.gg/xxxxxxx"
  if (DISCORD_INVITE) {
    const el = document.getElementById("discordInviteLink");
    if (el) el.href = DISCORD_INVITE;
  }
})();
