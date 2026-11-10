// Generate the game maps as Tiled JSON (they open and edit in Tiled 1.10+).
// Run from the repo root:  node scripts/maps/build-maps.mjs
// Output: public/assets/maps/*.json
//
// Object types used by the game (layer "objects"):
//   spawn      point  name = spawn id
//   exit       rect   target (map), spawn (spawn id in target), requiresPack (optional)
//   sprite     point  key (texture), footW/footH (collision at the sprite's base), lamp (bool)
//   collision  rect   blocked area
//   light      point  kind = window | lamp
//   overlay    point  key (texture shown only at night, top-left anchored)
//   interact   rect   action = sleep | journal
//   gate       rect   minStage (fog zone, opens at that revival stage)
//   mentor     point  where the mentor stands (stage 7)
//   garden     rect   tiles that can be tilled with the hoe
//   building   rect   plot for a discipline building (pack); the building grows with labs
//   shop       rect   the shop stall (click to open the shop)
//   mailbox    point  the mailbox by the house (click to read mentor letters)
//   visit      point  where visiting mentors stand on a deadline day
import { mkdirSync, writeFileSync } from 'node:fs';

const T = 16;
const OUT = 'public/assets/maps';
mkdirSync(OUT, { recursive: true });

// ----------------------------------------------------------------- helpers

function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const prop = (name, value) => ({
  name,
  type: typeof value === 'boolean' ? 'bool' : typeof value === 'number' ? (Number.isInteger(value) ? 'int' : 'float') : 'string',
  value,
});

function tileset({ firstgid, name, image, w, h, columns, tilecount, spacing = 0, collides = [] }) {
  return {
    firstgid,
    name,
    image,
    imagewidth: w,
    imageheight: h,
    tilewidth: T,
    tileheight: T,
    columns,
    tilecount,
    margin: 0,
    spacing,
    tiles: collides.map((id) => ({ id, properties: [prop('collides', true)] })),
  };
}

class MapBuilder {
  constructor(width, height, props) {
    this.width = width;
    this.height = height;
    this.props = props;
    this.tilesets = [];
    this.layers = [];
    this.objects = [];
    this.nextId = 1;
  }
  layer(name) {
    const data = new Array(this.width * this.height).fill(0);
    const layer = { name, data };
    this.layers.push(layer);
    return {
      set: (x, y, gid) => {
        if (x >= 0 && y >= 0 && x < this.width && y < this.height) data[y * this.width + x] = gid;
      },
      get: (x, y) => data[y * this.width + x],
      fill: (gid) => data.fill(gid),
    };
  }
  obj(type, name, x, y, w = 0, h = 0, props = {}) {
    const o = { id: this.nextId++, name, type, x, y, width: w, height: h, rotation: 0, visible: true };
    if (!w && !h) o.point = true;
    o.properties = Object.entries(props).map(([k, v]) => prop(k, v));
    this.objects.push(o);
    return o;
  }
  toJSON() {
    let id = 1;
    const layers = this.layers.map((l) => ({
      id: id++,
      name: l.name,
      type: 'tilelayer',
      x: 0,
      y: 0,
      width: this.width,
      height: this.height,
      opacity: 1,
      visible: true,
      data: l.data,
    }));
    layers.push({ id: id++, name: 'objects', type: 'objectgroup', draworder: 'topdown', x: 0, y: 0, opacity: 1, visible: true, objects: this.objects });
    return {
      type: 'map',
      version: '1.10',
      tiledversion: '1.10.2',
      orientation: 'orthogonal',
      renderorder: 'right-down',
      infinite: false,
      width: this.width,
      height: this.height,
      tilewidth: T,
      tileheight: T,
      nextlayerid: id,
      nextobjectid: this.nextId,
      properties: Object.entries(this.props).map(([k, v]) => prop(k, v)),
      tilesets: this.tilesets,
      layers,
    };
  }
}

function save(name, map) {
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify(map.toJSON()));
  console.log(`  ${name}.json  ${map.width}×${map.height}`);
}

