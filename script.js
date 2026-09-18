'use strict';

/* =========================================================
   Config — placeholders, swap with real values later
========================================================= */

const DISCORD_USER_ID = '000000000000000000';
const LANYARD_POLL_MS = 60000;
const UPDATES_URL = 'data/updates.json';

/* =========================================================
   Intro — click-to-enter gate. intro.js owns the full flow
   (wave animation, then dismiss) when its 3D setup succeeds;
   this is the always-available fallback (works even if
   Three.js fails to load) and the single source of truth for
   actually dismissing the gate.
========================================================= */

let introEnhanced = false;
let introDismissed = false;

window.__setIntroEnhanced = () => {
  introEnhanced = true;
};

function dismissIntro() {
  if (introDismissed) return;
  introDismissed = true;

  const intro = document.getElementById('intro');
  if (intro) intro.classList.add('is-hidden');
  document.body.classList.remove('intro-locked');
  document.documentElement.classList.add('site-ready');
  getAudioContext();
}

function initIntro() {
  const intro = document.getElementById('intro');
  if (!intro) {
    document.documentElement.classList.add('site-ready');
    return;
  }

  intro.addEventListener('click', () => {
    if (introEnhanced) return; // intro.js runs the wave, then calls dismissIntro itself
    dismissIntro();
  });
}

/* =========================================================
   Backdrop parallax — the aura blobs drift on their own via
   CSS keyframes; this just adds a cursor-follow offset on top.
========================================================= */

function initBackdropParallax() {
  if (window.matchMedia('(pointer: coarse)').matches) return;

  let ticking = false;
  let dx = 0;
  let dy = 0;

  function apply() {
    ticking = false;
    document.body.style.setProperty('--mouse-dx', dx.toFixed(3));
    document.body.style.setProperty('--mouse-dy', dy.toFixed(3));
  }

  window.addEventListener('pointermove', (event) => {
    dx = (event.clientX / window.innerWidth - 0.5) * 2;
    dy = (event.clientY / window.innerHeight - 0.5) * 2;
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(apply);
    }
  }, { passive: true });
}

/* =========================================================
   UI sounds — synthesised via Web Audio, no asset files.
   Short, quiet clicks/ticks; a two-note chime for the theme
   switch. The AudioContext is created lazily on first user
   gesture (required by browser autoplay policy).
========================================================= */

let audioCtx = null;

function getAudioContext() {
  try {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === 'suspended') audioCtx.resume();
    return audioCtx;
  } catch (e) {
    return null;
  }
}

function playTone({ freqStart, freqEnd, duration, gain, type = 'sine', delay = 0 }) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  const start = ctx.currentTime + delay;

  osc.type = type;
  osc.frequency.setValueAtTime(freqStart, start);
  osc.frequency.exponentialRampToValueAtTime(freqEnd, start + duration);

  gainNode.gain.setValueAtTime(0, start);
  gainNode.gain.linearRampToValueAtTime(gain, start + 0.007);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  osc.connect(gainNode).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playClick() {
  playTone({ freqStart: 720, freqEnd: 360, duration: 0.08, gain: 0.09 });
}

function playHoverTick() {
  playTone({ freqStart: 1500, freqEnd: 1200, duration: 0.03, gain: 0.018 });
}

function playThemeChime(next) {
  const notes = next === 'dark' ? [680, 460] : [460, 680];
  playTone({ freqStart: notes[0], freqEnd: notes[0] * 0.96, duration: 0.13, gain: 0.1, delay: 0 });
  playTone({ freqStart: notes[1], freqEnd: notes[1] * 0.96, duration: 0.16, gain: 0.1, delay: 0.09 });
}

