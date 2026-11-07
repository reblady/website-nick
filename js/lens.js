// Lens refraction for the glass, like Apple's Liquid Glass: the middle stays
// clear and the scene behind bends towards the edges, with a slight colour
// fringe. Each .glass element gets its own SVG filter whose displacement map
// matches its size. The map is built from 4px blocks, so the bending steps
// like low-res pixels. Only works as a backdrop-filter in Chromium.

const NS = 'http://www.w3.org/2000/svg';
const BLOCK = 4;
const BACKDROP = 'blur(2px) saturate(160%) brightness(1.04)';

// Displacement map: red = horizontal, green = vertical offset, 128 = none.
// Near an edge the sample is pulled inwards, strongest right at the rim.
function lensMap(width, height, bezel) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const g = canvas.getContext('2d');
  const falloff = (d) => (d < bezel ? (1 - d / bezel) ** 2 : 0);
  for (let y = 0; y < height; y += BLOCK) {
    for (let x = 0; x < width; x += BLOCK) {
      const cx = x + BLOCK / 2;
      const cy = y + BLOCK / 2;
      const ox = falloff(cx) - falloff(width - cx);
      const oy = falloff(cy) - falloff(height - cy);
      g.fillStyle = `rgb(${Math.round(128 + ox * 127)}, ${Math.round(128 + oy * 127)}, 128)`;
      g.fillRect(x, y, BLOCK, BLOCK);
    }
  }
  return canvas.toDataURL();
}

function element(name, attrs) {
  const el = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) el.setAttribute(key, value);
  return el;
}

// One displacement per colour channel, each a little weaker than the last,
// screened back together: the edges get a faint rainbow fringe.
function buildFilter(id, width, height) {
  const bezel = Math.max(10, Math.min(28, Math.min(width, height) * 0.2));
  const scale = bezel * 1.3;
  const filter = element('filter', {
    id,
    x: '0',
    y: '0',
    width: '100%',
    height: '100%',
    'color-interpolation-filters': 'sRGB',
  });
  filter.append(element('feImage', {
    href: lensMap(width, height, bezel),
    x: '0',
    y: '0',
    width: String(width),
    height: String(height),
    preserveAspectRatio: 'none',
    result: 'map',
  }));
  const channels = [
    ['1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0', 1],
    ['0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0', 0.92],
    ['0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0', 0.84],
  ];
  channels.forEach(([matrix, strength], i) => {
    filter.append(element('feDisplacementMap', {
      in: 'SourceGraphic',
      in2: 'map',
      scale: String(scale * strength),
      xChannelSelector: 'R',
      yChannelSelector: 'G',
      result: `shift${i}`,
    }));
    filter.append(element('feColorMatrix', { in: `shift${i}`, type: 'matrix', values: matrix, result: `channel${i}` }));
  });
  filter.append(element('feBlend', { in: 'channel0', in2: 'channel1', mode: 'screen', result: 'rg' }));
  filter.append(element('feBlend', { in: 'rg', in2: 'channel2', mode: 'screen' }));
  return filter;
}

export function initLens() {
  const defs = document.getElementById('lensDefs');
  const sizes = new Map();

  function update(el, index) {
    const width = el.offsetWidth;
    const height = el.offsetHeight;
    if (!width || !height) return;
    const key = `${width}x${height}`;
    if (sizes.get(el) === key) return;
    sizes.set(el, key);
    const id = `lens-${index}`;
    document.getElementById(id)?.remove();
    defs.append(buildFilter(id, width, height));
    el.style.backdropFilter = `url(#${id}) ${BACKDROP}`;
  }

  const glass = [...document.querySelectorAll('.glass')];
  const observer = new ResizeObserver(() => glass.forEach(update));
  glass.forEach((el, i) => {
    update(el, i);
    observer.observe(el);
  });
}
