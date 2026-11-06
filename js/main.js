import { THREE, createPS1, ps1Material, speckle } from './ps1.js';
import { loadAvatar } from './avatar.js';
import { createHandheld, SCREEN } from './handheld.js';
import * as sound from './sound.js';

const { sfx } = sound;

/* =========================================================
   Config — placeholders until the real values exist
========================================================= */

const DISCORD_USER_ID = '000000000000000000';
const LANYARD_POLL_MS = 60000;

// Palette "Obsidian Gold, gealtert" — keep in sync with the tokens in styles.css.
const PALETTES = {
  dark: {
    sky: ['#4a4f57', '#5a4a35', '#1a1712'],
    mountain: '#2a2620',
    ground: '#100e0b',
    fog: '#3a352c',
    accent: '#e0b46a',
    accent2: '#8a6a3a',
    ambient: '#9a9080',
    sun: '#ffe3b3',
  },
  light: {
    sky: ['#f6ead9', '#ecc9a2', '#cf8a63'],
    mountain: '#b6795a',
    ground: '#7e4d36',
    fog: '#e9cdb0',
    accent: '#a8492a',
    accent2: '#e08a62',
    ambient: '#c8b8a4',
    sun: '#fff1dc',
  },
};

// Seconds, relative to the start of each phase.
const TIMING = {
  bootFadeIn: 1.2,
  bootOut: 0.5,
  sceneFadeIn: 0.8,
  waveAt: 1.1,
  viewfinderAt: 2.4,
  focusAt: 2.7,
  shutterAt: 3.6,
  flash: 0.55,
  zoomDelay: 0.3,
  zoom: 2.6,
};

const root = document.documentElement;
const canvas = document.getElementById('stage');
const boot = document.getElementById('boot');
const viewfinder = document.getElementById('viewfinder');

let palette = PALETTES[root.dataset.theme] || PALETTES.dark;

/* =========================================================
   Stage — three scenes rendered through the PS1 pipeline:
   boot (spinning crystal), world (avatar waves) and device
   (the handheld that took the photo).
========================================================= */

let ps1 = null;
try {
  ps1 = createPS1(canvas);
} catch (e) {
  root.classList.add('no-webgl');
}

const stage = ps1 ? buildStage(ps1) : null;

