import { THREE, ps1Material, speckle, pixelTexture } from './ps1.js';

// The scroll journey behind the page: six worlds stacked downwards in the
// device scene, one band of BAND world units per section. Scrolling one
// section lowers the camera by one band, so the trip goes from space through
// the atmosphere to the land, into a cave, down to an underground lake and
// finally under its surface.
// Sky, fog and light blend between the worlds' moods as you go.
//
// Where the camera goes underground (into the earth below the land, and
// through the rock below the cave) a cross-section of the ground slides up
// right in front of the camera, like a cutaway: grass and soil, then rock.
// The worlds swap behind it, so you never see into the models.
//
// Rough first version: simple low-poly shapes, details come later.

export const BAND = 12;

// Per world and theme: sky gradient (top, middle, bottom), fog colour and
// range, ambient and key light. Order = order of the sections.
const MOODS = {
  dark: [
    // Space
    { sky: ['#030308', '#0c0b16', '#241d33'], fog: '#0c0b16', near: 40, far: 140, ambient: '#8a8aa8', sun: '#e8e4ff' },
    // Atmosphere at night, moonlit clouds over a last band of dusk
    { sky: ['#0e1830', '#28395e', '#6c5e74'], fog: '#28395e', near: 10, far: 48, ambient: '#9aa6c8', sun: '#ffe3b3' },
    // Land at dusk, the same mood as the avatar's world
    { sky: ['#4a4f57', '#5a4a35', '#1a1712'], fog: '#3a352c', near: 12, far: 60, ambient: '#9a9080', sun: '#ffe3b3' },
    // Cave, lit by warm crystal glow
    { sky: ['#0d0a08', '#18130f', '#080605'], fog: '#130f0c', near: 5, far: 28, ambient: '#8a7660', sun: '#e0b46a' },
    // Underground lake, bioluminescent teal
    { sky: ['#02100f', '#062424', '#010606'], fog: '#052a2a', near: 6, far: 40, ambient: '#3f8a8a', sun: '#8af0ff' },
    // Under water: thick teal haze, light from the surface above
    { sky: ['#0d5a5a', '#073636', '#021414'], fog: '#06393a', near: 2, far: 26, ambient: '#4fa8a4', sun: '#a8fbff' },
  ],
  light: [
    { sky: ['#2b2a45', '#6d5a78', '#e9b48f'], fog: '#6d5a78', near: 40, far: 140, ambient: '#c8bcd8', sun: '#fff1dc' },
    { sky: ['#8fc0e6', '#cfe3ef', '#f6ead9'], fog: '#cfe3ef', near: 10, far: 48, ambient: '#e4eef6', sun: '#fff1dc' },
    { sky: ['#f6ead9', '#ecc9a2', '#cf8a63'], fog: '#e9cdb0', near: 12, far: 60, ambient: '#c8b8a4', sun: '#fff1dc' },
    { sky: ['#3a2a20', '#5a4232', '#2a1e16'], fog: '#4a3628', near: 4, far: 24, ambient: '#b89878', sun: '#f0c98a' },
    { sky: ['#1b4a48', '#2c6e6a', '#123230'], fog: '#2c5f5c', near: 6, far: 42, ambient: '#a6e0d8', sun: '#d6fbff' },
    { sky: ['#3fa8a2', '#1f6e6a', '#0c3634'], fog: '#2a7470', near: 2, far: 28, ambient: '#b4f0ea', sun: '#e6ffff' },
  ],
};

// The cross-sections hang at z = 0, 4 units in front of the camera, where
// the screen shows 2.52 units of height. Earth: from the grass at y −26 down
// to the cave ceiling at −32, it covers the whole screen between progress
// 2.27 and 2.56. Rock: −38.2 to −43.6, covering 3.29 to 3.53. The worlds
// swap in the middle of that.
const SWAP_TO_CAVE = 2.42;
const SWAP_TO_LAKE = 3.41;

// The lake's surface lies at y −49.6: the camera crosses it at progress 4.13
// and the lake above swaps for the world under water. From there on the
// picture wobbles like seen through water (ramping in as the surface passes).
const SURFACE = 49.6 / BAND;
const DIVE = { in: SURFACE - 0.04, full: SURFACE + 0.05 };

const rand = (min, max) => min + Math.random() * (max - min);

function buildStars(group) {
  // Two layers: many single pixels and a few brighter double pixels.
  for (const [count, size, color] of [[420, 1, '#cfcce8'], [60, 2, '#fff6e0']]) {
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions.set([rand(-60, 60), rand(-10, 30), rand(-70, -25)], i * 3);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    group.add(new THREE.Points(geometry, new THREE.PointsMaterial({ size, sizeAttenuation: false, color })));
  }
}

