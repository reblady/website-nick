import * as THREE from 'https://esm.sh/three@0.160.1';

const introEl = document.getElementById('intro');
const canvas = document.getElementById('introCanvas');

if (introEl && canvas && !introEl.classList.contains('is-hidden')) {
  try {
    initThreeIntro();
  } catch (e) {
    // No WebGL, or something else went wrong — the plain click-to-enter
    // button (wired in script.js) still works, nothing is lost.
  }
}

function readCssColor(varName, fallback) {
  try {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value ? new THREE.Color(value).getHex() : fallback;
  } catch (e) {
    return fallback;
  }
}

function buildCharacter(accentHex) {
  const root = new THREE.Group();

  const jacketMat = new THREE.MeshStandardMaterial({ color: accentHex, flatShading: true, roughness: 0.8 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, flatShading: true, roughness: 0.9 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xe3b48c, flatShading: true, roughness: 0.7 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x241d16, flatShading: true, roughness: 0.6 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.72, 0.36), jacketMat);
  torso.position.y = 1.0;
  root.add(torso);

  const hip = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.32), pantsMat);
  hip.position.y = 0.58;
  root.add(hip);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 8, 6), skinMat);
  head.position.y = 1.56;
  root.add(head);

  const hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.3, 8, 6, 0, Math.PI * 2, 0, Math.PI * 0.55),
    hairMat
  );
  hair.position.y = 1.6;
  root.add(hair);

  // Eyes on the +Z side of the head — the unambiguous "front" of the
  // character, and the side that faces the camera (camera sits at +Z).
  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1c1712, flatShading: true, roughness: 0.4 });
  const eyeGeo = new THREE.SphereGeometry(0.035, 6, 5);
  const eyeLeft = new THREE.Mesh(eyeGeo, eyeMat);
  eyeLeft.position.set(-0.1, 1.58, 0.24);
  root.add(eyeLeft);
  const eyeRight = new THREE.Mesh(eyeGeo, eyeMat);
  eyeRight.position.set(0.1, 1.58, 0.24);
  root.add(eyeRight);

  function buildLeg(x) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.75, 6), pantsMat);
    leg.position.set(x, 0.1, 0);
    root.add(leg);
  }
  buildLeg(-0.16);
  buildLeg(0.16);

  function buildArm(x) {
    const pivot = new THREE.Group();
    pivot.position.set(x, 1.28, 0);
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.42, 6), jacketMat);
    upper.position.y = -0.21;
    pivot.add(upper);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), skinMat);
    hand.position.y = -0.46;
    pivot.add(hand);
    root.add(pivot);
    return pivot;
  }

  const leftArm = buildArm(-0.42);
  const rightArm = buildArm(0.42);
  leftArm.rotation.z = -0.08;
  rightArm.rotation.z = 0.08;

  return { root, head, rightArm };
}

function initThreeIntro() {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.35, 4.2);
  camera.lookAt(0, 1.1, 0);

  const accent = readCssColor('--accent-1', 0xd9ab63);

  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  const key = new THREE.DirectionalLight(0xfff2da, 1.1);
  key.position.set(2.5, 4, 3);
  scene.add(key);
  const rim = new THREE.DirectionalLight(accent, 0.4);
  rim.position.set(-3, 1.5, -2);
  scene.add(rim);

  const character = buildCharacter(accent);
  scene.add(character.root);

  canvas.classList.add('is-ready');

  const WAVE_DURATION = 1300;
  let waving = false;
  let waveStart = 0;
  let dismissed = false;
  let rafId = 0;

  function onResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', onResize);

  function finishIntro() {
    if (dismissed) return;
    dismissed = true;
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    if (typeof window.dismissIntro === 'function') window.dismissIntro();
    setTimeout(() => {
      renderer.dispose();
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose();
        if (obj.material) obj.material.dispose();
      });
    }, 700);
  }

  function tick(now) {
    if (dismissed) return;
    rafId = requestAnimationFrame(tick);

    const t = now * 0.001;
    character.root.position.y = Math.sin(t * 1.6) * 0.05;
    character.root.rotation.y = Math.sin(t * 0.5) * 0.18;
    character.head.rotation.y = Math.sin(t * 0.8) * 0.12;

    if (waving) {
      const wt = Math.min(1, (now - waveStart) / WAVE_DURATION);
      const raise = Math.min(1, wt / 0.22);
      const osc = Math.sin(wt * Math.PI * 7) * (1 - wt) * 0.4;
      character.rightArm.rotation.z = 2.1 * raise + osc;
      if (wt >= 1) {
        waving = false;
        finishIntro();
      }
    }

    renderer.render(scene, camera);
  }
  rafId = requestAnimationFrame(tick);

  function startWave() {
    if (waving || dismissed) return;
    waving = true;
    waveStart = performance.now();
  }

  if (typeof window.__setIntroEnhanced === 'function') window.__setIntroEnhanced();

  introEl.addEventListener('click', () => {
    if (typeof window.getAudioContext === 'function') window.getAudioContext();
    startWave();
  });
}
