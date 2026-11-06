import { THREE, ps1Material, speckle } from './ps1.js';

// Wide handheld console, our own design (no real brand, no logos).
// Its screen shows the photo that was just taken of the avatar.
export const SCREEN = { width: 0.96, height: 0.54, z: 0.112 };

const BODY = { width: 1.9, height: 0.8, depth: 0.14, bevel: 0.03 };

function capsuleShape(width, height) {
  const r = height / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-width / 2 + r, -r);
  shape.lineTo(width / 2 - r, -r);
  shape.absarc(width / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(-width / 2 + r, r);
  shape.absarc(-width / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
  return shape;
}

export function createHandheld(snap, screenTexture) {
  const group = new THREE.Group();

  const mat = {
    body: ps1Material(snap, { map: speckle('#2b2925', 0.12) }),
    bezel: ps1Material(snap, { color: '#0d0c0a' }),
    screen: ps1Material(snap, { map: screenTexture, unlit: true }),
    control: ps1Material(snap, { color: '#3d3a34' }),
    accent: ps1Material(snap, { color: '#e0b46a' }),
  };

  function add(geometry, material, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    group.add(mesh);
    return mesh;
  }

  const bodyGeometry = new THREE.ExtrudeGeometry(capsuleShape(BODY.width, BODY.height), {
    depth: BODY.depth,
    bevelEnabled: true,
    bevelThickness: BODY.bevel,
    bevelSize: BODY.bevel,
    bevelSegments: 1,
    curveSegments: 5,
  });
  bodyGeometry.center();
  add(bodyGeometry, mat.body, 0, 0, 0);

  const front = BODY.depth / 2 + BODY.bevel;
  add(new THREE.PlaneGeometry(1.08, 0.64), mat.bezel, 0, 0, front + 0.006);
  // Subdivided so the affine texture warp stays subtle on the photo.
  add(new THREE.PlaneGeometry(SCREEN.width, SCREEN.height, 8, 5), mat.screen, 0, 0, SCREEN.z);

  // D-pad and analogue nub on the left.
  add(new THREE.BoxGeometry(0.2, 0.066, 0.03), mat.control, -0.72, 0.08, front + 0.02);
  add(new THREE.BoxGeometry(0.066, 0.2, 0.03), mat.control, -0.72, 0.08, front + 0.02);
  const nub = add(new THREE.CylinderGeometry(0.05, 0.056, 0.03, 8), mat.control, -0.7, -0.21, front + 0.02);
  nub.rotation.x = Math.PI / 2;

  // Four plain round face buttons on the right.
  for (const [dx, dy] of [[0, 0.1], [0.1, 0], [0, -0.1], [-0.1, 0]]) {
    const button = add(new THREE.CylinderGeometry(0.044, 0.044, 0.03, 8), mat.accent, 0.72 + dx, 0.08 + dy, front + 0.02);
    button.rotation.x = Math.PI / 2;
  }

  // Small pills under the screen, shoulder buttons on top.
  for (const x of [0.52, 0.64]) {
    add(new THREE.BoxGeometry(0.08, 0.026, 0.02), mat.control, x, -0.33, front + 0.012);
  }
  add(new THREE.BoxGeometry(0.14, 0.012, 0.006), mat.accent, 0, -0.355, front + 0.008);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.38, 0.05, 0.1), mat.control, side * 0.6, 0.41, 0);
  }

  function setAccent(hex) {
    mat.accent.color.set(hex);
  }

  return { group, setAccent };
}