function buildClouds(snap, group, y) {
  const material = ps1Material(snap, { color: '#f2eef4' });
  const blob = new THREE.IcosahedronGeometry(1, 0);
  const clouds = [];
  for (let i = 0; i < 20; i++) {
    const cloud = new THREE.Group();
    const puffs = 3 + Math.floor(Math.random() * 3);
    for (let j = 0; j < puffs; j++) {
      const puff = new THREE.Mesh(blob, material);
      puff.position.set(j * 0.9 - puffs * 0.45 + rand(-0.2, 0.2), rand(-0.15, 0.25), rand(-0.3, 0.3));
      const s = rand(0.6, 1.2);
      puff.scale.set(s, s * 0.6, s);
      cloud.add(puff);
    }
    const scale = rand(0.7, 1.6);
    cloud.scale.setScalar(scale);
    cloud.position.set(rand(-18, 18), y + rand(-5.5, 5.5), rand(-24, -4));
    cloud.userData.speed = rand(0.15, 0.4) / scale;
    group.add(cloud);
    clouds.push(cloud);
  }
  return clouds;
}

function buildLand(snap, group, y) {
  const groundTop = y - 2;
  // Starts at z = 0, behind the earth cross-section, so nothing pokes out.
  const grass = new THREE.Mesh(
    new THREE.BoxGeometry(160, 0.4, 96, 16, 1, 10),
    ps1Material(snap, { map: speckle('#56672f', 0.18) })
  );
  grass.material.map.repeat.set(40, 24);
  grass.position.set(0, groundTop - 0.2, -48);
  group.add(grass);

  const rock = ps1Material(snap, { color: '#6b6052' });
  for (let i = 0; i < 9; i++) {
    const height = rand(7, 14);
    const peak = new THREE.Mesh(new THREE.ConeGeometry(rand(5, 9), height, 5), rock);
    peak.position.set(rand(-40, 40), groundTop + height / 2 - 0.3, rand(-70, -38));
    peak.rotation.y = rand(0, Math.PI);
    group.add(peak);
  }

  const leaves = ps1Material(snap, { color: '#2f4a2a' });
  const bark = ps1Material(snap, { color: '#4a3424' });
  const crown = new THREE.ConeGeometry(0.7, 1.8, 5);
  const trunk = new THREE.CylinderGeometry(0.12, 0.16, 0.6, 5);
  for (let i = 0; i < 26; i++) {
    const tree = new THREE.Group();
    const top = new THREE.Mesh(crown, leaves);
    top.position.y = 1.4;
    const stem = new THREE.Mesh(trunk, bark);
    stem.position.y = 0.3;
    tree.add(top, stem);
    tree.scale.setScalar(rand(0.7, 1.4));
    tree.position.set(rand(-14, 14), groundTop, rand(-28, -5));
    group.add(tree);
  }

  // Low sun on the horizon.
  const sun = new THREE.Mesh(new THREE.CircleGeometry(4, 10), ps1Material(snap, { color: '#ffcf8a', unlit: true }));
  sun.position.set(14, groundTop + 3, -90);
  group.add(sun);
}

function spikes(snap, group, material, count, y, down, spread) {
  for (let i = 0; i < count; i++) {
    const height = rand(0.8, 2.6);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(rand(0.25, 0.6), height, 5), material);
    spike.position.set(rand(-spread, spread), y + (down ? -height / 2 : height / 2), rand(-18, -2));
    if (down) spike.rotation.x = Math.PI;
    group.add(spike);
  }
}

function glowCrystals(snap, group, color, count, y, spread) {
  const material = ps1Material(snap, { color, unlit: true });
  for (let i = 0; i < count; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), material);
    crystal.scale.set(rand(0.15, 0.3), rand(0.4, 0.9), rand(0.15, 0.3));
    crystal.position.set(rand(-spread, spread), y, rand(-16, -3));
    crystal.rotation.z = rand(-0.4, 0.4);
    group.add(crystal);
  }
}

// A cluster of glowing crystals fanning out from one spot.
function crystalCluster(material, size) {
  const cluster = new THREE.Group();
  const count = 3 + Math.floor(Math.random() * 4);
  for (let i = 0; i < count; i++) {
    const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(1), material);
    const length = rand(0.5, 1.1) * size;
    crystal.scale.set(length * 0.28, length, length * 0.28);
    crystal.position.y = length * 0.6;
    const tilt = new THREE.Group();
    tilt.rotation.set(rand(-0.5, 0.5), rand(0, Math.PI), (i - count / 2) * 0.35);
    tilt.add(crystal);
    cluster.add(tilt);
  }
  return cluster;
}

// Soft round light pool, dithered like everything else (light on water).
function poolTexture() {
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  return pixelTexture(32, (g, size) => {
    g.fillStyle = '#ffffff';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const r = Math.hypot(x + 0.5 - size / 2, y + 0.5 - size / 2) / (size / 2);
        if (r < 1 && (1 - r) ** 1.4 > (bayer[(y % 4) * 4 + (x % 4)] + 0.5) / 16) g.fillRect(x, y, 1, 1);
      }
    }
  });
}

