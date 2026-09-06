// ====================================================
// reblady.de — site behavior
// ====================================================

/* ---------- 1. Content strings (DE now, EN-ready later) ----------
   Add an `en` object with the same keys and wire up a language
   switch later; applyStrings() already supports any locale key. */
const STRINGS = {
  de: {
    "hero.name": "Nick Tissen",
    "hero.motto": "Content, Code und was gerade entsteht.",
    "hero.handle": "@reblady",
    "status.loading": "Status wird geladen …",
    "status.online": "Gerade online",
    "status.idle": "Abwesend",
    "status.dnd": "Nicht stören",
    "status.offline": "Gerade offline",
    "status.unavailable": "Status nicht verfügbar",
    "featured.label": "Aktuell",
    "featured.title": "Aktuelles Projekt",
    "featured.desc": "Woran ich gerade arbeite — folgt in Kürze.",
    "featured.cta": "Mehr dazu",
    "updates.label": "Aktuelles",
    "updates.empty": "Noch keine Updates.",
    "links.youtube": "YouTube"
  }
};

function applyStrings(lang) {
  const dict = STRINGS[lang] || STRINGS.de;
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (dict[key]) el.textContent = dict[key];
  });
}

/* ---------- 2. Theme handling ---------- */
const THEME_KEY = "reblady-theme";

function getPreferredTheme() {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function setTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  setTheme(getPreferredTheme());
  const toggle = document.getElementById("themeToggle");
  toggle.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    setTheme(current === "dark" ? "light" : "dark");
  });
}

/* ---------- 3. Discord status via Lanyard (no OAuth needed) ---------- */
// Fill in your Discord user ID below. Lanyard only works if you've joined
// the Lanyard support Discord server at least once: https://discord.gg/lanyard
const DISCORD_USER_ID = "YOUR_DISCORD_ID_HERE";

async function loadDiscordStatus() {
  const dot = document.getElementById("statusDot");
  const text = document.getElementById("statusText");
  const dict = STRINGS.de;

  if (!DISCORD_USER_ID || DISCORD_USER_ID === "YOUR_DISCORD_ID_HERE") {
    text.textContent = dict["status.unavailable"];
    return;
  }

  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
    if (!res.ok) throw new Error("Lanyard request failed");
    const json = await res.json();
    const status = json?.data?.discord_status || "offline";
    const key = `status.${status}`;
    dot.setAttribute("data-state", status);
    text.textContent = dict[key] || dict["status.offline"];
  } catch (err) {
    dot.setAttribute("data-state", "offline");
    text.textContent = dict["status.unavailable"];
  }
}

/* ---------- 4. Scroll-storytelling: mini header condenses in ---------- */
function initScrollHeader() {
  const hero = document.getElementById("hero");
  const miniHeader = document.getElementById("miniHeader");

  const observer = new IntersectionObserver(
    ([entry]) => {
      miniHeader.classList.toggle("is-visible", !entry.isIntersecting);
    },
    { threshold: 0, rootMargin: "-70% 0px 0px 0px" }
  );

  observer.observe(hero);
}

/* ---------- 5. Reveal sections on scroll ---------- */
function initRevealSections() {
  const items = document.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.15 }
  );
  items.forEach((el) => observer.observe(el));
}

/* ---------- 6. Aktuelles feed ---------- */
// For now this reads a local JSON file. Later, the Aktuelles admin UI will
// write to this same shape via the GitHub API / Cloudflare Worker.
async function loadUpdates() {
  const list = document.getElementById("updatesList");
  try {
    const res = await fetch("data/updates.json");
    if (!res.ok) throw new Error("updates.json not found");
    const updates = await res.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      list.innerHTML = `<li class="updates-list__empty">${STRINGS.de["updates.empty"]}</li>`;
      return;
    }

    list.innerHTML = updates
      .map(
        (u) => `
        <li class="update-item glass">
          <span class="update-item__date">${escapeHtml(u.date || "")}</span>
          <p class="update-item__text">${escapeHtml(u.text || "")}</p>
        </li>`
      )
      .join("");
  } catch (err) {
    list.innerHTML = `<li class="updates-list__empty">${STRINGS.de["updates.empty"]}</li>`;
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Init ---------- */
document.addEventListener("DOMContentLoaded", () => {
  applyStrings("de");
  initTheme();
  loadDiscordStatus();
  initScrollHeader();
  initRevealSections();
  loadUpdates();
});
