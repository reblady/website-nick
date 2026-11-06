import { THREE, ps1Material, pixelTexture, shade, speckle } from './ps1.js';

// Nick: dark blond hair, blue eyes, baggy hoodie and baggy jeans.
export const AVATAR_COLORS = {
  skin: '#e2b48f',
  hair: '#8a6a3d',
  eyes: '#3f7fd6',
  hoodie: '#4c5058',
  jeans: '#3f5a82',
  shoes: '#e6e0d2',
};

function denimTexture(base) {
  return pixelTexture(32, (g, size) => {
    g.fillStyle = base;
    g.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const twill = (x + y) % 4 === 0;
        const noise = (Math.random() * 2 - 1) * 0.08;
        g.fillStyle = shade(base, (twill ? 1.16 : 0.96) + noise);
        g.fillRect(x, y, 1, 1);
      }
    }
  });
}

function hairTexture(base) {
  return pixelTexture(16, (g, size) => {
    for (let x = 0; x < size; x++) {
      g.fillStyle = shade(base, 0.85 + Math.random() * 0.35);
      g.fillRect(x, 0, 1, size);
    }
  });
}

export function createAvatar(snap) {
  const c = AVATAR_COLORS;
  const root = new THREE.Group();

  const mat = {
    skin: ps1Material(snap, { color: c.skin }),
    skinDark: ps1Material(snap, { color: shade(c.skin, 0.72) }),
    hair: ps1Material(snap, { map: hairTexture(c.hair) }),
    eyeWhite: ps1Material(snap, { color: '#f2eee6', unlit: true }),
    eyes: ps1Material(snap, { color: c.eyes, unlit: true }),
    hoodie: ps1Material(snap, { map: speckle(c.hoodie, 0.1) }),
    hoodieDark: ps1Material(snap, { map: speckle(shade(c.hoodie, 0.78), 0.1) }),
    string: ps1Material(snap, { color: '#d9d4c8' }),
    jeans: ps1Material(snap, { map: denimTexture(c.jeans) }),
    jeansDark: ps1Material(snap, { map: denimTexture(shade(c.jeans, 0.8)) }),
    shoes: ps1Material(snap, { map: speckle(c.shoes, 0.05) }),
    sole: ps1Material(snap, { color: '#8f877a' }),
  };

  function add(geometry, material, x, y, z, parent = root) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  // Legs — wide, slightly flared baggy jeans stacking on the shoes.
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.125, 0.155, 0.84, 6), mat.jeans, side * 0.13, 0.52, 0);
    add(new THREE.CylinderGeometry(0.165, 0.165, 0.08, 6), mat.jeansDark, side * 0.13, 0.13, 0);
    add(new THREE.BoxGeometry(0.17, 0.1, 0.3), mat.shoes, side * 0.13, 0.06, 0.05);
    add(new THREE.BoxGeometry(0.18, 0.03, 0.31), mat.sole, side * 0.13, 0.015, 0.05);
  }
  add(new THREE.CylinderGeometry(0.25, 0.25, 0.2, 7), mat.jeans, 0, 0.94, 0);

  // Torso — oversized hoodie, wider at the hem.
  const body = new THREE.Group();
  root.add(body);
  const torso = add(new THREE.CylinderGeometry(0.28, 0.335, 0.66, 7), mat.hoodie, 0, 1.31, 0, body);
  torso.scale.z = 0.75;
  const hem = add(new THREE.CylinderGeometry(0.33, 0.32, 0.09, 7), mat.hoodieDark, 0, 0.99, 0, body);
  hem.scale.z = 0.76;
  add(new THREE.BoxGeometry(0.36, 0.17, 0.03), mat.hoodieDark, 0, 1.14, 0.245, body);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.016, 0.17, 0.016), mat.string, side * 0.05, 1.5, 0.215, body);
  }
  const hood = add(new THREE.SphereGeometry(0.21, 6, 4), mat.hoodieDark, 0, 1.63, -0.13, body);
  hood.scale.set(1.05, 0.62, 0.8);
  const collar = add(new THREE.TorusGeometry(0.13, 0.05, 4, 7), mat.hoodie, 0, 1.63, 0, body);
  collar.rotation.x = Math.PI / 2;
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 6), mat.skin, 0, 1.69, 0, body);

  // Head.
  const head = new THREE.Group();
  head.position.set(0, 1.86, 0);
  body.add(head);
  const skull = add(new THREE.IcosahedronGeometry(0.17, 1), mat.skin, 0, 0, 0, head);
  skull.scale.set(1, 1.12, 1);
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.056, 0.034, 0.02), mat.eyeWhite, side * 0.062, 0.012, 0.152, head);
    add(new THREE.BoxGeometry(0.03, 0.032, 0.02), mat.eyes, side * 0.062, 0.012, 0.162, head);
    add(new THREE.BoxGeometry(0.064, 0.014, 0.02), mat.hair, side * 0.064, 0.058, 0.152, head);
    add(new THREE.BoxGeometry(0.03, 0.06, 0.045), mat.skin, side * 0.172, -0.005, 0, head);
  }
  add(new THREE.BoxGeometry(0.032, 0.05, 0.034), mat.skin, 0, -0.025, 0.17, head);
  add(new THREE.BoxGeometry(0.06, 0.013, 0.02), mat.skinDark, 0, -0.085, 0.148, head);

  // Hair — a cap plus a messy fringe of low-poly spikes.
  const cap = add(
    new THREE.SphereGeometry(0.184, 7, 4, 0, Math.PI * 2, 0, Math.PI * 0.56),
    mat.hair, 0, 0.035, -0.008, head
  );
  cap.scale.set(1.04, 1.12, 1.06);
  const fringe = [[-0.11, 0.3], [-0.045, -0.1], [0.025, 0.2], [0.095, -0.25]];
  for (const [x, tilt] of fringe) {
    const spike = add(new THREE.ConeGeometry(0.055, 0.15, 4), mat.hair, x, 0.11, 0.12, head);
    spike.rotation.set(Math.PI * 0.78, 0, tilt);
  }
  const back = add(new THREE.ConeGeometry(0.17, 0.16, 5), mat.hair, 0, 0.0, -0.1, head);
  back.rotation.x = Math.PI * 1.08;

  // Arms — shoulder and elbow pivots so the forearm can wave.
  function buildArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.37, 1.56, 0);
    body.add(shoulder);
    add(new THREE.SphereGeometry(0.11, 5, 4), mat.hoodie, 0, 0, 0, shoulder);
    add(new THREE.CylinderGeometry(0.088, 0.1, 0.34, 6), mat.hoodie, 0, -0.17, 0, shoulder);
    const elbow = new THREE.Group();
    elbow.position.y = -0.34;
    shoulder.add(elbow);
    add(new THREE.CylinderGeometry(0.1, 0.118, 0.3, 6), mat.hoodie, 0, -0.15, 0, elbow);
    add(new THREE.CylinderGeometry(0.085, 0.085, 0.05, 6), mat.hoodieDark, 0, -0.315, 0, elbow);
    add(new THREE.BoxGeometry(0.09, 0.12, 0.06), mat.skin, 0, -0.39, 0, elbow);
    return { shoulder, elbow, side };
  }
  // Facing +Z, the character's right hand is on the -X side.
  const rightArm = buildArm(-1);
  const leftArm = buildArm(1);

  /**
   * t: seconds, wave: 0..1 how far the right arm is raised into the wave.
   */
  function update(t, wave) {
    body.position.y = Math.sin(t * 2.1) * 0.008;
    head.rotation.y = Math.sin(t * 0.7) * 0.09 + wave * 0.08;
    head.rotation.z = wave * 0.06;
    head.rotation.x = Math.sin(t * 0.9) * 0.03;

    leftArm.shoulder.rotation.z = 0.14 + Math.sin(t * 2.1) * 0.015;
    leftArm.elbow.rotation.z = 0.08;

    rightArm.shoulder.rotation.z = THREE.MathUtils.lerp(-0.14, -2.55, wave);
    rightArm.shoulder.rotation.x = -0.15 * wave;
    rightArm.elbow.rotation.z = THREE.MathUtils.lerp(-0.08, 0.35, wave) + Math.sin(t * 9) * 0.45 * wave;
  }

  update(0, 0);

  return { root, update };
}