function buildStage(ps1) {
  const { snap } = ps1;

  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1;
  skyCanvas.height = 64;
  const sky = new THREE.CanvasTexture(skyCanvas);
  sky.magFilter = THREE.NearestFilter;
  sky.minFilter = THREE.NearestFilter;
  sky.generateMipmaps = false;

  // --- Boot ---
  const bootScene = new THREE.Scene();
  bootScene.background = new THREE.Color('#0b0a08');
  // The boot screen is always dark, so its crystal keeps the dark theme's gold.
  const bootCrystalMat = ps1Material(snap, { color: PALETTES.dark.accent });
  const bootCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), bootCrystalMat);
  bootCrystal.position.y = 0.55;
  bootScene.add(bootCrystal);
  bootScene.add(new THREE.AmbientLight('#ffffff', 1.2));
  const bootKey = new THREE.DirectionalLight('#fff2da', 2.6);
  bootKey.position.set(2, 3, 4);
  bootScene.add(bootKey);
  const bootCamera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);
  bootCamera.position.set(0, 0, 4);

  // --- World with the avatar ---
  const worldScene = new THREE.Scene();
  worldScene.background = sky;
  worldScene.fog = new THREE.Fog(palette.fog, 6, 26);
  const worldAmbient = new THREE.AmbientLight(palette.ambient, 1.7);
  const worldSun = new THREE.DirectionalLight(palette.sun, 2.4);
  worldSun.position.set(3, 5, 4);
  worldScene.add(worldAmbient, worldSun);

  const groundTexture = speckle('#b4b4b4', 0.3);
  groundTexture.repeat.set(26, 26);
  const groundMat = ps1Material(snap, { map: groundTexture, color: palette.ground });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 80, 10, 10), groundMat);
  ground.rotation.x = -Math.PI / 2;
  worldScene.add(ground);

  const mountainMat = ps1Material(snap, { color: palette.mountain });
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2 + Math.random() * 0.2;
    const radius = 20 + Math.random() * 6;
    const height = 3 + Math.random() * 6;
    const peak = new THREE.Mesh(new THREE.ConeGeometry(3 + Math.random() * 2.5, height, 5), mountainMat);
    peak.position.set(Math.sin(angle) * radius, height / 2 - 0.2, -Math.cos(angle) * radius);
    peak.rotation.y = Math.random() * Math.PI;
    worldScene.add(peak);
  }

  const worldCamera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);

  // The photo is always 16:9 to match the handheld's screen.
  const photoCamera = new THREE.PerspectiveCamera(32, SCREEN.width / SCREEN.height, 0.1, 100);
  const photoTarget = new THREE.WebGLRenderTarget(384, 216, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });

  // --- Device ---
  const deviceScene = new THREE.Scene();
  deviceScene.background = sky;
  deviceScene.fog = new THREE.Fog(palette.fog, 9, 30);
  const deviceAmbient = new THREE.AmbientLight(palette.ambient, 1.6);
  const deviceKey = new THREE.DirectionalLight(palette.sun, 2.6);
  deviceKey.position.set(2.5, 3, 5);
  const deviceRim = new THREE.DirectionalLight(palette.accent, 2.2);
  deviceRim.position.set(-4, 1.5, -2);
  deviceScene.add(deviceAmbient, deviceKey, deviceRim);

  const handheld = createHandheld(snap, photoTarget.texture);
  deviceScene.add(handheld.group);

  const crystalMats = [ps1Material(snap, { color: palette.accent }), ps1Material(snap, { color: palette.accent2 })];
  const crystals = [];
  for (let i = 0; i < 9; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), crystalMats[i % 2]);
    crystal.position.set((Math.random() * 2 - 1) * 5, (Math.random() * 2 - 1) * 2.6, -1.5 - Math.random() * 6);
    crystal.scale.setScalar(0.12 + Math.random() * 0.28);
    crystal.userData.spin = 0.3 + Math.random() * 0.8;
    crystal.userData.bob = Math.random() * Math.PI * 2;
    crystal.userData.baseY = crystal.position.y;
    deviceScene.add(crystal);
    crystals.push(crystal);
  }
  const deviceCamera = new THREE.PerspectiveCamera(35, 1, 0.05, 100);

  function setPalette(p) {
    const g = skyCanvas.getContext('2d');
    const gradient = g.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, p.sky[0]);
    gradient.addColorStop(0.55, p.sky[1]);
    gradient.addColorStop(1, p.sky[2]);
    g.fillStyle = gradient;
    g.fillRect(0, 0, 1, 64);
    sky.needsUpdate = true;

    worldScene.fog.color.set(p.fog);
    deviceScene.fog.color.set(p.fog);
    worldAmbient.color.set(p.ambient);
    deviceAmbient.color.set(p.ambient);
    worldSun.color.set(p.sun);
    deviceKey.color.set(p.sun);
    deviceRim.color.set(p.accent);
    groundMat.color.set(p.ground);
    mountainMat.color.set(p.mountain);
    crystalMats[0].color.set(p.accent);
    crystalMats[1].color.set(p.accent2);
    handheld.setAccent(p.accent);
  }
  setPalette(palette);

  const result = {
    sky, setPalette,
    bootScene, bootCamera, bootCrystal,
    worldScene, worldCamera, avatar: null,
    photoCamera, photoTarget,
    deviceScene, deviceCamera, handheld, crystals,
  };

  // The avatar model loads while the boot screen is up; the sequence waits
  // for it before leaving the boot screen.
  loadAvatar(snap).then((avatar) => {
    result.avatar = avatar;
    worldScene.add(avatar.root);
  }).catch((e) => console.error('Avatar konnte nicht geladen werden', e));

  return result;
}