// First cave: an arched tunnel of warm rock running into the dark, an
// uneven floor, stalactites and stalagmites (some grown into columns),
// clusters of amber crystals whose light pools on the rock, dust in the air
// and drops falling from the ceiling. Starts at z = −1, behind the
// cross-section of the earth.
function buildCave(snap, group, y) {
  const floorY = y - 2.5;
  const radius = 9;
  const rock = ps1Material(snap, { map: speckle('#6a523c', 0.3) });
  rock.side = THREE.DoubleSide;
  const stone = ps1Material(snap, { map: speckle('#7a6550', 0.25) });

  const vault = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 46, 14, 8, true, -Math.PI / 2, Math.PI), rock);
  vault.material.map.repeat.set(10, 12);
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, floorY, -24);
  group.add(vault);

  // Floor: a plane with bumps, wider than the tunnel.
  const floorGeometry = new THREE.PlaneGeometry(2 * radius + 2, 46, 14, 30);
  const bumps = floorGeometry.attributes.position;
  for (let i = 0; i < bumps.count; i++) {
    const x = bumps.getX(i);
    const edge = Math.max(0, Math.abs(x) - radius + 3);
    bumps.setZ(i, rand(0, 0.35) + edge * 0.6);
  }
  const floor = new THREE.Mesh(floorGeometry, ps1Material(snap, { map: speckle('#3a2d22', 0.3) }));
  floor.material.map.repeat.set(6, 14);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, floorY, -24);
  group.add(floor);

  // Stalactites follow the arch, stalagmites grow from the floor; where one
  // stands right below another they meet as a column.
  const cone = (r, h) => new THREE.ConeGeometry(r, h, 6);
  for (let i = 0; i < 40; i++) {
    const angle = rand(0.15, 0.85) * Math.PI;
    const length = rand(0.6, 2.6) * (0.5 + Math.sin(angle) * 0.7);
    const spike = new THREE.Mesh(cone(rand(0.15, 0.45), length), stone);
    spike.rotation.x = Math.PI;
    spike.position.set(Math.cos(angle) * (radius - 0.3), floorY + Math.sin(angle) * (radius - 0.3) - length / 2, rand(-44, -3));
    group.add(spike);
  }
  for (let i = 0; i < 18; i++) {
    const height = rand(0.5, 1.8);
    const spike = new THREE.Mesh(cone(rand(0.2, 0.5), height), stone);
    spike.position.set(rand(-6.5, 6.5), floorY + height / 2, rand(-40, -3));
    group.add(spike);
  }
  for (let i = 0; i < 4; i++) {
    const x = rand(-5.5, 5.5);
    const z = rand(-30, -8);
    const top = floorY + Math.sqrt(radius * radius - x * x) - 0.3;
    const reach = (top - floorY) / 2 + 0.3;
    const down = new THREE.Mesh(cone(rand(0.45, 0.7), reach), stone);
    down.rotation.x = Math.PI;
    down.position.set(x, top - reach / 2, z);
    const up = new THREE.Mesh(cone(rand(0.55, 0.8), reach), stone);
    up.position.set(x, floorY + reach / 2, z);
    group.add(down, up);
  }

  // Amber crystal clusters on the floor and the lower walls.
  const amber = ps1Material(snap, { color: '#ffc46a', unlit: true });
  const glowSpots = [];
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const cluster = crystalCluster(amber, rand(0.8, 1.4));
    const x = side * rand(3, 7);
    const z = -4 - i * 5 - rand(0, 2);
    cluster.position.set(x, floorY + Math.max(0, Math.abs(x) - radius + 3) * 0.6, z);
    cluster.rotation.z = -side * 0.3;
    group.add(cluster);
    glowSpots.push(cluster.position.clone().add(new THREE.Vector3(-side * 0.6, 0.8, 0)));
  }

  // Dust hanging in the air and drops falling from the ceiling.
  const dust = points(group, 90, '#c89c64', 1, () => [rand(-7, 7), rand(floorY, floorY + 7), rand(-30, -2)]);
  const drops = points(group, 24, '#9ad0d8', 1, () => [rand(-6, 6), rand(floorY, floorY + 7), rand(-30, -3)]);

  return { dust, drops, floorY, top: floorY + 7, glowSpots };
}