function playNameReveal() {
  const ctx = getAudioContext();
  if (!ctx) return;

  const now = ctx.currentTime;

  // Must mirror the CSS: html.site-ready .hero__name { animation:
  // name-reveal 1350ms ...; } and its 65% keyframe (the overshoot/settle
  // point) in styles.css. If either changes, update the other.
  const duration = 1.35;
  const landAt = duration * (65 / 100);

  // Whoosh — filtered white noise, the bandpass sweeping up builds energy
  // toward the moment the name lands, then falls away.
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const noise = ctx.createBufferSource();
  noise.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 0.9;
  filter.frequency.setValueAtTime(220, now);
  filter.frequency.exponentialRampToValueAtTime(2200, now + landAt);
  filter.frequency.exponentialRampToValueAtTime(600, now + duration);

  const noiseGain = ctx.createGain();
  noiseGain.gain.setValueAtTime(0, now);
  noiseGain.gain.linearRampToValueAtTime(0.1, now + landAt * 0.85);
  noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  noise.connect(filter).connect(noiseGain).connect(ctx.destination);
  noise.start(now);
  noise.stop(now + duration + 0.05);

  // Synth landing tone — a small descending resolve right as the whoosh
  // peaks, matching the animation's overshoot-then-settle moment.
  playTone({ freqStart: 523.25, freqEnd: 392, duration: 0.5, gain: 0.06, type: 'triangle', delay: landAt });
  playTone({ freqStart: 784, freqEnd: 784 * 1.01, duration: 0.4, gain: 0.03, delay: landAt + 0.03 });
}

/* =========================================================
   Name-reveal sound — synced to the REAL start of the CSS
   `name-reveal` animation via the animationstart event, not a
   guessed timeout, so it can't drift out of sync. Autoplay
   policy blocks sound before any user gesture on a first-ever
   visit, so if the AudioContext isn't already running, queue
   it for the very first click/keydown instead of losing it.
========================================================= */

function initNameRevealSound() {
  const nameEl = document.querySelector('.hero__name');
  if (!nameEl) return;

  const trigger = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'running') {
      playNameReveal();
      return;
    }

    let played = false;
    const playOnce = () => {
      if (played) return;
      played = true;
      document.removeEventListener('pointerdown', playOnce);
      document.removeEventListener('keydown', playOnce);
      // Don't fire in the same instant as whatever was just clicked (its own
      // hover/click sound would stack with this one) — let that settle first.
      setTimeout(playNameReveal, 550);
    };
    document.addEventListener('pointerdown', playOnce, { once: true });
    document.addEventListener('keydown', playOnce, { once: true });
  };

  nameEl.addEventListener('animationstart', (event) => {
    if (event.animationName === 'name-reveal') trigger();
  }, { once: true });
}

function initInteractionSounds() {
  const selector = '.link-card, .update-card, .theme-toggle';
  let hoveredEl = null;

  document.addEventListener('pointerover', (event) => {
    if (event.pointerType && event.pointerType !== 'mouse') return;
    const el = event.target.closest(selector);
    if (!el || el === hoveredEl) return;
    hoveredEl = el;
    playHoverTick();
  }, { passive: true });

  document.addEventListener('pointerout', (event) => {
    if (hoveredEl && (!event.relatedTarget || !hoveredEl.contains(event.relatedTarget))) {
      hoveredEl = null;
    }
  }, { passive: true });

  document.addEventListener('click', (event) => {
    const el = event.target.closest(selector);
    if (!el || el.classList.contains('theme-toggle')) return;
    playClick();
  });
}

/* =========================================================
   Theme toggle — circular reveal via View Transitions API
========================================================= */

function initThemeToggle() {
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  btn.addEventListener('click', (event) => {
    const root = document.documentElement;
    const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    playThemeChime(next);
    const x = event.clientX;
    const y = event.clientY;
    const endRadius = Math.hypot(
      Math.max(x, window.innerWidth - x),
      Math.max(y, window.innerHeight - y)
    );

    const applyTheme = () => {
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) {}
    };

    if (!document.startViewTransition) {
      applyTheme();
      return;
    }

    const transition = document.startViewTransition(applyTheme);
    transition.ready.then(() => {
      document.documentElement.animate(
        {
          clipPath: [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
          ],
        },
        {
          duration: 650,
          easing: 'cubic-bezier(0.65, 0, 0.35, 1)',
          pseudoElement: '::view-transition-new(root)',
        }
      );
    }).catch(() => {});
  });
}

/* =========================================================
   Scroll behaviour: hero condense + pinned horizontal links
========================================================= */