// Where each location's entrance is, and where it attaches to the homestead.
// walkableSpecial: the biome's special surface — flower meadow and star floor can be
// walked on; ice, water and lava cannot.
const LOCATIONS = {
  forest: { entrance: 'S', seed: 11, walkableSpecial: true },
  tower: { entrance: 'W', seed: 23, walkableSpecial: false },
  market: { entrance: 'W', seed: 37, walkableSpecial: false },
  forge: { entrance: 'E', seed: 41, walkableSpecial: false },
  library: { entrance: 'N', seed: 53, walkableSpecial: true },
};

// ----------------------------------------------------------------- homestead

function homestead() {
  const W = 40;
  const H = 30;
  const m = new MapBuilder(W, H, { title: 'Садиба', kind: 'homestead' });
  m.tilesets.push(tileset({ firstgid: 1, name: 'homestead', image: '../../../images/biomes/homestead-tiles-16.png', w: 48, h: 16, columns: 3, tilecount: 3 }));
  // Kenney Tiny Town (temporary) for the garden fence. Fence pieces block walking.
  const FENCE = { tl: 44, tr: 46, bl: 80, br: 82, h: 81, left: 56, right: 58 };
  const TOWN = 4;
  m.tilesets.push(
    tileset({ firstgid: TOWN, name: 'town', image: '../_temp/kenney-tiny-town/tilemap.png', w: 192, h: 176, columns: 12, tilecount: 132, collides: Object.values(FENCE) }),
  );
  const GRASS = 1;
  const FLOWERS = 2;
  const PATH = 3;
  const ground = m.layer('ground');
  const r = rng(7);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground.set(x, y, r() < 0.06 ? FLOWERS : GRASS);

  // Paths: main east–west road, north–south road, a branch to the tower (north-east), and the house path.
  for (let x = 0; x < W; x++) for (const y of [14, 15]) ground.set(x, y, PATH);
  for (let y = 0; y < H; y++) for (const x of [24, 25]) ground.set(x, y, PATH);
  for (let x = 24; x < W; x++) for (const y of [6, 7]) ground.set(x, y, PATH);
  for (let y = 11; y < 14; y++) ground.set(9, y, PATH);

  // House (sprite 90×118, origin bottom-left at x=99, y=176).
  const hx = 99;
  const hy = 176;
  m.obj('sprite', 'house', hx, hy, 0, 0, { key: 'homestead-house', originX: 0, originY: 1 });
  m.obj('collision', 'house-footprint', hx + 4, hy - 40, 82, 40);
  m.obj('exit', 'house-door', hx + 52, hy - 6, 14, 10, { target: 'house', spawn: 'door' });
  m.obj('spawn', 'door', hx + 59, hy + 14);
  m.obj('spawn', 'default', hx + 59, hy + 14);
  // Night: the window glows (overlay cut from the night art) and casts warm light.
  m.obj('overlay', 'window-lit', hx + 18, hy - 118 + 80, 0, 0, { key: 'homestead-window-lit' });
  m.obj('light', 'window', hx + 27.5, hy - 118 + 90, 0, 0, { kind: 'window' });

  m.obj('sprite', 'lamp', hx + 100, hy + 4, 0, 0, { key: 'lamp-post', footW: 6, footH: 4, lamp: true });
  // Mailbox left of the door path; visiting mentors gather right of the lamp.
  m.obj('mailbox', 'mailbox', hx + 34, hy + 12);
  [[216, 196], [236, 196], [256, 196], [226, 216], [246, 216]].forEach(([x, y], i) => m.obj('visit', `visit-${i}`, x, y));
  // Trees on the edges, away from the garden and the building plots.
  const trees = [
    ['tree-blossom-a', 216, 112],
    ['tree-blossom-b', 44, 120],
    ['tree-blossom-a', 330, 64],
    ['tree-blossom-b', 600, 40],
    ['tree-blossom-a', 360, 200],
    ['tree-blossom-b', 30, 470],
    ['tree-blossom-a', 360, 476],
    ['tree-blossom-b', 620, 476],
  ];
  trees.forEach(([key, x, y], i) => m.obj('sprite', `tree-${i}`, x, y, 0, 0, { key, footW: 10, footH: 6 }));

  // Garden east of the north road, between the tower branch and the main road.
  for (let y = 9; y <= 12; y++) for (let x = 27; x <= 37; x++) ground.set(x, y, GRASS);
  m.obj('garden', 'garden', 27 * T, 9 * T, 11 * T, 4 * T);
  // A fence one tile around the garden shows its borders; gates face the road and the path.
  const decor = m.layer('decor');
  const [fx0, fy0, fx1, fy1] = [26, 8, 38, 13];
  const gates = new Set(['31,13', '32,13', '26,10', '26,11']);
  const fence = (x, y, id) => !gates.has(`${x},${y}`) && decor.set(x, y, TOWN + id);
  for (let x = fx0 + 1; x < fx1; x++) {
    fence(x, fy0, FENCE.h);
    fence(x, fy1, FENCE.h);
  }
  for (let y = fy0 + 1; y < fy1; y++) {
    fence(fx0, y, FENCE.left);
    fence(fx1, y, FENCE.right);
  }
  fence(fx0, fy0, FENCE.tl);
  fence(fx1, fy0, FENCE.tr);
  fence(fx0, fy1, FENCE.bl);
  fence(fx1, fy1, FENCE.br);

  // Five plots for the discipline buildings, south of the main road (5×5 tiles each).
  const plots = [
    ['forest', 2],
    ['tower', 8],
    ['market', 14],
    ['forge', 27],
    ['library', 33],
  ];
  for (const [pack, x] of plots) {
    m.obj('building', `building-${pack}`, x * T, 18 * T, 5 * T, 5 * T, { pack });
    for (let yy = 23; yy < 24; yy++) for (let xx = x + 1; xx < x + 4; xx++) ground.set(xx, yy, PATH);
  }

  // Trading stall above the main road (sprite 56×57, images/buildings/shop-stall-new.jpg),
  // left of the blossom tree at x=360. The counter is the click area and the blocker.
  const sx = 312;
  const sy = 13 * T;
  m.obj('shop', 'shop', sx - 24, sy - 40, 48, 40);
  m.obj('sprite', 'shop-stall', sx, sy, 0, 0, { key: 'shop-stall', footW: 48, footH: 10 });

  // Exits to the five locations and the spawn points for coming back.
  m.obj('exit', 'to-forest', 24 * T, 0, 2 * T, 6, { target: 'forest', spawn: 'from-homestead', requiresPack: 'forest' });
  m.obj('exit', 'to-library', 24 * T, H * T - 6, 2 * T, 6, { target: 'library', spawn: 'from-homestead', requiresPack: 'library' });
  m.obj('exit', 'to-forge', 0, 14 * T, 6, 2 * T, { target: 'forge', spawn: 'from-homestead', requiresPack: 'forge' });
  m.obj('exit', 'to-market', W * T - 6, 14 * T, 6, 2 * T, { target: 'market', spawn: 'from-homestead', requiresPack: 'market' });
  m.obj('exit', 'to-tower', W * T - 6, 6 * T, 6, 2 * T, { target: 'tower', spawn: 'from-homestead', requiresPack: 'tower' });
  m.obj('spawn', 'from-forest', 25 * T, 2 * T);
  m.obj('spawn', 'from-library', 25 * T, (H - 1) * T);
  m.obj('spawn', 'from-forge', 2 * T, 15 * T + 8);
  m.obj('spawn', 'from-market', (W - 2) * T, 15 * T + 8);
  m.obj('spawn', 'from-tower', (W - 2) * T, 7 * T + 8);
  save('homestead', m);
}