// Underground lake after Nick's references: a vaulted cave lit in cold
// teal, pale stalactites, a dark tunnel at the back, a glowing waterfall,
// luminous ferns on the shore, specks of light in the water and drifting
// mist. The water is see-through and everything above it is mirrored
// underneath, the cheap reflection trick of 32-bit games.
function buildLake(snap, group, y) {
  const waterY = y - 1.6;
  const above = new THREE.Group();
  group.add(above);

  const rock = ps1Material(snap, { map: speckle('#24363a', 0.3) });
  const limestone = ps1Material(snap, { color: '#9fb6ad' });
  const glow = ps1Material(snap, { color: '#5ff2e6', unlit: true });

  // Vault: the inside of half a tube, its axis running into the screen.
  const vault = new THREE.Mesh(
    new THREE.CylinderGeometry(15, 15, 60, 12, 6, true, -Math.PI / 2, Math.PI),
    rock
  );
  vault.material.side = THREE.DoubleSide;
  vault.rotation.x = Math.PI / 2;
  vault.position.set(0, waterY, -20);
  above.add(vault);

  // Stalactites hanging from the vault, longest towards the middle.
  for (let i = 0; i < 46; i++) {
    const angle = rand(0.12, 0.88) * Math.PI;
    const length = rand(0.8, 3.4) * (0.6 + Math.sin(angle) * 0.6);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(rand(0.18, 0.5), length, 5), limestone);
    spike.rotation.x = Math.PI;
    spike.position.set(Math.cos(angle) * 14.2, waterY + Math.sin(angle) * 14.2 - length / 2, rand(-34, -4));
    above.add(spike);
  }

  // Back wall with the black mouth of a tunnel.
  const back = new THREE.Mesh(new THREE.BoxGeometry(32, 16, 1, 4, 2, 1), rock);
  back.position.set(0, waterY + 7, -34);
  above.add(back);
  // Unaffected by fog, so the hole stays black against the misty back wall.
  const tunnelMaterial = ps1Material(snap, { color: '#010404', unlit: true });
  tunnelMaterial.fog = false;
  const tunnel = new THREE.Mesh(new THREE.CircleGeometry(4, 12, 0, Math.PI), tunnelMaterial);
  tunnel.scale.set(1.3, 1, 1);
  tunnel.position.set(-3.5, waterY, -33.4);
  above.add(tunnel);

  // Rocks along both shores, a big dark one in the left foreground.
  const boulder = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 14; i++) {
    const shore = new THREE.Mesh(boulder, rock);
    shore.scale.set(rand(1.4, 2.8), rand(0.8, 2), rand(1.4, 2.8));
    shore.position.set((i % 2 ? 1 : -1) * rand(7, 12), waterY + 0.2, rand(-34, -6));
    above.add(shore);
  }
  const front = new THREE.Mesh(boulder, rock);
  front.scale.set(3.5, 2.2, 3);
  front.position.set(-7.5, waterY + 0.4, -3);
  above.add(front);

  // Waterfall: a strip of glowing stripes that scrolls down, from a ledge.
  const fallTexture = pixelTexture(16, (g, size) => {
    for (let x = 0; x < size; x++) {
      for (let yy = 0; yy < size; yy++) {
        const light = (x * 7 + yy * 3) % 5 === 0 || (x * 3 + yy) % 7 === 0;
        g.fillStyle = light ? '#e6ffff' : x % 3 ? '#7ae8f0' : '#4cc6d6';
        g.fillRect(x, yy, 1, 1);
      }
    }
  });
  fallTexture.repeat.set(1, 3);
  // It glows, so the fog doesn't swallow it.
  const fallMaterial = ps1Material(snap, { map: fallTexture, unlit: true });
  fallMaterial.fog = false;
  const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 9, 2, 8), fallMaterial);
  fall.position.set(4.5, waterY + 4.5, -22);
  above.add(fall);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.9, 1.8), rock);
  ledge.position.set(4.5, waterY + 9.2, -22.6);
  above.add(ledge);

  // Luminous ferns on the shore rocks.
  const frond = new THREE.ConeGeometry(0.07, 0.8, 3);
  for (let i = 0; i < 12; i++) {
    const fern = new THREE.Group();
    for (let j = 0; j < 5; j++) {
      const leaf = new THREE.Mesh(frond, glow);
      leaf.position.y = 0.35;
      leaf.rotation.z = (j - 2) * 0.32;
      fern.add(leaf);
    }
    fern.scale.setScalar(rand(0.45, 0.85));
    fern.position.set((i % 2 ? 1 : -1) * rand(5.5, 9), waterY + rand(0.6, 1.6), rand(-30, -4));
    above.add(fern);
  }
  glowCrystals(snap, above, '#7ee0d0', 8, waterY + 0.6, 9);

  // Crystal clusters high on the walls, each throwing a beam of light down
  // onto the water, where it leaves a glowing pool.
  const cyan = ps1Material(snap, { color: '#8af6ff', unlit: true });
  const poolMaterial = lightMaterial('#9af8ff', 0.5, poolTexture());
  const beams = [];
  const glowSpots = [];
  for (let i = 0; i < 7; i++) {
    const side = i % 2 ? 1 : -1;
    const angle = side > 0 ? rand(0.2, 0.4) * Math.PI : rand(0.6, 0.8) * Math.PI;
    const origin = new THREE.Vector3(Math.cos(angle) * 13.6, waterY + Math.sin(angle) * 13.6, -6 - i * 3.6);
    const cluster = crystalCluster(cyan, rand(1, 1.6));
    cluster.position.copy(origin);
    // Point the cluster into the cave.
    cluster.rotation.z = angle - Math.PI / 2 + Math.PI;
    above.add(cluster);
    glowSpots.push(origin.clone().add(new THREE.Vector3(-side * 1.2, -1, 0)));

    const target = new THREE.Vector3(origin.x * rand(0.2, 0.5), waterY, origin.z + rand(-3, 3));
    const length = origin.distanceTo(target);
    const beamGeometry = new THREE.ConeGeometry(rand(0.45, 0.8), length, 8, 1, true);
    beamGeometry.translate(0, -length / 2, 0);
    const beam = new THREE.Mesh(beamGeometry, lightMaterial('#7ef0ff', 0.07));
    beam.position.copy(origin);
    beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), target.clone().sub(origin).normalize());
    beam.userData.phase = rand(0, Math.PI * 2);
    group.add(beam);
    beams.push(beam);

    const pool = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), poolMaterial);
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(target.x, waterY + 0.05, target.z);
    group.add(pool);
  }

  // Reflection: everything above mirrored in the water, darker.
  const reflection = above.clone(true);
  const dimmed = new Map();
  reflection.traverse((obj) => {
    if (!obj.isMesh) return;
    if (!dimmed.has(obj.material)) {
      const m = obj.material;
      const copy = ps1Material(snap, {
        color: new THREE.Color(m.color).multiplyScalar(0.45),
        map: m.map,
        unlit: m.isMeshBasicMaterial,
      });
      copy.side = THREE.DoubleSide;
      dimmed.set(m, copy);
    }
    obj.material = dimmed.get(obj.material);
  });
  reflection.scale.y = -1;
  reflection.position.y = 2 * waterY;
  group.add(reflection);

  // Water: see-through so the reflection shows, rippling every frame.
  const waterMaterial = ps1Material(snap, { color: '#127078' });
  waterMaterial.transparent = true;
  waterMaterial.opacity = 0.62;
  const water = new THREE.Mesh(new THREE.PlaneGeometry(40, 50, 20, 25), waterMaterial);
  water.rotation.x = -Math.PI / 2;
  water.position.set(0, waterY, -20);
  group.add(water);

  // Specks of light drifting in the water, and mist motes rising in the air.
  const specks = points(group, 170, '#7af6ff', 2, () => [rand(-12, 12), waterY + 0.05, rand(-34, -2)]);
  const mist = points(group, 90, '#3f9c98', 1, () => [rand(-12, 12), rand(waterY, waterY + 9), rand(-34, -2)]);

  return { water, fallTexture, specks, mist, waterY, beams, glowSpots };
}