/* =========================================================
   Camera framing
========================================================= */

const halfTan = (fov) => Math.tan(THREE.MathUtils.degToRad(fov / 2));

// Upper body plus the raised waving hand, whatever the screen shape.
function frameAvatar(camera) {
  const t = halfTan(camera.fov);
  // On narrow phones the waving hand may leave the frame a little — better
  // than shrinking Nick to a tiny figure.
  const d = Math.max(0.95 / t, 0.78 / (t * camera.aspect));
  camera.position.set(0, 1.6 + d * 0.04, d);
  camera.lookAt(0, 1.55, 0);
}

// The photo is a closer portrait so Nick is recognisable on the small screen.
function framePhoto(camera) {
  const d = 0.58 / halfTan(camera.fov);
  camera.position.set(0, 1.78, d);
  camera.lookAt(0, 1.72, 0);
}

// Camera distance at which the handheld's screen covers the whole viewport.
function coverDistance(camera) {
  const t = halfTan(camera.fov);
  const byHeight = SCREEN.height / 2 / t;
  const byWidth = SCREEN.width / 2 / (t * camera.aspect);
  return Math.min(byHeight, byWidth);
}

// Where the handheld rests once the zoom is done.
function restingLayout(camera) {
  const distance = 4;
  const visibleHeight = 2 * distance * halfTan(camera.fov);
  const visibleWidth = visibleHeight * camera.aspect;
  if (camera.aspect > 1.05) {
    return {
      distance,
      position: new THREE.Vector3(visibleWidth * 0.24, 0.05, 0),
      rotation: new THREE.Euler(-0.12, -0.42, 0.05),
      scale: Math.min(1, (visibleWidth * 0.42) / 2),
    };
  }
  return {
    distance,
    position: new THREE.Vector3(0, visibleHeight * 0.21, 0),
    rotation: new THREE.Euler(-0.08, -0.3, 0.03),
    scale: Math.min(1, (visibleWidth * 0.88) / 2),
  };
}

function resize() {
  if (!stage) return;
  ps1.resize();
  const aspect = window.innerWidth / window.innerHeight;
  for (const camera of [stage.bootCamera, stage.worldCamera, stage.deviceCamera]) {
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }
  frameAvatar(stage.worldCamera);
  framePhoto(stage.photoCamera);
}
window.addEventListener('resize', resize);
resize();

/* =========================================================
   Sequence: boot → bootOut → world → zoom → hero
========================================================= */

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const clamp01 = (x) => Math.min(1, Math.max(0, x));

let phase = 'boot';
let phaseStart = performance.now();
let photoTaken = false;
let lastNow = performance.now();
const cues = new Set();
const pointer = { x: 0, y: 0, sx: 0, sy: 0 };

function setPhase(next) {
  phase = next;
  phaseStart = performance.now();
  cues.clear();
}

// Runs fn once per phase when the phase clock passes `at`.
function cue(name, elapsed, at, fn) {
  if (elapsed >= at && !cues.has(name)) {
    cues.add(name);
    fn();
  }
}

function capturePhoto() {
  ps1.renderTo(stage.photoTarget, stage.worldScene, stage.photoCamera);
  photoTaken = true;
}

function placeDevice(progress, t) {
  const { handheld, deviceCamera } = stage;
  const rest = restingLayout(deviceCamera);
  const start = coverDistance(deviceCamera) + SCREEN.z;
  const group = handheld.group;

  group.position.set(0, 0, 0).lerp(rest.position, progress);
  group.rotation.set(rest.rotation.x * progress, rest.rotation.y * progress, rest.rotation.z * progress);
  group.scale.setScalar(THREE.MathUtils.lerp(1, rest.scale, progress));

  // Gentle float and pointer parallax, faded in with the zoom.
  group.position.y += Math.sin(t * 1.1) * 0.035 * progress;
  group.rotation.x += pointer.sy * 0.12 * progress;
  group.rotation.y += pointer.sx * 0.18 * progress;

  // Exponential so the zoom out feels even instead of rushing at the start.
  deviceCamera.position.set(0, 0, start * Math.pow(rest.distance / start, progress));
  deviceCamera.lookAt(0, 0, 0);
}

