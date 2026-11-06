import * as THREE from 'three';

export { THREE };

// Colours are authored as plain hex and should land on screen exactly like
// that — no linear/sRGB round trip. The PS1 never had colour management either.
THREE.ColorManagement.enabled = false;

// Internal render height, like the 240p output of the original hardware.
const LOW_HEIGHT = 240;

const POST_VERTEX = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

// Nearest-neighbour upscale + 4x4 Bayer dither + 15-bit colour (5 bits per
// channel), then a fade towards a solid colour for black/white transitions.
const POST_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uLow;
  uniform float uFade;
  uniform vec3 uFadeColor;
  varying vec2 vUv;

  float bayer(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return m[i] / 16.0 - 0.5;
  }

  void main() {
    vec2 px = floor(vUv * uLow);
    vec3 c = texture2D(tDiffuse, (px + 0.5) / uLow).rgb;
    c += bayer(px) / 31.0;
    c = floor(c * 31.0 + 0.5) / 31.0;
    c = mix(c, uFadeColor, uFade);
    gl_FragColor = vec4(c, 1.0);
  }
`;

export function createPS1(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, preserveDrawingBuffer: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(1);

  const target = new THREE.WebGLRenderTarget(2, 2, {
    minFilter: THREE.NearestFilter,
    magFilter: THREE.NearestFilter,
    generateMipmaps: false,
  });

  const low = new THREE.Vector2(320, 240);
  // Shared by every PS1 material: vertices snap to this grid in clip space.
  const snap = { value: new THREE.Vector2(160, 120) };

  const post = new THREE.ShaderMaterial({
    uniforms: {
      tDiffuse: { value: target.texture },
      uLow: { value: low },
      uFade: { value: 1 },
      uFadeColor: { value: new THREE.Color(0x000000) },
    },
    vertexShader: POST_VERTEX,
    fragmentShader: POST_FRAGMENT,
    depthTest: false,
    depthWrite: false,
  });
  const postScene = new THREE.Scene();
  postScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), post));
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h);
    const lw = Math.max(1, Math.round(LOW_HEIGHT * w / h));
    target.setSize(lw, LOW_HEIGHT);
    low.set(lw, LOW_HEIGHT);
    snap.value.set(lw / 2, LOW_HEIGHT / 2);
  }

  function render(scene, camera) {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  function renderTo(renderTarget, scene, camera) {
    renderer.setRenderTarget(renderTarget);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
  }

  resize();

  return {
    renderer,
    snap,
    fade: post.uniforms.uFade,
    fadeColor: post.uniforms.uFadeColor,
    resize,
    render,
    renderTo,
  };
}

/* ---------------------------------------------------------
   Materials — vertex snapping (the wobbly polygons) and affine
   texture mapping (the warping textures). Affine trick: the
   UV is multiplied by w in the vertex shader and divided by the
   interpolated w in the fragment shader, which cancels out the
   GPU's perspective correction.
--------------------------------------------------------- */

export function ps1Material(snap, { color = 0xffffff, map = null, unlit = false, vertexColors = false } = {}) {
  const material = unlit
    ? new THREE.MeshBasicMaterial({ color, map, vertexColors })
    : new THREE.MeshLambertMaterial({ color, map, vertexColors, flatShading: true });

  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSnap = snap;
    shader.vertexShader = 'uniform vec2 uSnap;\nvarying float vAffineW;\n' + shader.vertexShader.replace(
      '#include <project_vertex>',
      `#include <project_vertex>
      gl_Position.xy = floor(gl_Position.xy / gl_Position.w * uSnap + 0.5) / uSnap * gl_Position.w;
      vAffineW = gl_Position.w;
      #ifdef USE_MAP
        vMapUv *= vAffineW;
      #endif`
    );
    shader.fragmentShader = 'varying float vAffineW;\n' + shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
        diffuseColor *= texture2D( map, vMapUv / vAffineW );
      #endif`
    );
  };

  return material;
}

/* ---------------------------------------------------------
   Tiny procedural textures, drawn on a canvas and sampled
   without filtering so every texel stays a hard pixel.
--------------------------------------------------------- */

export function pixelTexture(size, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  paint(canvas.getContext('2d'), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function shade(hex, factor) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(factor);
  return `#${c.getHexString()}`;
}

// Base colour with random lighter/darker texels — reads as fabric, plastic
// or dirt depending on colour and strength.
export function speckle(base, strength = 0.12, size = 32) {
  return pixelTexture(size, (g) => {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (Math.random() < 0.45) {
          g.fillStyle = shade(base, 1 + (Math.random() * 2 - 1) * strength);
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  });
}