// Cutaway of the ground: a pixel texture on a plane facing the camera,
// transparent above the grass blades and below the ragged bottom edge.
function crossSection(snap, top, bottom, paint) {
  const height = top - bottom;
  const texture = pixelTexture(64, paint, Math.round(height * 16));
  texture.repeat.set(40 / 4, 1);
  const material = ps1Material(snap, { map: texture, unlit: true });
  material.alphaTest = 0.5;
  material.fog = false;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(40, height), material);
  plane.position.set(0, (top + bottom) / 2, 0);
  return plane;
}

// Shades a colour by a factor, for hand-painted pixel texels.
const tone = (hex, f) => `#${new THREE.Color(hex).multiplyScalar(f).getHexString()}`;

function paintEarth(g, w, h) {
  for (let x = 0; x < w; x++) {
    const blades = 3 + Math.floor(Math.random() * 4);
    const ragged = h - 1 - Math.floor(Math.random() * 6);
    for (let y = 6 - blades; y < ragged; y++) {
      let color;
      if (y < 6) color = Math.random() < 0.5 ? '#6f8a36' : '#56672f';
      else if (y < 10) color = tone('#3d4a22', 0.8 + Math.random() * 0.4);
      else {
        const depth = (y - 10) / (h - 10);
        color = tone('#4a3426', (1 - depth * 0.45) * (0.82 + Math.random() * 0.3));
      }
      g.fillStyle = color;
      g.fillRect(x, y, 1, 1);
    }
  }
  // Roots near the top, stones further down.
  g.fillStyle = '#6e4b2e';
  for (let i = 0; i < 5; i++) {
    let x = Math.floor(Math.random() * w);
    for (let y = 9; y < 9 + 8 + Math.random() * 18; y++) {
      x += Math.random() < 0.3 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      g.fillRect((x + w) % w, y, 1, 1);
    }
  }
  for (let i = 0; i < 9; i++) {
    const cx = Math.floor(Math.random() * w);
    const cy = 20 + Math.floor(Math.random() * (h - 34));
    const r = 1 + Math.floor(Math.random() * 3);
    g.fillStyle = '#5e564e';
    g.fillRect(cx - r, cy - r + 1, r * 2, r * 2 - 1);
    g.fillStyle = '#7b736a';
    g.fillRect(cx - r + 1, cy - r + 1, r, 1);
  }
}

function paintRock(g, w, h) {
  for (let x = 0; x < w; x++) {
    const topEdge = Math.floor(Math.random() * 5);
    const ragged = h - 1 - Math.floor(Math.random() * 7);
    for (let y = topEdge; y < ragged; y++) {
      const band = Math.sin(y * 0.35 + x * 0.05) * 0.08;
      g.fillStyle = tone('#3b322b', 0.75 + band + Math.random() * 0.3);
      g.fillRect(x, y, 1, 1);
    }
  }
  // Cracks, and water seeping through towards the lake below.
  g.fillStyle = '#211b17';
  for (let i = 0; i < 7; i++) {
    let x = Math.floor(Math.random() * w);
    const y0 = 6 + Math.floor(Math.random() * (h - 20));
    for (let y = y0; y < y0 + 6 + Math.random() * 10; y++) {
      x += Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) : 0;
      g.fillRect((x + w) % w, y, 1, 1);
    }
  }
  for (let i = 0; i < 14; i++) {
    g.fillStyle = Math.random() < 0.5 ? '#2d8c8c' : '#4fd0c8';
    g.fillRect(Math.floor(Math.random() * w), h - 16 + Math.floor(Math.random() * 8), 1, 1 + Math.floor(Math.random() * 2));
  }
}

