import { THREE, createPS1, ps1Material, speckle } from './ps1.js';
import { loadAvatar } from './avatar.js';
import { createHandheld, SCREEN, BODY_WIDTH } from './handheld.js';
import * as sound from './sound.js';
import { initGlint } from './glint.js';
import { initTouchLight } from './touch.js';
import { initLens } from './lens.js';
import { initPages } from './pages.js';

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

// Crystal drift, in visible-area units: wander speed, push out from behind
// the UI (acceleration) and the fastest that push may get.
const WANDER = 0.02;
const PUSH = 0.35;
const PUSH_MAX = 0.22;

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

  // The photo has the aspect of the handheld's screen.
  const photoCamera = new THREE.PerspectiveCamera(32, SCREEN.width / SCREEN.height, 0.1, 100);
  const photoTarget = new THREE.WebGLRenderTarget(384, Math.round((384 * SCREEN.height) / SCREEN.width), {
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
  // Lights up the crystal under the cursor.
  const crystalHot = ps1Material(snap, { color: palette.sun });
  const crystals = [];
  for (let i = 0; i < 9; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), crystalMats[i % 2]);
    crystal.userData = {
      material: crystal.material,
      spin: 0.3 + Math.random() * 0.8,
      bob: Math.random() * Math.PI * 2,
      angle: 0,
      current: 0,
      gone: false,
      respawnAt: 0,
    };
    placeCrystal(crystal);
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
    crystalHot.color.set(p.sun);
    handheld.setAccent(p.accent);
  }
  setPalette(palette);

  const result = {
    sky, setPalette,
    bootScene, bootCamera, bootCrystal,
    worldScene, worldCamera, avatar: null,
    photoCamera, photoTarget,
    deviceScene, deviceCamera, handheld, handheldLoaded: false, crystals, crystalHot, shards: [],
  };

  // Both models load while the boot screen is up; the sequence waits for
  // them before leaving the boot screen.
  loadAvatar(snap).then((avatar) => {
    result.avatar = avatar;
    worldScene.add(avatar.root);
  }).catch((e) => console.error('Avatar konnte nicht geladen werden', e));
  handheld.ready.then(() => {
    result.handheldLoaded = true;
  }).catch((e) => console.error('Handheld konnte nicht geladen werden', e));

  return result;
}