function animateCrystals(t) {
  for (const crystal of stage.crystals) {
    crystal.rotation.y = t * crystal.userData.spin;
    crystal.rotation.x = t * crystal.userData.spin * 0.6;
    crystal.position.y = crystal.userData.baseY + Math.sin(t * 0.8 + crystal.userData.bob) * 0.15;
  }
}

function frame(now) {
  requestAnimationFrame(frame);
  draw(now);
}

function draw(now) {
  if (!stage) return;

  const t = now / 1000;
  const dt = Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  const elapsed = (now - phaseStart) / 1000;
  pointer.sx += (pointer.x - pointer.sx) * 0.06;
  pointer.sy += (pointer.y - pointer.sy) * 0.06;

  if (phase === 'boot' || phase === 'bootOut') {
    stage.bootCrystal.rotation.y = t * 0.9;
    stage.bootCrystal.rotation.x = Math.sin(t * 0.7) * 0.4;
    ps1.fadeColor.value.set('#000000');
    ps1.fade.value = phase === 'boot'
      ? 1 - clamp01(elapsed / TIMING.bootFadeIn)
      : clamp01(elapsed / TIMING.bootOut);
    ps1.render(stage.bootScene, stage.bootCamera);
    if (phase === 'bootOut' && elapsed >= TIMING.bootOut && stage.avatar) {
      setPhase('world');
      sfx.boot();
    }
    return;
  }

  if (phase === 'world') {
    cue('wave', elapsed, TIMING.waveAt, () => stage.avatar.wave());
    stage.avatar.update(dt);
    ps1.fadeColor.value.set('#000000');
    ps1.fade.value = 1 - clamp01(elapsed / TIMING.sceneFadeIn);

    cue('viewfinder', elapsed, TIMING.viewfinderAt, () => viewfinder.classList.add('is-on'));
    cue('focus', elapsed, TIMING.focusAt, () => {
      viewfinder.classList.add('is-focused');
      sfx.focus();
    });
    cue('shutter', elapsed, TIMING.shutterAt, () => {
      sfx.shutter();
      capturePhoto();
      viewfinder.classList.remove('is-on', 'is-focused');
      setPhase('zoom');
    });

    if (phase === 'world') ps1.render(stage.worldScene, stage.worldCamera);
    return;
  }

  // zoom + hero share the device scene.
  if (phase === 'zoom') {
    cue('whoosh', elapsed, TIMING.zoomDelay, () => sfx.whoosh());
    if (elapsed >= TIMING.zoomDelay + TIMING.zoom) {
      setPhase('hero');
      reveal();
    }
  }
  const progress = phase === 'zoom' ? ease(clamp01((elapsed - TIMING.zoomDelay) / TIMING.zoom)) : 1;
  ps1.fadeColor.value.set('#ffffff');
  ps1.fade.value = phase === 'zoom' ? 1 - clamp01(elapsed / TIMING.flash) : 0;
  placeDevice(progress, t);
  animateCrystals(t);
  ps1.render(stage.deviceScene, stage.deviceCamera);
}
requestAnimationFrame(frame);

function pressStart() {
  if (phase !== 'boot') return;
  sound.unlock();
  sfx.start();
  boot.classList.add('is-gone');
  if (!stage) {
    setPhase('hero');
    reveal();
    return;
  }
  setPhase('bootOut');
}

function reveal() {
  root.classList.add('is-revealed');
  document.getElementById('hero').removeAttribute('aria-hidden');
  initDiscordStatus();
}