// Bright web of caustics: the edges of a Voronoi pattern, the way light
// focuses through a wavy surface. Transparent elsewhere.
function causticTexture() {
  const size = 64;
  const seeds = Array.from({ length: 14 }, () => [Math.random() * size, Math.random() * size]);
  return pixelTexture(size, (g) => {
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        let a = Infinity;
        let b = Infinity;
        for (const [sx, sy] of seeds) {
          // Wrapped distance, so the texture tiles.
          const dx = Math.min(Math.abs(x - sx), size - Math.abs(x - sx));
          const dy = Math.min(Math.abs(y - sy), size - Math.abs(y - sy));
          const d = Math.hypot(dx, dy);
          if (d < a) [a, b] = [d, a];
          else if (d < b) b = d;
        }
        if (b - a < 1.4) {
          g.fillStyle = b - a < 0.7 ? '#e6ffff' : '#7ef0f0';
          g.fillRect(x, y, 1, 1);
        }
      }
    }
  });
}

// Additive, see-through glow that ignores the fog (light shafts, caustics).
function lightMaterial(color, opacity, map = null) {
  return new THREE.MeshBasicMaterial({
    color,
    map,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    side: THREE.DoubleSide,
  });
}

// Under the lake: a sandy floor with rocks and pillars, swaying glowing weed,
// little fish, the bright underside of the surface, light shafts slanting
// down and caustics dancing on the ground. Bubbles rise all the time.
function buildUnderwater(snap, group, y, surfaceY) {
  const floorY = y - 6;
  const sand = new THREE.Mesh(
    new THREE.PlaneGeometry(80, 60, 16, 12),
    ps1Material(snap, { map: speckle('#4f7f70', 0.22) })
  );
  sand.material.map.repeat.set(20, 15);
  sand.rotation.x = -Math.PI / 2;
  sand.position.set(0, floorY, -26);
  group.add(sand);

  const rock = ps1Material(snap, { map: speckle('#2a4a48', 0.3) });
  const boulder = new THREE.DodecahedronGeometry(1, 0);
  for (let i = 0; i < 16; i++) {
    const stone = new THREE.Mesh(boulder, rock);
    stone.scale.set(rand(0.8, 2.4), rand(0.6, 1.8), rand(0.8, 2.4));
    stone.position.set(rand(-12, 12), floorY + 0.3, rand(-30, -4));
    group.add(stone);
  }
  // Walls rising to the surface on both sides, and pillars in between.
  for (let i = 0; i < 12; i++) {
    const wall = new THREE.Mesh(boulder, rock);
    wall.scale.set(rand(2.5, 4), rand(4, 7), rand(2.5, 4));
    wall.position.set((i % 2 ? 1 : -1) * rand(9, 13), floorY + rand(2, 6), rand(-32, -2));
    group.add(wall);
  }
  const back = new THREE.Mesh(new THREE.BoxGeometry(60, surfaceY - floorY + 2, 2, 6, 2, 1), rock);
  back.position.set(0, (surfaceY + floorY) / 2, -34);
  group.add(back);
  for (let i = 0; i < 5; i++) {
    const height = rand(6, 11);
    const pillar = new THREE.Mesh(new THREE.ConeGeometry(rand(0.8, 1.4), height, 6), rock);
    pillar.position.set(rand(-8, 8), floorY + height / 2, rand(-30, -14));
    group.add(pillar);
  }

  // Glowing weed: tall thin blades that sway.
  const weedMaterial = ps1Material(snap, { color: '#3ff0c0', unlit: true });
  const blade = new THREE.ConeGeometry(0.08, 1, 3);
  blade.translate(0, 0.5, 0);
  const weeds = [];
  for (let i = 0; i < 26; i++) {
    const weed = new THREE.Mesh(blade, weedMaterial);
    weed.scale.set(1, rand(1.2, 3.2), 1);
    weed.position.set(rand(-11, 11), floorY, rand(-26, -3));
    weed.userData.phase = rand(0, Math.PI * 2);
    group.add(weed);
    weeds.push(weed);
  }

  // Small fish swimming in loose circles.
  const fishMaterial = ps1Material(snap, { color: '#bfe6e2' });
  const body = new THREE.ConeGeometry(0.16, 0.6, 4);
  body.rotateZ(-Math.PI / 2);
  const tail = new THREE.ConeGeometry(0.14, 0.24, 3);
  tail.rotateZ(Math.PI / 2);
  tail.translate(-0.38, 0, 0);
  const fish = [];
  for (let i = 0; i < 14; i++) {
    const one = new THREE.Group();
    one.add(new THREE.Mesh(body, fishMaterial), new THREE.Mesh(tail, fishMaterial));
    one.userData = {
      cx: rand(-5, 5), cy: y + rand(-4, 3), cz: rand(-20, -6),
      radius: rand(1.5, 5), speed: rand(0.3, 0.7) * (Math.random() < 0.5 ? -1 : 1), phase: rand(0, Math.PI * 2),
    };
    group.add(one);
    fish.push(one);
  }

  // The surface seen from below: bright, with caustics drifting across.
  const causticsMap = causticTexture();
  causticsMap.repeat.set(10, 8);
  // Bright through the haze; its far edge hides behind the back wall.
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), new THREE.MeshBasicMaterial({ color: '#2fa6a4', fog: false }));
  surface.rotation.x = Math.PI / 2;
  surface.position.set(0, surfaceY, -26);
  group.add(surface);
  const ripples = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), lightMaterial('#bffcff', 0.4, causticsMap));
  ripples.rotation.x = Math.PI / 2;
  ripples.position.set(0, surfaceY - 0.05, -26);
  group.add(ripples);

  // Caustics on the floor: two layers drifting against each other.
  const floorCaustics = [0, 1].map((i) => {
    const map = causticTexture();
    map.repeat.set(12, 9);
    const layer = new THREE.Mesh(new THREE.PlaneGeometry(80, 60), lightMaterial('#7ef6f0', 0.22, map));
    layer.rotation.x = -Math.PI / 2;
    layer.position.set(0, floorY + 0.04 + i * 0.02, -26);
    group.add(layer);
    return map;
  });

  // Light shafts slanting down from the surface.
  const shafts = [];
  for (let i = 0; i < 6; i++) {
    const shaft = new THREE.Mesh(new THREE.PlaneGeometry(rand(1, 2.6), 14), lightMaterial('#8ff6ff', 0.12));
    shaft.position.set(rand(-9, 9), surfaceY - 6, rand(-22, -6));
    shaft.rotation.set(0, rand(-0.5, 0.5), rand(-0.35, 0.35));
    shaft.userData.phase = rand(0, Math.PI * 2);
    group.add(shaft);
    shafts.push(shaft);
  }

  const bubbles = points(group, 120, '#d8ffff', 2, () => [rand(-10, 10), rand(floorY, surfaceY), rand(-24, -2)]);
  const motes = points(group, 140, '#5fd6c8', 1, () => [rand(-12, 12), rand(floorY, surfaceY), rand(-26, -2)]);

  return { weeds, fish, ripples, causticsMap, floorCaustics, shafts, bubbles, motes, floorY, surfaceY };
}

