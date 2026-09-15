(() => {
  "use strict";

  const html = document.documentElement;
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  if (storedTheme) {
    applyTheme(storedTheme);
  } else {
    const systemPrefersLight = window.matchMedia("(prefers-color-scheme: light)").matches;
    applyTheme(systemPrefersLight ? "light" : "dark");
  }

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

    // A circular reveal spreading from the toggle — like a drop of color
    // filling the page — is what the View Transitions API is built for.
    // Chromium supports it; Firefox/Zen and older Safari don't, so this
    // degrades to a plain instant swap there, which is still correct.
    const supportsViewTransitions = typeof document.startViewTransition === "function";
    if (!supportsViewTransitions || prefersReducedMotion) {
      applyAndPulse();
      return;
    }

    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(applyAndPulse);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${endRadius}px at ${x}px ${y}px)`],
        },
        {
          duration: 650,
          easing: "cubic-bezier(0.65, 0, 0.35, 1)",
          pseudoElement: "::view-transition-new(root)",
        }
      );
    });
  }
  themeToggles.forEach((btn) => btn && btn.addEventListener("click", toggleTheme));

  /* ---------------- Mini header + back-to-top on scroll ---------------- */
  const hero = document.getElementById("hero");
  const miniHeader = document.getElementById("miniHeader");
  const backToTop = document.getElementById("backToTop");
  if (hero && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        const pastHero = !entry.isIntersecting;
        if (miniHeader) {
          miniHeader.classList.toggle("is-visible", pastHero);
          miniHeader.setAttribute("aria-hidden", pastHero ? "false" : "true");
        }
        if (backToTop) backToTop.classList.toggle("is-visible", pastHero);
      },
      { rootMargin: "-70% 0px 0px 0px" }
    );
    observer.observe(hero);
  }
  if (backToTop) {
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
    });
  }

  /* ---------------- Cursor-tracked glass spotlight ----------------
     Standard "spotlight card" technique: track pointer position as a
     percentage of the element's box and drive a CSS custom property,
     which the radial-gradient in styles.css reads. Falls back to a
     fixed default position on touch devices (no pointermove there). */
  if (window.matchMedia("(pointer: fine)").matches) {
    document.querySelectorAll(".glass-static, .glass-faux").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rect = el.getBoundingClientRect();
        const mx = ((e.clientX - rect.left) / rect.width) * 100;
        const my = ((e.clientY - rect.top) / rect.height) * 100;
        el.style.setProperty("--mx", `${mx}%`);
        el.style.setProperty("--my", `${my}%`);
      });
      el.addEventListener("pointerleave", () => {
        el.style.removeProperty("--mx");
        el.style.removeProperty("--my");
      });
    });
  }

  /* ---------------- Pinned horizontal link gallery ---------------- */
  const galleryPin = document.getElementById("galleryPin");
  const galleryRow = document.getElementById("galleryRow");

  if (galleryPin && galleryRow && !prefersReducedMotion) {
    let targetX = 0;
    let currentX = 0;
    let rafId = null;

    // The scroll distance the pinned section needs is however far the row
    // actually has to travel — not a fixed vh guess. On desktop the row is
    // often much narrower relative to the viewport than on mobile, so a
    // fixed height either finishes the pan in the first few % of scroll
    // (leaving a long dead zone) or drags on forever. Recomputed whenever
    // the row's actual size changes (resize, or webfonts swapping in and
    // reflowing the cards — a common cause of a stale height => a sudden
    // "jump/stick" right as you scroll into the section).
    function setPinHeight() {
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      galleryPin.style.height = `calc(100svh + ${maxScroll * 1.1}px)`;
    }

    // Ease-in-out the 0→1 scroll progress itself, not just the row's
    // position. Without this, the row is already moving at full speed the
    // instant the section becomes pinned, which reads as an abrupt snap.
    // Easing means it ramps up from a standstill and eases out at the end,
    // matching the vertical scroll it's replacing.
    function easeInOutQuad(t) {
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function computeTarget() {
      const rect = galleryPin.getBoundingClientRect();
      const total = galleryPin.offsetHeight - window.innerHeight;
      if (total <= 0) {
        targetX = 0;
        return;
      }
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      targetX = -easeInOutQuad(progress) * maxScroll;
    }

    // Ease the row toward the scroll-derived target instead of snapping to
    // it every frame — gives the pan a bit of smooth, weighted follow-through
    // (similar to what smooth-scroll libraries do) without pulling one in.
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

    function requestTick() {
      computeTarget();
      if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function recalc() {
      setPinHeight();
      requestTick();
    }

    recalc();
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", recalc);

    // Re-measure once webfonts finish swapping in — card widths can shift
    // slightly, which otherwise leaves the pin height stale.
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(recalc);
    }

    // Re-measure if the row's own size changes for any other reason
    // (images loading, dynamic content, etc).
    if ("ResizeObserver" in window) {
      new ResizeObserver(recalc).observe(galleryRow);
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

  const STATUS_LABELS = {
    online: "Online",
    idle: "Abwesend",
    dnd: "Nicht stören",
    offline: "Offline",
  };

  if (statusBox && DISCORD_USER_ID && DISCORD_USER_ID !== "REPLACE_WITH_DISCORD_USER_ID") {
    fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((json) => {
        const data = json && json.data;
        if (!data) return;
        const state = data.discord_status || "offline";
        statusDot.setAttribute("data-state", state);
        const spotify = data.listening_to_spotify && data.spotify;
        statusText.textContent = spotify
          ? `Hört gerade ${spotify.song} — ${spotify.artist}`
          : STATUS_LABELS[state] || "Offline";
        statusBox.hidden = false;
      })
      .catch(() => {
        /* silently hide on failure — this is a nice-to-have, not critical */
      });
  }

  /* ---------------- Discord invite placeholder ----------------
     TODO: replace "#" with the real, non-expiring invite link. */
  const DISCORD_INVITE = null; // e.g. "https://discord.gg/xxxxxxx"
  if (DISCORD_INVITE) {
    ["discordInviteLink"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = DISCORD_INVITE;
    });
  }
})();