// Random spot behind the handheld, random size. x/y are stored relative to
// the visible area (−1…1) so the crystals spread over any screen shape.
function placeCrystal(crystal) {
  const d = crystal.userData;
  d.nx = (Math.random() * 2 - 1) * 0.95;
  d.ny = (Math.random() * 2 - 1) * 0.9;
  d.z = -1.5 - Math.random() * 6;
  d.size = 0.12 + Math.random() * 0.28;
  // Slow wander, in visible-area units per second.
  const heading = Math.random() * Math.PI * 2;
  d.vx = Math.cos(heading) * WANDER;
  d.vy = Math.sin(heading) * WANDER;
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

// Camera distance once the zoom is done.
const REST_DISTANCE = 4;

// Where the handheld rests once the zoom is done.
function restingLayout(camera) {
  const distance = REST_DISTANCE;
  const visibleHeight = 2 * distance * halfTan(camera.fov);
  const visibleWidth = visibleHeight * camera.aspect;
  if (camera.aspect > 1.05) {
    return {
      distance,
      position: new THREE.Vector3(visibleWidth * 0.24, 0.05, 0),
      rotation: new THREE.Euler(-0.12, -0.42, 0.05),
      scale: Math.min(1, (visibleWidth * 0.42) / BODY_WIDTH),
    };
  }
  return {
    distance,
    position: new THREE.Vector3(0, visibleHeight * 0.21, 0),
    rotation: new THREE.Euler(-0.08, -0.3, 0.03),
    scale: Math.min(1, (visibleWidth * 0.82) / BODY_WIDTH),
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
let clock = 0;
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

  // Scrolls away with the hero: at z = 0 one viewport of scroll is exactly
  // one visible height, so the handheld moves with the page.
  const visibleHeight = 2 * rest.distance * halfTan(deviceCamera.fov);
  group.position.y += (window.scrollY / window.innerHeight) * visibleHeight;

  // Gentle float and pointer parallax, faded in with the zoom.
  group.position.y += Math.sin(t * 1.1) * 0.035 * progress;
  group.rotation.x += pointer.sy * 0.12 * progress;
  group.rotation.y += pointer.sx * 0.18 * progress;

  // One full turn with a little hop after a click.
  const spin = clamp01((t - handheldSpinAt) / 0.9);
  if (spin < 1) {
    group.rotation.y += ease(spin) * Math.PI * 2;
    group.position.y += Math.sin(spin * Math.PI) * 0.15;
  }

  // Exponential so the zoom out feels even instead of rushing at the start.
  deviceCamera.position.set(0, 0, start * Math.pow(rest.distance / start, progress));
  deviceCamera.lookAt(0, 0, 0);
}

// Screen areas covered by UI (panel, counter, buttons, credits) and the
// handheld, in normalised device coordinates. Refreshed a few times a second.
let blockers = [];
let blockersAt = -Infinity;
const blockerBox = new THREE.Box3();
const corner = new THREE.Vector3();

function updateBlockers(t) {
  if (t - blockersAt < 0.25) return;
  blockersAt = t;
  blockers = [];
  for (const el of document.querySelectorAll('.glass, .controls, .credits')) {
    const r = el.getBoundingClientRect();
    if (!r.width) continue;
    blockers.push({
      left: (r.left / window.innerWidth) * 2 - 1,
      right: (r.right / window.innerWidth) * 2 - 1,
      top: 1 - (r.top / window.innerHeight) * 2,
      bottom: 1 - (r.bottom / window.innerHeight) * 2,
    });
  }
  blockerBox.setFromObject(stage.handheld.group);
  const rect = { left: Infinity, right: -Infinity, top: -Infinity, bottom: Infinity };
  for (let i = 0; i < 8; i++) {
    corner.set(
      i & 1 ? blockerBox.max.x : blockerBox.min.x,
      i & 2 ? blockerBox.max.y : blockerBox.min.y,
      i & 4 ? blockerBox.max.z : blockerBox.min.z
    ).project(stage.deviceCamera);
    rect.left = Math.min(rect.left, corner.x);
    rect.right = Math.max(rect.right, corner.x);
    rect.top = Math.max(rect.top, corner.y);
    rect.bottom = Math.min(rect.bottom, corner.y);
  }
  blockers.push(rect);
}

// Crystals wander slowly. One that ends up behind the UI or the handheld,
// where it can't be clicked, is pushed gently out of the way, so there is
// movement behind the glass without crystals piling up there.
function driftCrystal(d, dt) {
  const aspect = stage.deviceCamera.aspect;
  const blocker = blockers.find((b) => d.nx > b.left && d.nx < b.right && d.ny < b.top && d.ny > b.bottom);
  if (blocker) {
    // Out through the nearest side that has room behind it (measured in
    // screen proportions), so it never gets stuck against the screen edge.
    const exits = [
      { dist: (d.nx - blocker.left) * aspect, room: blocker.left + 0.97, x: -1, y: 0 },
      { dist: (blocker.right - d.nx) * aspect, room: 0.97 - blocker.right, x: 1, y: 0 },
      { dist: blocker.top - d.ny, room: 0.92 - blocker.top, x: 0, y: 1 },
      { dist: d.ny - blocker.bottom, room: blocker.bottom + 0.92, x: 0, y: -1 },
    ].filter((e) => e.room > 0.1);
    const exit = exits.reduce((best, e) => (e.dist < best.dist ? e : best), exits[0] || { x: 1, y: 0 });
    d.vx += exit.x * PUSH * dt;
    d.vy += exit.y * PUSH * dt;
    const speed = Math.hypot(d.vx, d.vy);
    if (speed > PUSH_MAX) {
      d.vx *= PUSH_MAX / speed;
      d.vy *= PUSH_MAX / speed;
    }
  } else {
    // Ease back to wandering speed once it's free.
    const speed = Math.hypot(d.vx, d.vy);
    if (speed > WANDER) {
      const next = Math.max(WANDER, speed - PUSH * dt);
      d.vx *= next / speed;
      d.vy *= next / speed;
    }
  }
  d.nx += d.vx * dt;
  d.ny += d.vy * dt;
  // Bounce off the edges of the screen.
  if (Math.abs(d.nx) > 0.97) {
    d.nx = Math.sign(d.nx) * 0.97;
    d.vx = -Math.sign(d.nx) * Math.abs(d.vx);
  }
  if (Math.abs(d.ny) > 0.92) {
    d.ny = Math.sign(d.ny) * 0.92;
    d.vy = -Math.sign(d.ny) * Math.abs(d.vy);
  }
}

function animateCrystals(t, dt) {
  if (phase === 'hero') updateBlockers(t);
  for (const crystal of stage.crystals) {
    const d = crystal.userData;
    const isHovered = hovered === crystal;
    if (d.gone && t >= d.respawnAt) {
      placeCrystal(crystal);
      d.gone = false;
    }
    if (phase === 'hero' && !isHovered) driftCrystal(d, dt);
    d.angle += dt * d.spin * (isHovered ? 5 : 1);
    crystal.rotation.y = d.angle;
    crystal.rotation.x = d.angle * 0.6;
    const reach = (REST_DISTANCE - d.z) * halfTan(stage.deviceCamera.fov);
    crystal.position.set(
      d.nx * reach * stage.deviceCamera.aspect,
      d.ny * reach + Math.sin(t * 0.8 + d.bob) * 0.15,
      d.z
    );
    // Grows in on load and after a respawn, swells while hovered.
    const target = d.gone ? 0 : d.size * (isHovered ? 1.3 : 1);
    d.current += (target - d.current) * Math.min(1, dt * 10);
    crystal.scale.setScalar(d.current);
    crystal.visible = d.current > 0.005;
    crystal.material = isHovered ? stage.crystalHot : d.material;
  }

  for (let i = stage.shards.length - 1; i >= 0; i--) {
    const shard = stage.shards[i];
    const d = shard.userData;
    d.life += dt;
    d.velocity.y -= 5 * dt;
    shard.position.addScaledVector(d.velocity, dt);
    shard.rotation.x += d.spin.x * dt;
    shard.rotation.y += d.spin.y * dt;
    shard.scale.setScalar(d.size * Math.max(0, 1 - d.life / SHARD_LIFE));
    if (d.life >= SHARD_LIFE) {
      stage.deviceScene.remove(shard);
      stage.shards.splice(i, 1);
    }
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
  clock = t;
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
    if (phase === 'bootOut' && elapsed >= TIMING.bootOut && stage.avatar && stage.handheldLoaded) {
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
  animateCrystals(t, dt);
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
  document.getElementById('content').removeAttribute('aria-hidden');
  initDiscordStatus();
}

// Always start at the top: the intro plays there.
history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

window.addEventListener('scroll', () => {
  root.classList.toggle('is-scrolled', window.scrollY > 40);
}, { passive: true });

// Story sections slide in once they come into view.
const storyObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (entry.isIntersecting) entry.target.classList.add('is-visible');
  }
}, { threshold: 0.35 });
document.querySelectorAll('.story').forEach((section) => storyObserver.observe(section));

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

  if (event.pointerType !== 'mouse') return;
  const target = pick(event);
  if (target !== hovered) {
    hovered = target;
    canvas.style.cursor = target ? 'pointer' : '';
    if (target) sfx.hover();
  }
}, { passive: true });