function points(group, count, color, size, place) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) positions.set(place(), i * 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const cloud = new THREE.Points(geometry, new THREE.PointsMaterial({ size, sizeAttenuation: false, color }));
  group.add(cloud);
  return cloud;
}

export function createJourney(snap, scene, { ambient, key }) {
  // One group per world, shown only around its stretch of the journey: far
  // mountains would otherwise already peek up from below in space. Worlds
  // swap while a passage fade covers the screen.
  const worlds = [0, 1, 2, 3, 4, 5].map(() => {
    const group = new THREE.Group();
    scene.add(group);
    return group;
  });
  const shownFrom = [-1, -1, 0.9, SWAP_TO_CAVE, SWAP_TO_LAKE, SURFACE];
  const shownTo = [SWAP_TO_CAVE, SWAP_TO_CAVE, SWAP_TO_CAVE, SWAP_TO_LAKE, SURFACE, 9];

  // A fixed set of warm/cold point lights, moved to the crystals of whichever
  // cave is shown (a constant number of lights keeps shaders from
  // recompiling when the worlds swap).
  const crystalLights = Array.from({ length: 4 }, () => {
    const light = new THREE.PointLight('#ffb84d', 0, 9, 1.6);
    scene.add(light);
    return light;
  });

  scene.add(crossSection(snap, -26, -32, paintEarth));
  scene.add(crossSection(snap, -38.2, -43.6, paintRock));

  buildStars(worlds[0]);
  const clouds = buildClouds(snap, worlds[1], -BAND);
  buildLand(snap, worlds[2], -2 * BAND);
  const cave = buildCave(snap, worlds[3], -3 * BAND);
  const lake = buildLake(snap, worlds[4], -4 * BAND);
  const deep = buildUnderwater(snap, worlds[5], -5 * BAND, lake.waterY);
  const ripple = lake.water.geometry.attributes.position;
  const rippleBase = Float32Array.from(ripple.array);

  // Sky gradient as a tiny texture, redrawn when the mood changes.
  const skyCanvas = document.createElement('canvas');
  skyCanvas.width = 1;
  skyCanvas.height = 64;
  const sky = new THREE.CanvasTexture(skyCanvas);
  sky.magFilter = THREE.NearestFilter;
  sky.minFilter = THREE.NearestFilter;
  sky.generateMipmaps = false;
  scene.background = sky;
  scene.fog = new THREE.Fog('#000000', 10, 40);

  const a = new THREE.Color();
  const b = new THREE.Color();
  const mix = (from, to, t) => `#${a.set(from).lerp(b.set(to), t).getHexString()}`;
  let lastKey = '';

  function setMood(progress, theme) {
    const moods = MOODS[theme] || MOODS.dark;
    const i = Math.min(moods.length - 2, Math.floor(progress));
    const t = Math.min(1, Math.max(0, progress - i));
    const moodKey = `${theme}:${progress.toFixed(3)}`;
    if (moodKey === lastKey) return;
    lastKey = moodKey;
    const from = moods[i];
    const to = moods[i + 1];

    const g = skyCanvas.getContext('2d');
    const gradient = g.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, mix(from.sky[0], to.sky[0], t));
    gradient.addColorStop(0.55, mix(from.sky[1], to.sky[1], t));
    gradient.addColorStop(1, mix(from.sky[2], to.sky[2], t));
    g.fillStyle = gradient;
    g.fillRect(0, 0, 1, 64);
    sky.needsUpdate = true;

    scene.fog.color.set(mix(from.fog, to.fog, t));
    scene.fog.near = THREE.MathUtils.lerp(from.near, to.near, t);
    scene.fog.far = THREE.MathUtils.lerp(from.far, to.far, t);
    ambient.color.set(mix(from.ambient, to.ambient, t));
    key.color.set(mix(from.sun, to.sun, t));
  }

  // progress: scroll position as a fractional section index (0 = space).
  function update(progress, t, dt, theme) {
    setMood(progress, theme);
    worlds.forEach((group, i) => {
      group.visible = progress > shownFrom[i] && progress < shownTo[i];
    });

    for (const cloud of clouds) {
      cloud.position.x += cloud.userData.speed * dt;
      if (cloud.position.x > 22) cloud.position.x = -22;
    }

    if (worlds[3].visible) animateCave(t, dt);
    if (worlds[4].visible) animateLake(t, dt);
    if (worlds[5].visible) animateUnderwater(t, dt);
    placeLights(t);
  }

  // Crystal lights: on the four front crystals of the cave or the lake
  // (glowSpots run front to back), flickering a little.
  function placeLights(t) {
    const spots = worlds[3].visible ? cave.glowSpots : worlds[4].visible ? lake.glowSpots : [];
    const color = worlds[3].visible ? '#ffb84d' : '#6ff0ff';
    crystalLights.forEach((light, i) => {
      const spot = spots[i];
      light.intensity = spot ? 7 + Math.sin(t * 2.3 + i * 1.7) * 1.2 : 0;
      if (spot) {
        light.position.copy(spot);
        light.color.set(color);
      }
    });
  }

  function animateCave(t, dt) {
    drift(cave.dust, (p, i) => {
      p.setX(i, p.getX(i) + Math.sin(t * 0.4 + i) * dt * 0.08);
      p.setY(i, p.getY(i) + Math.cos(t * 0.3 + i) * dt * 0.05);
    });
    drift(cave.drops, (p, i) => {
      const y = p.getY(i) - dt * 5;
      p.setY(i, y < cave.floorY ? cave.top - Math.random() : y);
    });
  }

  function drift(cloud, step) {
    const position = cloud.geometry.attributes.position;
    for (let i = 0; i < position.count; i++) step(position, i);
    position.needsUpdate = true;
  }

  function animateLake(t, dt) {
    for (let i = 0; i < ripple.count; i++) {
      const x = rippleBase[i * 3];
      const y = rippleBase[i * 3 + 1];
      ripple.setZ(i, Math.sin(x * 0.5 + t * 1.3) * 0.08 + Math.cos(y * 0.7 + t) * 0.06);
    }
    ripple.needsUpdate = true;

    lake.fallTexture.offset.y += dt * 1.6;
    for (const beam of lake.beams) {
      beam.material.opacity = 0.06 + Math.sin(t * 0.9 + beam.userData.phase) * 0.025;
    }
    drift(lake.specks, (p, i) => {
      const x = p.getX(i) + dt * (0.15 + (i % 5) * 0.05);
      p.setX(i, x > 12 ? -12 : x);
    });
    const top = lake.waterY + 9;
    drift(lake.mist, (p, i) => {
      const y = p.getY(i) + dt * 0.25;
      p.setY(i, y > top ? lake.waterY : y);
    });
  }

  function animateUnderwater(t, dt) {
    for (const weed of deep.weeds) {
      weed.rotation.z = Math.sin(t * 1.2 + weed.userData.phase) * 0.25;
      weed.rotation.x = Math.cos(t * 0.9 + weed.userData.phase) * 0.12;
    }
    for (const one of deep.fish) {
      const d = one.userData;
      const angle = d.phase + t * d.speed;
      one.position.set(d.cx + Math.cos(angle) * d.radius, d.cy + Math.sin(t + d.phase) * 0.3, d.cz + Math.sin(angle) * d.radius);
      // Face the direction of travel.
      one.rotation.y = -angle + (d.speed > 0 ? -Math.PI / 2 : Math.PI / 2);
    }
    deep.causticsMap.offset.set(t * 0.02, t * 0.015);
    deep.floorCaustics[0].offset.set(t * 0.03, -t * 0.02);
    deep.floorCaustics[1].offset.set(-t * 0.025, t * 0.03);
    for (const shaft of deep.shafts) {
      shaft.material.opacity = 0.08 + Math.sin(t * 0.8 + shaft.userData.phase) * 0.05;
    }
    drift(deep.bubbles, (p, i) => {
      const y = p.getY(i) + dt * (0.8 + (i % 5) * 0.3);
      p.setY(i, y > deep.surfaceY ? deep.floorY : y);
      p.setX(i, p.getX(i) + Math.sin(t * 3 + i) * dt * 0.2);
    });
    drift(deep.motes, (p, i) => {
      const x = p.getX(i) + dt * 0.12 * ((i % 3) - 1);
      p.setX(i, x > 12 ? -12 : x < -12 ? 12 : x);
    });
  }

  // How much the picture wobbles like seen through water (0…1): from the
  // moment the camera dips under the lake's surface.
  function underwater(progress) {
    if (progress <= DIVE.in) return 0;
    return Math.min(1, (progress - DIVE.in) / (DIVE.full - DIVE.in));
  }

  return { update, underwater };
}
