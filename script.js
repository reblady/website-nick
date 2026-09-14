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

  function toggleTheme() {
    const next = document.body.getAttribute("data-theme") === "dark" ? "light" : "dark";
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

  /* ---------------- Lite mode (backdrop-filter kill switch) ---------------- */
  const LITE_KEY = "reblady-lite-mode";
  const liteToggle = document.getElementById("liteModeToggle");

  function setLiteMode(on, persist = true) {
    html.classList.toggle("lite-mode", on);
    if (persist) localStorage.setItem(LITE_KEY, on ? "1" : "0");
  }
  if (localStorage.getItem(LITE_KEY) === "1") setLiteMode(true, false);
  if (liteToggle) {
    liteToggle.addEventListener("click", () => {
      setLiteMode(!html.classList.contains("lite-mode"));
    });
  }

  /* ---------------- Adaptive low-power detection ----------------
     Measures real frame times on load. If the device is visibly
     struggling, permanently switch to lite mode (blur-free glass). */
  const AUTO_LITE_KEY = "reblady-auto-lite-checked";
  if (localStorage.getItem(AUTO_LITE_KEY) !== "1" && localStorage.getItem(LITE_KEY) !== "1") {
    let frames = 0;
    let badFrames = 0;
    let last = performance.now();
    const sampleWindow = 90; // ~1.5s at 60fps

    function sample(now) {
      const delta = now - last;
      last = now;
      frames++;
      if (delta > 26.5) badFrames++; // worse than ~38fps counts as a bad frame
      if (frames < sampleWindow) {
        requestAnimationFrame(sample);
      } else {
        localStorage.setItem(AUTO_LITE_KEY, "1");
        if (badFrames / frames > 0.35) setLiteMode(true);
      }
    }
    requestAnimationFrame(sample);
  }

  /* ---------------- is-scrolling: shrink blur while scrolling ---------------- */
  let scrollTimer = null;
  function onScrollActivity() {
    html.classList.add("is-scrolling");
    clearTimeout(scrollTimer);
    scrollTimer = setTimeout(() => html.classList.remove("is-scrolling"), 220);
  }
  window.addEventListener("scroll", onScrollActivity, { passive: true });

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
    // (leaving a long dead zone) or drags on forever. Recomputed on resize.
    function setPinHeight() {
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      galleryPin.style.height = `calc(100svh + ${maxScroll * 1.1}px)`;
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
      targetX = -progress * maxScroll;
    }

    // Ease the row toward the scroll-derived target instead of snapping to
    // it every frame — gives the pan a bit of smooth, weighted follow-through
    // (similar to what smooth-scroll libraries do) without pulling one in.
    function tick() {
      currentX += (targetX - currentX) * 0.14;
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

    setPinHeight();
    requestTick();
    window.addEventListener("scroll", requestTick, { passive: true });
    window.addEventListener("resize", () => {
      setPinHeight();
      requestTick();
    });
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