boot.addEventListener('click', pressStart);
window.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' || event.key === ' ') {
    if (phase === 'boot') event.preventDefault();
    pressStart();
  }
});

window.addEventListener('pointermove', (event) => {
  pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
  pointer.y = (event.clientY / window.innerHeight) * 2 - 1;

  // Light reflex on the glass follows the cursor.
  for (const el of document.querySelectorAll('.glass')) {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
    el.style.setProperty('--my', `${event.clientY - rect.top}px`);
  }
}, { passive: true });

/* =========================================================
   Theme toggle — circular reveal via View Transitions API
========================================================= */

function applyTheme(next) {
  root.dataset.theme = next;
  try { localStorage.setItem('theme', next); } catch (e) {}
  palette = PALETTES[next];
  if (!stage) return;
  stage.setPalette(palette);
  // Re-shoot the photo in the new colours (the avatar keeps its frozen pose)
  // and draw one frame right away so the transition snapshot is up to date.
  if (photoTaken) capturePhoto();
  draw(performance.now());
}

document.getElementById('themeToggle').addEventListener('click', (event) => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  sfx.theme(next);

  if (!document.startViewTransition) {
    applyTheme(next);
    return;
  }

  const x = event.clientX;
  const y = event.clientY;
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y));
  const transition = document.startViewTransition(() => applyTheme(next));
  transition.ready.then(() => {
    root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
      { duration: 650, easing: 'cubic-bezier(0.65, 0, 0.35, 1)', pseudoElement: '::view-transition-new(root)' }
    );
  }).catch(() => {});
});

/* =========================================================
   Sound toggle + hover/click sounds
========================================================= */

const soundToggle = document.getElementById('soundToggle');

function syncSoundToggle() {
  const muted = sound.isMuted();
  soundToggle.setAttribute('aria-pressed', String(!muted));
  soundToggle.setAttribute('aria-label', muted ? 'Ton einschalten' : 'Ton ausschalten');
}

soundToggle.addEventListener('click', () => {
  sound.unlock();
  sound.setMuted(!sound.isMuted());
  syncSoundToggle();
  sfx.click();
});
syncSoundToggle();

document.addEventListener('pointerover', (event) => {
  if (event.pointerType !== 'mouse') return;
  const target = event.target.closest('.glass-button');
  if (target && !target.contains(event.relatedTarget)) sfx.hover();
});

/* =========================================================
   Discord live status via Lanyard
========================================================= */

const STATUS_LABELS = { online: 'Online', idle: 'Abwesend', dnd: 'Nicht stören', offline: 'Offline' };

function setDiscordStatus(status, label) {
  document.getElementById('discordDot').dataset.status = status;
  document.getElementById('discordText').textContent = label;
}

async function fetchDiscordStatus() {
  try {
    const res = await fetch(`https://api.lanyard.rest/v1/users/${DISCORD_USER_ID}`);
    const json = await res.json();
    if (!json.success) throw new Error('Lanyard');
    const status = json.data.discord_status || 'offline';
    const game = (json.data.activities || []).find((a) => a.type === 0);
    const label = STATUS_LABELS[status] || 'Offline';
    setDiscordStatus(status, game && status !== 'offline' ? `${label} · ${game.name}` : label);
  } catch (e) {
    setDiscordStatus('offline', 'Status nicht verfügbar');
  }
}

let discordStarted = false;
function initDiscordStatus() {
  if (discordStarted) return;
  discordStarted = true;
  if (/^0+$/.test(DISCORD_USER_ID)) {
    setDiscordStatus('offline', 'Discord-Status folgt');
    return;
  }
  fetchDiscordStatus();
  setInterval(fetchDiscordStatus, LANYARD_POLL_MS);
}

// The SVG refraction filter only works as a backdrop-filter in Chromium.
if (/Chrome\//.test(navigator.userAgent)) root.classList.add('has-refraction');