// ----------------------------------------------------------------- house interior

function house() {
  const W = 12;
  const H = 9;
  const m = new MapBuilder(W, H, { title: 'Дім', kind: 'interior' });
  // interior/interior-tiles.png (scripts/assets/build_interior.py), 8 columns:
  // 0–15 floor 4×4 patch, 16–19 / 20–23 log wall (top / baseboard), 24–27 window 2×2, 28–31 herb shelf 2×2.
  const WALL = Array.from({ length: 16 }, (_, i) => 16 + i);
  m.tilesets.push(
    tileset({ firstgid: 1, name: 'house', image: '../interior/interior-tiles.png', w: 128, h: 64, columns: 8, tilecount: 32, collides: WALL }),
  );
  const g = (i) => i + 1;
  const ground = m.layer('ground');
  m.layer('decor');
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) ground.set(x, y, g((y % 4) * 4 + (x % 4)));
  // Back wall, 2 tiles tall: log wall with two windows and a herb shelf above the bed.
  for (let x = 0; x < W; x++) {
    ground.set(x, 0, g(16 + (x % 4)));
    ground.set(x, 1, g(20 + (x % 4)));
  }
  const panel = (x, base) => {
    ground.set(x, 0, g(base));
    ground.set(x + 1, 0, g(base + 1));
    ground.set(x, 1, g(base + 2));
    ground.set(x + 1, 1, g(base + 3));
  };
  panel(2, 24);
  panel(8, 24);
  panel(0, 28);
  // Furniture: sprites standing on their base (x = center, y = bottom), with a footprint that blocks.
  const thing = (name, x, y, footW, footH, extra = {}) =>
    m.obj('sprite', name, x, y, 0, 0, { key: `interior-${name}`, footW, footH, ...extra });
  thing('bed', 24, 64, 22, 30);
  thing('fireplace', 96, 48, 26, 12);
  thing('clock', 120, 30, 0, 0); // hangs on the wall
  thing('desk', 148, 64, 26, 12);
  thing('bookshelf', 179, 48, 24, 14);
  thing('fern', 72, 48, 12, 6);
  thing('rug', 96, 96, 0, 0, { flat: true });
  thing('doormat', 96, 144, 0, 0, { flat: true });
  thing('table', 144, 120, 30, 8);
  thing('lamp', 56, 128, 8, 6);
  thing('chest', 24, 128, 14, 10);
  thing('palm', 184, 128, 12, 6);
  m.obj('interact', 'bed', 12, 32, 24, 32, { action: 'sleep' });
  m.obj('interact', 'journal', 134, 34, 28, 30, { action: 'journal' });
  m.obj('exit', 'door', 5 * T, H * T - 6, 2 * T, 6, { target: 'homestead', spawn: 'door' });
  m.obj('spawn', 'door', 6 * T, (H - 1) * T - 2);
  m.obj('spawn', 'bed', 2 * T + 14, 4 * T + 6);
  m.obj('spawn', 'default', 2 * T + 14, 4 * T + 6);
  // Warm lights at night: the candle on the desk, the fire and the standing lamp.
  m.obj('light', 'candle', 158, 40, 0, 0, { kind: 'lamp' });
  m.obj('light', 'fire', 96, 40, 0, 0, { kind: 'lamp' });
  m.obj('light', 'lamp', 56, 110, 0, 0, { kind: 'lamp' });
  save('house', m);
}