/* =========================================================
   Background objects — hover a crystal and it lights up and
   spins faster, click it and it shatters (it grows back a
   moment later somewhere else). Clicking the handheld spins it.
========================================================= */

const SHARD_LIFE = 1.1;
const counter = document.querySelector('.counter');
const counterValue = document.getElementById('crystalCount');
const SHARD_GEOMETRY = new THREE.TetrahedronGeometry(1);
const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
let hovered = null;
let handheldSpinAt = -Infinity;

// Shattered crystals, kept across visits like a high score.
let shattered = 0;
try { shattered = Number(localStorage.getItem('crystals')) || 0; } catch (e) {}

function showCount() {
  counterValue.textContent = String(Math.min(shattered, 999)).padStart(3, '0');
  counter.setAttribute('aria-label', `Zerschlagene Kristalle: ${shattered}`);
}
showCount();

// The crystal or the handheld under the pointer, or null. Only on the bare
// canvas, so clicks on the panel and buttons never reach the scene.
function pick(event) {
  if (!stage || phase !== 'hero' || event.target !== canvas) return null;
  ndc.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(ndc, stage.deviceCamera);
  const { ray } = raycaster;

  // Crystals are tiny, so test a generous sphere instead of the faces.
  let best = null;
  let bestDistance = Infinity;
  for (const crystal of stage.crystals) {
    const d = crystal.userData;
    if (d.gone) continue;
    const distance = ray.origin.distanceTo(crystal.position);
    if (ray.distanceToPoint(crystal.position) < d.size * 1.5 && distance < bestDistance) {
      best = crystal;
      bestDistance = distance;
    }
  }
  const hit = raycaster.intersectObject(stage.handheld.group, true)[0];
  return hit && hit.distance < bestDistance ? stage.handheld.group : best;
}

function shatter(crystal) {
  const d = crystal.userData;
  d.gone = true;
  d.current = 0;
  d.respawnAt = clock + 2.5 + Math.random() * 2;
  for (let i = 0; i < 8; i++) {
    const shard = new THREE.Mesh(SHARD_GEOMETRY, i % 3 === 0 ? stage.crystalHot : d.material);
    shard.position.copy(crystal.position);
    shard.userData = {
      velocity: new THREE.Vector3().randomDirection().multiplyScalar(1.2 + Math.random() * 1.8),
      spin: new THREE.Vector3(Math.random() * 12 - 6, Math.random() * 12 - 6, 0),
      size: d.size * (0.22 + Math.random() * 0.2),
      life: 0,
    };
    stage.deviceScene.add(shard);
    stage.shards.push(shard);
  }
  sfx.shatter();

  shattered++;
  try { localStorage.setItem('crystals', String(shattered)); } catch (e) {}
  showCount();
  // Restart the bump animation.
  counter.classList.remove('is-bump');
  void counter.offsetWidth;
  counter.classList.add('is-bump');
}

canvas.addEventListener('pointerdown', (event) => {
  const target = pick(event);
  if (!target) return;
  if (target === stage.handheld.group) {
    if (clock - handheldSpinAt < 0.9) return;
    handheldSpinAt = clock;
    sfx.spin();
  } else {
    shatter(target);
    hovered = null;
    canvas.style.cursor = '';
  }
});

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

initPages();
initGlint();
initTouchLight();

// SVG filters only work as a backdrop-filter in Chromium; elsewhere the glass
// keeps the plain blur from styles.css.
if (/Chrome\//.test(navigator.userAgent)) initLens();
