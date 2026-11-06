import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { THREE, ps1Material, vertexColorsToSRGB } from './ps1.js';

// "PlayStation Portable (low poly)" by Senkinsky, CC BY 4.0 (credited on the
// page). Prepared in Blender (assets/models/psp.blend): its screen quad is
// removed, the model is scaled so the screen is SCREEN.width wide and centred
// on the origin, the materials are merged into a few flat colours and ambient
// occlusion is baked into the vertex colours.
// Its screen shows the photo that was just taken of the avatar.
const MODEL_URL = 'assets/models/psp.glb';

export const SCREEN = { width: 0.96, height: 0.522, z: 0.0765 };

// Width of the whole console, for laying it out next to the panel.
export const BODY_WIDTH = 1.57;

// Material names from the Blender file → colour. null = theme accent.
const COLORS = {
  PSP_Shell: '#26241f',
  PSP_Trim: '#8f897e',
  PSP_Buttons: '#3d3a34',
  PSP_Accent: null,
  PSP_Led: '#57c785',
};

export function createHandheld(snap, screenTexture) {
  const group = new THREE.Group();
  const accent = ps1Material(snap, { vertexColors: true });

  // Subdivided so the affine texture warp stays subtle on the photo.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(SCREEN.width, SCREEN.height, 8, 5),
    ps1Material(snap, { map: screenTexture, unlit: true })
  );
  screen.position.z = SCREEN.z;
  group.add(screen);

  const ready = new GLTFLoader().loadAsync(MODEL_URL).then((gltf) => {
    gltf.scene.traverse((obj) => {
      if (!obj.isMesh) return;
      const vertexColors = vertexColorsToSRGB(obj.geometry);
      const color = COLORS[obj.material.name];
      obj.material = color === null ? accent : ps1Material(snap, { color, vertexColors });
    });
    group.add(gltf.scene);
  });

  function setAccent(hex) {
    accent.color.set(hex);
  }

  return { group, setAccent, ready };
}