// ----------------------------------------------------------------- locations

function location(pack, { entrance, seed, walkableSpecial }) {
  const W = 36;
  const H = 24;
  const m = new MapBuilder(W, H, { title: pack, kind: 'location', pack });
  // biome tileset: 0 ground, 1 path, 2 special surface, 3 prop drawn on the ground, 4 the same prop
  // on transparency (for the decor layer). Props always block; the special surface depends on the biome.
  const collides = walkableSpecial ? [3, 4] : [2, 3, 4];
  m.tilesets.push(tileset({ firstgid: 1, name: pack, image: `../../../images/biomes/${pack}-tileset-16.png`, w: 80, h: 16, columns: 5, tilecount: 5, collides }));
  const GROUND = 1;
  const PATH = 2;
  const SPECIAL = 3;
  const PROP = 5; // standalone prop on the decor layer (blocks)
  const ground = m.layer('ground');
  const decor = m.layer('decor');
  ground.fill(GROUND);
  const r = rng(seed);

  // Local axes: d = depth from the entrance, s = across.
  const alongX = entrance === 'E' || entrance === 'W';
  const L = alongX ? W : H; // depth
  const S = alongX ? H : W; // width across
  const toXY = (d, s) => {
    switch (entrance) {
      case 'S': return [s, H - 1 - d];
      case 'N': return [s, d];
      case 'W': return [d, s];
      case 'E': return [W - 1 - d, s];
    }
  };
  const mid = Math.floor(S / 2);
  const pathS = (d) => Math.round(mid + Math.sin(d / 4 + seed) * (S / 6));
  const onPath = new Set();
  for (let d = 0; d < L; d++) {
    const c = pathS(d);
    for (let k = -1; k <= 0; k++) {
      const [x, y] = toXY(d, c + k);
      ground.set(x, y, PATH);
      onPath.add(`${x},${y}`);
    }
  }
  // A clearing for the mentor in the first zone.
  const plazaD = Math.floor(L * 0.25);
  const plazaS = pathS(plazaD);
  const near = new Set();
  for (let dd = -2; dd <= 2; dd++) {
    for (let ss = -3; ss <= 3; ss++) {
      const [x, y] = toXY(plazaD + dd, plazaS + ss);
      ground.set(x, y, PATH);
      near.add(`${x},${y}`);
    }
  }
  const free = (x, y) => !onPath.has(`${x},${y}`) && !near.has(`${x},${y}`);

  // Special surface blobs (water, ice, lava, star floor) away from the path.
  for (let b = 0; b < 4; b++) {
    const d0 = Math.floor(L * (0.15 + 0.22 * b));
    const side = b % 2 ? 1 : -1;
    const s0 = mid + side * Math.floor(S / 3);
    const rad = 2 + Math.floor(r() * 2);
    for (let dd = -rad; dd <= rad; dd++) {
      for (let ss = -rad; ss <= rad; ss++) {
        if (dd * dd + ss * ss > rad * rad + r() * 2) continue;
        const [x, y] = toXY(d0 + dd, s0 + ss);
        if (x < 1 || y < 1 || x >= W - 1 || y >= H - 1 || !free(x, y)) continue;
        ground.set(x, y, SPECIAL);
      }
    }
  }
  // Props (trees, crystals, crates, anvils, books) scattered off the path; they block.
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!free(x, y) || ground.get(x, y) !== GROUND) continue;
      if (r() < 0.08) decor.set(x, y, PROP);
    }
  }
  // Keep the entrance area clear.
  for (let d = 0; d < 3; d++) for (let s = 0; s < S; s++) {
    const [x, y] = toXY(d, s);
    decor.set(x, y, 0);
  }

  // Exit back home and the arrival spawn.
  const entryS = pathS(0);
  const rectAcross = (d0, d1, s0, s1) => {
    const [ax, ay] = toXY(d0, s0);
    const [bx, by] = toXY(d1, s1);
    const x0 = Math.min(ax, bx);
    const y0 = Math.min(ay, by);
    return [x0 * T, y0 * T, (Math.abs(bx - ax) + 1) * T, (Math.abs(by - ay) + 1) * T];
  };
  {
    const [x, y, w, h] = rectAcross(0, 0, entryS - 2, entryS + 1);
    // Thin strip on the outer edge of the entrance tile row.
    const strip = { S: [x, y + h - 6, w, 6], N: [x, y, w, 6], W: [x, y, 6, h], E: [x + w - 6, y, 6, h] }[entrance];
    m.obj('exit', 'to-homestead', ...strip, { target: 'homestead', spawn: `from-${pack}` });
    const [sx, sy] = toXY(2, entryS);
    m.obj('spawn', 'from-homestead', sx * T + 8, sy * T + 12);
    m.obj('spawn', 'default', sx * T + 8, sy * T + 12);
  }
  {
    const [x, y] = toXY(plazaD, plazaS);
    m.obj('mentor', 'mentor', x * T + 8, y * T + 12);
  }
  // Fog zones: the middle opens at revival stage 3, the far one at stage 5.
  {
    const b1 = Math.floor(L * 0.45);
    const b2 = Math.floor(L * 0.72);
    m.obj('gate', 'zone-2', ...rectAcross(b1, b2 - 1, 0, S - 1), { minStage: 3 });
    m.obj('gate', 'zone-3', ...rectAcross(b2, L - 1, 0, S - 1), { minStage: 5 });
  }
  save(pack, m);
}

console.log('maps');
homestead();
house();
for (const [pack, cfg] of Object.entries(LOCATIONS)) location(pack, cfg);