function initScrollEffects() {
  const hero = document.getElementById('hero');
  const heroInner = hero ? hero.querySelector('.hero__inner') : null;
  const miniHeader = document.getElementById('miniHeader');
  const linksPin = document.getElementById('linksPin');
  const linksTrack = document.getElementById('linksTrack');
  const linksViewport = linksPin ? linksPin.querySelector('.links-pin__sticky') : null;

  let ticking = false;

  function update() {
    ticking = false;

    const pageScrollable = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    const scrollProgress = Math.min(1, Math.max(0, window.scrollY / pageScrollable));
    document.body.style.setProperty('--scroll-progress', scrollProgress.toFixed(3));

    if (hero && heroInner) {
      const rect = hero.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -rect.top / (hero.offsetHeight * 0.6)));
      heroInner.style.setProperty('--condense', progress.toFixed(3));
      if (miniHeader) miniHeader.classList.toggle('is-visible', progress > 0.85);
    }

    if (linksPin && linksTrack && linksViewport && window.matchMedia('(min-width: 701px)').matches) {
      const rect = linksPin.getBoundingClientRect();
      const scrollable = linksPin.offsetHeight - window.innerHeight;
      const progress = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0;
      const maxTranslate = Math.max(0, linksTrack.scrollWidth - linksViewport.clientWidth);
      linksTrack.style.transform = `translateX(${-progress * maxTranslate}px)`;
    } else if (linksTrack) {
      linksTrack.style.transform = 'none';
    }
  }

  function onScroll() {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/* =========================================================
   Discord live status via Lanyard
========================================================= */

function renderDiscordStatus(data) {
  const dot = document.querySelector('.discord-chip__dot');
  const text = document.getElementById('discordText');
  if (!dot || !text) return;

  const status = data.discord_status || 'offline';
  dot.setAttribute('data-status', status);

  const labels = { online: 'Online', idle: 'Abwesend', dnd: 'Nicht stören', offline: 'Offline' };
  let label = labels[status] || 'Offline';

  const activity = (data.activities || []).find((a) => a.type === 0);
  if (activity && status !== 'offline') {
    label += ` · ${activity.name}`;
  }

  text.textContent = label;
}

function renderDiscordFallback() {
  const dot = document.querySelector('.discord-chip__dot');
  const text = document.getElementById('discordText');
  if (dot) dot.setAttribute('data-status', 'offline');
  if (text) text.textContent = 'Status nicht verfügbar';
}

async function fetchDiscordStatus() {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
    const json = await res.json();
    if (!json.success) throw new Error('Lanyard: kein Erfolg');
    renderDiscordStatus(json.data);
  } catch (err) {
    renderDiscordFallback();
  }
}

function initDiscordStatus() {
  fetchDiscordStatus();
  setInterval(fetchDiscordStatus, LANYARD_POLL_MS);
}

/* =========================================================
   Updates feed
========================================================= */

function formatUpdateDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('de-DE', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch (e) {
    return iso;
  }
}

function renderUpdates(entries) {
  const list = document.getElementById('updatesList');
  if (!list) return;
  list.innerHTML = '';

  if (!entries.length) {
    const empty = document.createElement('p');
    empty.className = 'updates__status';
    empty.textContent = 'Noch keine Updates.';
    list.appendChild(empty);
    return;
  }

  entries.forEach((entry, index) => {
    const card = document.createElement(entry.link ? 'a' : 'div');
    card.className = 'update-card glass-shine';
    card.style.setProperty('--enter-delay', `${index * 90}ms`);
    if (entry.link) {
      card.href = entry.link;
      card.target = '_blank';
      card.rel = 'noopener';
    }

    const date = document.createElement('span');
    date.className = 'update-card__date';
    date.textContent = formatUpdateDate(entry.date);

    const title = document.createElement('h3');
    title.className = 'update-card__title';
    title.textContent = entry.title;

    const text = document.createElement('p');
    text.className = 'update-card__text';
    text.textContent = entry.text;

    card.append(date, title, text);

    if (entry.link) {
      const linkLabel = document.createElement('span');
      linkLabel.className = 'update-card__link';
      linkLabel.textContent = 'Mehr ansehen';
      card.appendChild(linkLabel);
    }

    list.appendChild(card);
  });
}

async function initUpdates() {
  const status = document.getElementById('updatesStatus');
  try {
    const res = await fetch(UPDATES_URL);
    if (!res.ok) throw new Error('updates.json nicht erreichbar');
    const entries = await res.json();
    renderUpdates(entries);
  } catch (err) {
    if (status) status.textContent = 'Updates konnten nicht geladen werden.';
  }
}

/* =========================================================
   Init
========================================================= */

document.addEventListener('DOMContentLoaded', () => {
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  initIntro();
  initThemeToggle();
  initInteractionSounds();
  initNameRevealSound();
  initBackdropParallax();
  initScrollEffects();
  initDiscordStatus();
  initUpdates();
});
