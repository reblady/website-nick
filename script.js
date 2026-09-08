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
  }
  themeToggles.forEach((btn) => btn && btn.addEventListener("click", toggleTheme));

  /* ---------------- Mini header on scroll ---------------- */
  const hero = document.getElementById("hero");
  const miniHeader = document.getElementById("miniHeader");
  if (hero && miniHeader && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      ([entry]) => {
        miniHeader.classList.toggle("is-visible", !entry.isIntersecting);
        miniHeader.setAttribute("aria-hidden", entry.isIntersecting ? "true" : "false");
      },
      { rootMargin: "-70% 0px 0px 0px" }
    );
    observer.observe(hero);
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

  /* ---------------- Pinned horizontal link gallery ---------------- */
  const galleryPin = document.getElementById("galleryPin");
  const galleryRow = document.getElementById("galleryRow");

  if (galleryPin && galleryRow && !prefersReducedMotion) {
    let ticking = false;

    function updateGallery() {
      ticking = false;
      const rect = galleryPin.getBoundingClientRect();
      const total = galleryPin.offsetHeight - window.innerHeight;
      if (total <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / total));
      const maxScroll = Math.max(0, galleryRow.scrollWidth - window.innerWidth);
      galleryRow.style.transform = `translate3d(${-progress * maxScroll}px, 0, 0)`;
    }

    function requestUpdate() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(updateGallery);
      }
    }

    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    requestUpdate();
  }

  /* ---------------- Aktuelles feed ---------------- */
  const updatesList = document.getElementById("updatesList");
  if (updatesList) {
    fetch("/data/updates.json")
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
    ["discordInviteLink", "discordInviteDock"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.href = DISCORD_INVITE;
    });
  }
})();
