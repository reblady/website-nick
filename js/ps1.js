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
// uWave is the underwater look: the picture wobbles gently in whole low-res
// pixels, with large soft patches of light drifting across the top.
// uSplit (≥ 0) is the half-submerged view while diving in: above that screen
// height the picture comes from tDiffuse, below it from tUnder (the world
// under water), and the wavy waterline between them refracts like the edge
// of the liquid glass: it bends the picture towards itself with a rainbow
// fringe and catches a bright rim of light.
const POST_FRAGMENT = /* glsl */ `
  uniform sampler2D tDiffuse;
  uniform vec2 uLow;
  uniform float uFade;
  uniform vec3 uFadeColor;
  uniform float uWave;
  uniform float uTime;
  uniform sampler2D tUnder;
  uniform float uSplit;
  varying vec2 vUv;

  vec3 sampleAt(sampler2D tex, vec2 px) {
    return texture2D(tex, (px + 0.5) / uLow).rgb;
  }

  vec3 waterline(vec2 px) {
    float line = uSplit * uLow.y
      + sin(px.x * 0.045 + uTime * 1.9) * 2.0 + sin(px.x * 0.11 - uTime * 2.7);
    float d = px.y + 0.5 - line;
    vec3 c;
    if (d < 0.0) {
      // Below: bent up towards the line, strongest at the edge, each colour
      // channel a little differently.
      float k = exp(d / 12.0);
      vec2 off = vec2(sin(px.y * 0.21 + uTime * 3.0) * 2.0 * k, 10.0 * k);
      c = vec3(
        sampleAt(tUnder, px + floor(off * 1.2 + 0.5)).r,
        sampleAt(tUnder, px + floor(off + 0.5)).g,
        sampleAt(tUnder, px + floor(off * 0.8 + 0.5)).b
      );
      c = mix(c, c * vec3(0.8, 1.0, 1.0), 0.4);
    } else {
      // Above: pulled down a little towards the line.
      float k = exp(-d / 7.0);
      c = sampleAt(tDiffuse, px + vec2(0.0, -floor(4.0 * k + 0.5)));
    }
    float rim = 1.0 - smoothstep(0.0, 2.2, abs(d));
    return c + vec3(0.45, 0.85, 0.85) * rim;
  }

  float bayer(vec2 p) {
    int i = int(mod(p.x, 4.0)) + int(mod(p.y, 4.0)) * 4;
    float m[16] = float[16](0., 8., 2., 10., 12., 4., 14., 6., 3., 11., 1., 9., 15., 7., 13., 5.);
    return m[i] / 16.0 - 0.5;
  }

  void main() {
    vec2 px = floor(vUv * uLow);
    vec2 wobble = floor(vec2(
      sin(px.y * 0.05 + uTime * 1.8) * 2.2 + sin(px.y * 0.13 + uTime * 3.1) * 0.8,
      cos(px.x * 0.045 + uTime * 1.5) * 1.2
    ) * uWave + 0.5);
    vec3 c = uSplit >= 0.0 ? waterline(px) : texture2D(tDiffuse, (px + wobble + 0.5) / uLow).rgb;
    if (uWave > 0.0) {
      // Large soft patches of light drifting slowly from above.
      float dapple = sin(px.x * 0.021 + uTime * 0.35) * sin(px.y * 0.027 - uTime * 0.28)
        + 0.5 * sin((px.x + px.y) * 0.013 + uTime * 0.45);
      c += vec3(0.03, 0.07, 0.07) * smoothstep(0.4, 1.3, dapple) * uWave * vUv.y;
      c = mix(c, c * vec3(0.8, 1.0, 1.0), uWave * 0.4);
    }
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

  // Second picture for the half-submerged view while diving in.
  const targetUnder = new THREE.WebGLRenderTarget(2, 2, {
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
      uWave: { value: 0 },
      uTime: { value: 0 },
      tUnder: { value: targetUnder.texture },
      uSplit: { value: -1 },
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
    targetUnder.setSize(lw, LOW_HEIGHT);
    low.set(lw, LOW_HEIGHT);
    snap.value.set(lw / 2, LOW_HEIGHT / 2);
  }

  function render(scene, camera) {
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    renderer.render(postScene, postCamera);
  }

  // Half-submerged: the scene is drawn twice, once as seen above the water
  // and once below (showAbove/showBelow switch what's visible), and joined
  // at the waterline, `line` = its screen height from the bottom (0…1).
  function renderSplit(scene, camera, line, showAbove, showBelow) {
    showAbove();
    renderer.setRenderTarget(target);
    renderer.render(scene, camera);
    showBelow();
    renderer.setRenderTarget(targetUnder);
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    post.uniforms.uSplit.value = line;
    renderer.render(postScene, postCamera);
    post.uniforms.uSplit.value = -1;
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
    wave: post.uniforms.uWave,
    time: post.uniforms.uTime,
    resize,
    render,
    renderSplit,
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

export function pixelTexture(size, paint, height = size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = height;
  paint(canvas.getContext('2d'), size, height);
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

// glTF stores vertex colours as linear values. Everything else on the stage is
// sampled raw (no colour management), so bring baked models back to the sRGB
// values they were baked with. Returns whether the geometry has colours.
export function vertexColorsToSRGB(geometry) {
  const color = geometry.attributes.color;
  if (!color) return false;
  const c = new THREE.Color();
  for (let i = 0; i < color.count; i++) {
    c.setRGB(color.getX(i), color.getY(i), color.getZ(i)).convertLinearToSRGB();
    color.setXYZ(i, c.r, c.g, c.b);
  }
  color.needsUpdate = true;
  return true;
}
