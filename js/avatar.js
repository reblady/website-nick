import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, ps1Material } from './ps1.js';

// Nick's low-poly avatar (source: assets/models/nick.blend). Base mesh from
// Tripo, textured, shaded and rigged in Blender: small pixel textures per
// region, ambient occlusion baked into the vertex colours like the painted
// shading of late PS1 games.
// Clips: "Idle" (2 s loop) and "Wave" (2.5 s, ends with the arm still raised).
const MODEL_URL = 'assets/models/nick.glb';

// glTF stores vertex colours as linear values. Everything else on the stage is
// sampled raw (no colour management), so bring them back to the sRGB values
// they were baked with.
function vertexColorsToSRGB(geometry) {
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

export async function loadAvatar(snap) {
  const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
  const root = gltf.scene;

  root.traverse((obj) => {
    if (!obj.isMesh) return;
    const map = obj.material.map;
    if (map) {
      map.magFilter = THREE.NearestFilter;
      map.minFilter = THREE.NearestFilter;
      map.generateMipmaps = false;
      // Sample the texels raw, like every other colour on the stage.
      map.colorSpace = THREE.NoColorSpace;
    }
    const vertexColors = vertexColorsToSRGB(obj.geometry);
    obj.material = ps1Material(snap, { map, vertexColors });
    // Skinned bounds don't follow the raised arm, so never cull.
    obj.frustumCulled = false;
  });

  const mixer = new THREE.AnimationMixer(root);
  const clip = (name) => THREE.AnimationClip.findByName(gltf.animations, name);

  const idle = mixer.clipAction(clip('Idle'));
  idle.play();

  const wave = mixer.clipAction(clip('Wave'));
  wave.setLoop(THREE.LoopOnce, 1);
  wave.clampWhenFinished = true;

  return {
    root,
    update(dt) {
      mixer.update(dt);
    },
    wave() {
      wave.reset().play();
      wave.crossFadeFrom(idle, 0.25, false);
    },
  };
}
