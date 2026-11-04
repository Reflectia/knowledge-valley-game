import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';

import { getPack } from '@/core/content';
import { addItem, cropFrame, decorAt, harvest, isRipe, pickUpDecor, placeDecor, plant, till, water } from '@/core/homestead';
import { getItem, ITEMS } from '@/core/items';
import { ambientAt, darkness } from '@/core/time';
import i18n from '@/i18n';
import type { GameState } from '@/state/store';
import { showToast } from '@/ui/components/Toasts';

import { ensureHeroine, heroineAnim, type Facing } from '../assets/heroine';
import { TEMP_FRAMES, TILESET_TEXTURES, type MapId } from '../assets/manifest';
import { LIGHT, LIGHT_RADIUS, type Light } from '../lighting/lightmap';
import { NightLayer, createGlowOverlay } from '../lighting/NightLayer';
import { revivalMatrix } from '../lighting/revival';
import { buildingTiles, PACK_STYLE, wallRows } from '../world/buildings';

/** Lantern glass color in lamp-post.png (set by scripts/assets/build_sprites.py). */
const LAMP_GLASS_RGB: [number, number, number] = [58, 66, 78];
/** Walking speed in source pixels per second. */
const SPEED = 64;
/** How close the heroine must be to click-interact with something (px). */
const REACH = 30;
/** Depth bands: tiles < soil < y-sorted objects (fog sorts by its bottom edge) < night < lit overlays. */
const DEPTH = { decor: 1, soil: 2, cursor: 1_999_999, night: 2_000_000, lit: 2_000_001 } as const;
const T = 16;
/** Chance that chopping or mining in a location also yields the location's resource. */
const PACK_RESOURCE_CHANCE = 0.25;

/** Tiles gathered today (props come back the next day): "map:x,y". Session only. */
const gathered = { day: -1, keys: new Set<string>() };

interface SceneData {
  map: MapId;
  spawn: string;
}

type TiledObject = Phaser.Types.Tilemaps.TiledObject;

function props(o: TiledObject): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {};
  for (const p of (o.properties as { name: string; value: string | number | boolean }[] | undefined) ?? []) out[p.name] = p.value;
  return out;
}

/**
 * The world: one Tiled map at a time (homestead, house, five locations).
 * Map objects drive everything: spawns, exits, collisions, lights, fog gates,
 * interactions. See scripts/maps/build-maps.mjs for the object types.
 */
export class WorldScene extends Phaser.Scene {
  private store!: StoreApi<GameState>;
  private mapId!: MapId;
  private map!: Phaser.Tilemaps.Tilemap;
  private heroine!: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  private heroineKey = '';
  private facing: Facing = 'down';
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private blockers!: Phaser.Physics.Arcade.StaticGroup;
  private gates: { rect: Phaser.Geom.Rectangle; minStage: number; body?: Phaser.GameObjects.Zone; fog?: Phaser.GameObjects.TileSprite }[] = [];
  private interacts: { rect: Phaser.Geom.Rectangle; action: string }[] = [];
  private gardens: Phaser.Geom.Rectangle[] = [];
  private plots: { rect: Phaser.Geom.Rectangle; pack: string; objects: Phaser.GameObjects.GameObject[] }[] = [];
  private soilSprites: Phaser.GameObjects.GameObject[] = [];
  private decorSprites: Phaser.GameObjects.GameObject[] = [];
  private decorBlockers!: Phaser.Physics.Arcade.StaticGroup;
  private layers: Phaser.Tilemaps.TilemapLayer[] = [];
  private cursorBox!: Phaser.GameObjects.Rectangle;
  private night!: NightLayer;
  private lightSources: Light[] = [];
  private nightOverlays: Phaser.GameObjects.Image[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private lastAmbient = -1;
  private lastLightPaint = 0;
  private revivalFx: Phaser.FX.ColorMatrix | null = null;
  private leaving = false;
  private lastNotice = 0;
  private lastInset = 0;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super('world');
  }

  create(data: SceneData): void {
    this.store = this.registry.get('store') as StoreApi<GameState>;
    this.mapId = data.map;
    this.leaving = false;
    this.facing = 'down';
    this.gates = [];
    this.interacts = [];
    this.gardens = [];
    this.plots = [];
    this.soilSprites = [];
    this.decorSprites = [];
    this.lightSources = [];
    this.nightOverlays = [];
    this.fireflies = [];
    this.lastAmbient = -1;
    this.lastLightPaint = -Infinity; // paint the new map's light layer on the first frame
    this.revivalFx = null;

    this.map = this.make.tilemap({ key: `map-${data.map}` });
    const tilesets = this.map.tilesets.map((ts) => this.map.addTilesetImage(ts.name, TILESET_TEXTURES[ts.name])!);
    const layers: Phaser.Tilemaps.TilemapLayer[] = [];
    for (const name of ['ground', 'decor']) {
      if (!this.map.getLayer(name)) continue;
      const layer = this.map.createLayer(name, tilesets)!;
      layer.setDepth(name === 'decor' ? DEPTH.decor : 0);
      layer.setCollisionByProperty({ collides: true });
      layers.push(layer);
    }
    this.layers = layers;
    const W = this.map.widthInPixels;
    const H = this.map.heightInPixels;
    this.physics.world.setBounds(0, 0, W, H);
    this.blockers = this.physics.add.staticGroup();
    this.decorBlockers = this.physics.add.staticGroup();

    const objects = this.map.getObjectLayer('objects')?.objects ?? [];
    const spawns = new Map<string, { x: number; y: number }>();
    const exits: { rect: Phaser.Geom.Rectangle; target: MapId; spawn: string; requiresPack?: string }[] = [];

    for (const o of objects) {
      const p = props(o);
      const x = o.x ?? 0;
      const y = o.y ?? 0;
      const w = o.width ?? 0;
      const h = o.height ?? 0;
      switch (o.type) {
        case 'spawn':
          spawns.set(o.name, { x, y });
          break;
        case 'exit':
          exits.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), target: p.target as MapId, spawn: String(p.spawn), requiresPack: p.requiresPack as string | undefined });
          break;
        case 'collision':
          this.addBlocker(x, y, w, h);
          break;
        case 'sprite':
          this.addSprite(String(p.key), x, y, p);
          break;
        case 'overlay':
          this.nightOverlays.push(this.add.image(x, y, String(p.key)).setOrigin(0).setDepth(DEPTH.lit));
          break;
        case 'light':
          this.lightSources.push({
            x,
            y,
            radius: p.kind === 'window' ? LIGHT_RADIUS.window : LIGHT_RADIUS.lamp,
            color: p.kind === 'window' ? LIGHT.window : LIGHT.warm,
          });
          break;
        case 'interact':
          this.interacts.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), action: String(p.action) });
          break;
        case 'gate':
          this.gates.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), minStage: Number(p.minStage) });
          break;
        case 'garden':
          this.gardens.push(new Phaser.Geom.Rectangle(x, y, w, h));
          break;
        case 'building':
          this.plots.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), pack: String(p.pack), objects: [] });
          break;
        case 'shop':
          this.interacts.push({ rect: new Phaser.Geom.Rectangle(x, y, w, h), action: 'shop' });
          break;
      }
    }

    // Heroine: the body is a small box at her feet, so she can walk "behind" things.
    const spawn = spawns.get(data.spawn) ?? spawns.get('default') ?? { x: W / 2, y: H / 2 };
    this.heroineKey = ensureHeroine(this, this.store.getState().world.state.player.appearance);
    this.heroine = this.physics.add.sprite(spawn.x, spawn.y, this.heroineKey, 0).setOrigin(0.5, 1);
    this.heroine.body.setSize(10, 6).setOffset(3, 26);
    this.heroine.setCollideWorldBounds(true);
    this.heroine.play(heroineAnim(this.heroineKey, this.facing, false).anim);
    for (const layer of layers) this.physics.add.collider(this.heroine, layer);
    this.physics.add.collider(this.heroine, this.blockers, (_h, b) => this.onBump(b as Phaser.GameObjects.GameObject));
    this.physics.add.collider(this.heroine, this.decorBlockers);

    // Exits: walk into them. Locations need their discipline in the plan.
    for (const exit of exits) {
      const zone = this.add.zone(exit.rect.x, exit.rect.y, exit.rect.width, exit.rect.height).setOrigin(0);
      this.physics.add.existing(zone, true);
      this.physics.add.overlap(this.heroine, zone, () => this.tryExit(exit));
    }

    this.buildGates();
    this.applyRevival();
    this.buildNight(W, H);
    this.removeGathered();
    this.renderSoil();
    this.renderDecor();
    this.renderBuildings();
    // Outline of the tile the selected item acts on (honey-300).
    this.cursorBox = this.add.rectangle(0, 0, T, T).setOrigin(0).setStrokeStyle(1, 0xf2c76b).setDepth(DEPTH.cursor).setVisible(false);

    // Camera: integer zoom; small maps (the house) are centered instead of followed.
    const cam = this.cameras.main;
    cam.setZoom(this.registry.get('worldScale') as number);
    cam.setBackgroundColor('#2e1b12');
    this.fitCamera();
    this.scale.on(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
    // The HUD may appear or change size (UI scale, ceiling hint): keep the heroine in the free area.
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.hudInset() !== this.lastInset && this.fitCamera() });
    cam.fadeIn(250, 46, 27, 18);

    this.cursors = this.input.keyboard!.createCursorKeys();
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    this.input.mouse?.disableContextMenu();

    this.announce();

    this.unsubscribe = [
      this.store.subscribe((s, prev) => {
        if (s.world.state.player.appearance !== prev.world.state.player.appearance) this.setAppearance();
        if (s.progress !== prev.progress) {
          this.buildGates();
          this.applyRevival();
          this.renderBuildings();
        }
        if (s.world.state.plots !== prev.world.state.plots) this.renderSoil();
        if (s.world.state.decor !== prev.world.state.decor) this.renderDecor();
        if (s.worldEpoch !== prev.worldEpoch) this.goTo('house', 'bed');
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe.forEach((u) => u());
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    });
  }

  // ------------------------------------------------------------------ building

  private addBlocker(x: number, y: number, w: number, h: number): Phaser.GameObjects.Zone {
    const zone = this.add.zone(x, y, w, h).setOrigin(0);
    this.physics.add.existing(zone, true);
    this.blockers.add(zone);
    return zone;
  }

  private addSprite(key: string, x: number, y: number, p: Record<string, string | number | boolean>): void {
    const ox = p.originX !== undefined ? Number(p.originX) : 0.5;
    const oy = p.originY !== undefined ? Number(p.originY) : 1;
    const img = this.add.image(x, y, key).setOrigin(ox, oy);
    img.setDepth(y); // y-sort by the sprite's base
    if (p.footW && p.footH) {
      const fw = Number(p.footW);
      const fh = Number(p.footH);
      this.addBlocker(x - fw / 2, y - fh, fw, fh);
    }
    if (p.lamp) {
      const glass = createGlowOverlay(this, key, `${key}-lit`, LAMP_GLASS_RGB, LIGHT.warm);
      this.nightOverlays.push(this.add.image(x, y, `${key}-lit`).setOrigin(ox, oy).setDepth(DEPTH.lit));
      const left = x - img.width * ox;
      const top = y - img.height * oy;
      this.lightSources.push({
        x: left + (glass ? glass.x + glass.w / 2 : img.width / 2),
        y: top + (glass ? glass.y + glass.h / 2 : 8),
        radius: LIGHT_RADIUS.lamp,
        color: LIGHT.warm,
      });
    }
  }

  private packOfMap(): string | null {
    const list = (this.map.properties as { name: string; value: unknown }[] | undefined) ?? [];
    const p = list.find((x) => x.name === 'pack');
    return p ? String(p.value) : null;
  }

  /** Revival of a pack's location: the best discipline that uses this pack. */
  private revivalOf(pack: string): { stage: number; progress: number; available: boolean } {
    const s = this.store.getState();
    let best = { stage: 1, progress: 0, available: false };
    for (const d of Object.values(s.labs.curriculum.disciplines)) {
      if (d.pack !== pack) continue;
      const p = s.progress.disciplines[d.key];
      if (p && (!best.available || p.revivalProgress > best.progress)) {
        best = { stage: p.revivalStage, progress: p.revivalProgress, available: true };
      }
    }
    return best;
  }

  /** Fog zones open with revival stages ("нові зони" for labs). */
  private buildGates(): void {
    const pack = this.packOfMap();
    const stage = pack ? this.revivalOf(pack).stage : 5;
    if (!this.textures.exists('fog-dither')) {
      const tex = this.textures.createCanvas('fog-dither', 4, 4)!;
      const ctx = tex.getContext();
      for (let y = 0; y < 4; y++) {
        for (let x = 0; x < 4; x++) {
          ctx.fillStyle = (x + y) % 2 ? 'rgba(255,241,214,0.92)' : 'rgba(233,243,251,0.72)'; // light-morning / tower-light
          ctx.fillRect(x, y, 1, 1);
        }
      }
      tex.refresh();
    }
    for (const g of this.gates) {
      const locked = stage < g.minStage;
      if (locked && !g.body) {
        g.body = this.addBlocker(g.rect.x, g.rect.y, g.rect.width, g.rect.height);
        g.body.setData('gate', g.minStage);
        g.fog = this.add.tileSprite(g.rect.x, g.rect.y, g.rect.width, g.rect.height, 'fog-dither').setOrigin(0).setDepth(g.rect.bottom);
      } else if (!locked && g.body) {
        g.body.destroy();
        g.fog?.destroy();
        g.body = undefined;
        g.fog = undefined;
      }
    }
  }

  private applyRevival(): void {
    const pack = this.packOfMap();
    if (!pack) return;
    const { progress } = this.revivalOf(pack);
    if (!this.revivalFx) this.revivalFx = this.cameras.main.postFX.addColorMatrix();
    this.revivalFx.set(revivalMatrix(progress));
  }

  private buildNight(W: number, H: number): void {
    this.night = new NightLayer(this, W, H, `night-${this.mapId}`).setDepth(DEPTH.night).setVisible(false);
    for (const o of this.nightOverlays) o.setVisible(false);
    // Fireflies outdoors on the homestead and in the forest.
    if (this.mapId === 'homestead' || this.mapId === 'forest') {
      if (!this.textures.exists('firefly')) {
        const tex = this.textures.createCanvas('firefly', 7, 7)!;
        const ctx = tex.getContext();
        ctx.fillStyle = '#e9f77c'; // light-firefly
        ctx.fillRect(3, 3, 1, 1);
        ctx.globalAlpha = 0.5;
        for (const [x, y] of [[3, 1], [1, 3], [5, 3], [3, 5], [2, 2], [4, 4], [2, 4], [4, 2]]) ctx.fillRect(x, y, 1, 1);
        tex.refresh();
      }
      const r = new Phaser.Math.RandomDataGenerator([this.mapId]);
      for (let i = 0; i < 14; i++) {
        const f = this.add
          .image(r.between(16, W - 16), r.between(16, H - 16), 'firefly')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDepth(DEPTH.lit)
          .setVisible(false);
        f.setData('phase', r.frac() * Math.PI * 2);
        f.setData('home', { x: f.x, y: f.y });
        this.fireflies.push(f);
      }
    }
  }

  /** Width of the screen covered by the HUD status panel on the left (screen px). */
  private hudInset(): number {
    const hud = document.querySelector('.hud__status')?.getBoundingClientRect();
    if (!hud) return 0;
    const canvas = this.game.canvas.getBoundingClientRect();
    return Math.max(0, Math.round(hud.right - canvas.left));
  }

  /**
   * Small rooms are centered, large maps followed; either way the heroine sits in
   * the middle of the free part of the screen, right of the HUD panel.
   */
  private fitCamera(): void {
    const cam = this.cameras.main;
    const W = this.map.widthInPixels;
    const H = this.map.heightInPixels;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    const inset = this.hudInset();
    this.lastInset = inset;
    const shift = inset / 2 / cam.zoom;
    cam.stopFollow();
    if (W <= viewW && H <= viewH) {
      const fits = cam.width - inset >= W * cam.zoom;
      cam.removeBounds();
      cam.centerOn(W / 2 - (fits ? shift : 0), H / 2);
    } else {
      cam.setBounds(0, 0, W, H, true);
      cam.startFollow(this.heroine, true);
      // Follow offset is subtracted from the target: a positive x puts her right of center.
      cam.setFollowOffset(shift, 0);
    }
  }

  private announce(): void {
    const pack = this.packOfMap();
    if (!pack) return;
    const { stage } = this.revivalOf(pack);
    showToast({ icon: 'spark', title: getPack(pack).location.name.uk, text: i18n.t('world.revival', { stage }) });
  }

  // ------------------------------------------------------------------ actions

  private notice(key: string, opts?: Record<string, unknown>): void {
    const now = this.time.now;
    if (now - this.lastNotice < 3000) return;
    this.lastNotice = now;
    showToast({ icon: 'warn', title: i18n.t(key, opts) });
  }

  private onBump(other: Phaser.GameObjects.GameObject): void {
    const minStage = other.getData?.('gate') as number | undefined;
    if (minStage) this.notice('world.fogLocked', { stage: minStage });
  }

  private tryExit(exit: { target: MapId; spawn: string; requiresPack?: string }): void {
    if (this.leaving) return;
    if (exit.requiresPack && !this.revivalOf(exit.requiresPack).available) {
      this.notice('world.pathFog', { name: getPack(exit.requiresPack).location.name.uk });
      return;
    }
    this.goTo(exit.target, exit.spawn);
  }

  private goTo(map: MapId, spawn: string): void {
    if (this.leaving) return;
    this.leaving = true;
    this.heroine.setVelocity(0, 0);
    const cam = this.cameras.main;
    cam.fadeOut(200, 46, 27, 18);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ map, spawn }));
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    const s = this.store.getState();
    if (s.uiBlocking || this.leaving) return;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    if (pointer.rightButtonDown()) {
      this.onPlace(world);
      return;
    }
    if (!pointer.leftButtonDown()) return;
    // 1) Things to interact with (bed, journal, shop) under the cursor.
    for (const it of this.interacts) {
      if (!Phaser.Geom.Rectangle.Contains(it.rect, world.x, world.y)) continue;
      if (!this.inReachRect(it.rect)) {
        this.notice('world.tooFar');
        return;
      }
      if (it.action === 'sleep') s.requestSleep('bed');
      else if (it.action === 'journal') s.requestUi('journal');
      else if (it.action === 'shop') s.requestUi('shop');
      return;
    }
    // 2) The selected tool or item on the tile under the cursor.
    const tx = Math.floor(world.x / T);
    const ty = Math.floor(world.y / T);
    if (this.useItem(tx, ty)) return;
    // 3) Building plots: show what grows there.
    for (const plot of this.plots) {
      if (Phaser.Geom.Rectangle.Contains(plot.rect, world.x, world.y)) {
        this.buildingInfo(plot.pack);
        return;
      }
    }
  }

  private inReachRect(rect: Phaser.Geom.Rectangle): boolean {
    const fx = this.heroine.x;
    const fy = this.heroine.y - 4;
    const nx = Phaser.Math.Clamp(fx, rect.left, rect.right);
    const ny = Phaser.Math.Clamp(fy, rect.top, rect.bottom);
    return Phaser.Math.Distance.Between(fx, fy, nx, ny) <= REACH;
  }

  private inReachTile(tx: number, ty: number): boolean {
    return this.inReachRect(new Phaser.Geom.Rectangle(tx * T, ty * T, T, T));
  }

  private inGarden(tx: number, ty: number): boolean {
    return this.gardens.some((g) => Phaser.Geom.Rectangle.Contains(g, tx * T + T / 2, ty * T + T / 2));
  }

  /** The selected toolbar item, or null. */
  private selectedItem(): string | null {
    const s = this.store.getState();
    return s.world.state.toolbar[s.selectedSlot] ?? null;
  }

  /** Use the selected item on a tile. Returns true when the click was meant for the tile. */
  private useItem(tx: number, ty: number): boolean {
    const s = this.store.getState();
    const key = `${tx},${ty}`;
    const plot = this.mapId === 'homestead' ? s.world.state.plots[key] : undefined;
    const id = this.selectedItem();
    const item = id ? ITEMS[id] : undefined;
    const ripe = !!plot && isRipe(plot);
    const usable = item?.tool === 'hoe' || item?.tool === 'water' || item?.kind === 'seed' || item?.tool === 'axe' || item?.tool === 'pickaxe';
    if (!ripe && !usable) return false;
    if (!this.inReachTile(tx, ty)) {
      this.notice('world.tooFar');
      return true;
    }
    let reason: string | null = null;
    if (ripe) {
      // Anything in hand harvests a ripe crop.
      const crop = plot!.crop!;
      reason = s.act('harvest', (w) => harvest(w, key));
      if (!reason) showToast({ icon: 'spark', title: i18n.t('world.harvested', { name: getItem(crop).name }) });
    } else if (item?.tool === 'hoe') {
      if (this.mapId !== 'homestead' || !this.inGarden(tx, ty)) reason = 'notGarden';
      else if (decorAt(s.world.state, this.mapId, tx, ty)) reason = 'occupied';
      else reason = s.act('till', (w) => till(w, key));
    } else if (item?.tool === 'water') {
      reason = this.mapId === 'homestead' ? s.act('water', (w) => water(w, key)) : 'notTilled';
    } else if (item?.kind === 'seed') {
      reason = this.mapId === 'homestead' ? s.act('plant', (w) => plant(w, key, id!)) : 'notTilled';
    } else if (item?.tool === 'axe' || item?.tool === 'pickaxe') {
      reason = this.gather(tx, ty, item.tool);
    }
    if (reason) this.notice(`world.fail.${reason}`);
    return true;
  }

  /** Chop or mine a prop in a location: wood or stone, sometimes the location's resource. */
  private gather(tx: number, ty: number, tool: 'axe' | 'pickaxe'): string | null {
    const pack = this.packOfMap();
    const decor = this.map.getLayer('decor')?.tilemapLayer;
    const tile = decor?.getTileAt(tx, ty);
    if (!pack || !decor || !tile || !tile.collides) return 'nothingHere';
    const s = this.store.getState();
    const bonus = Math.random() < PACK_RESOURCE_CHANCE ? getPack(pack).resource.id : null;
    const base = tool === 'axe' ? 'wood' : 'stone';
    const reason = s.act(tool === 'axe' ? 'chop' : 'mine', (w) => {
      let next = addItem(w, base);
      if (bonus) next = addItem(next, bonus);
      return { ok: true, world: next };
    });
    if (reason) return reason;
    decor.removeTileAt(tx, ty);
    gathered.keys.add(`${this.mapId}:${tx},${ty}`);
    showToast({
      icon: 'spark',
      title: i18n.t('world.gathered', { name: getItem(base).name }),
      text: bonus ? i18n.t('world.gatheredBonus', { name: getItem(bonus).name }) : undefined,
    });
    return null;
  }

  /** Right click: pick up placed decor, or place the selected furniture (house and homestead). */
  private onPlace(world: Phaser.Math.Vector2): void {
    const s = this.store.getState();
    if (this.mapId !== 'house' && this.mapId !== 'homestead') return;
    const tx = Math.floor(world.x / T);
    const ty = Math.floor(world.y / T);
    if (!this.inReachTile(tx, ty)) {
      this.notice('world.tooFar');
      return;
    }
    const placed = decorAt(s.world.state, this.mapId, tx, ty);
    if (placed) {
      const reason = s.editWorld((w) => pickUpDecor(w, placed.uid));
      if (reason) this.notice(`world.fail.${reason}`);
      return;
    }
    const id = this.selectedItem();
    if (!id || ITEMS[id]?.kind !== 'furniture') return;
    if (!this.tileFree(tx, ty)) {
      this.notice('world.fail.occupied');
      return;
    }
    const reason = s.editWorld((w) => placeDecor(w, id, this.mapId, tx, ty, this.mapId === 'house'));
    if (reason) this.notice(`world.fail.${reason}`);
  }

  /** A tile is free for furniture: no blocking tile, object, plot, or the heroine herself. */
  private tileFree(tx: number, ty: number): boolean {
    if (tx < 0 || ty < 0 || tx >= this.map.width || ty >= this.map.height) return false;
    for (const layer of this.layers) if (layer.getTileAt(tx, ty)?.collides) return false;
    if (this.mapId === 'homestead' && this.store.getState().world.state.plots[`${tx},${ty}`]) return false;
    const bodies = this.physics.overlapRect(tx * T + 1, ty * T + 1, T - 2, T - 2, true, true);
    return bodies.length === 0;
  }

  private buildingInfo(pack: string): void {
    const s = this.store.getState();
    const d = Object.values(s.labs.curriculum.disciplines).find((x) => x.pack === pack);
    const p = getPack(pack);
    const level = d ? (s.progress.disciplines[d.key]?.buildingLevel ?? 0) : 0;
    showToast({
      icon: 'book',
      title: p.building.name.uk,
      text: !d ? i18n.t('world.buildingNoPlan') : level > 0 ? i18n.t('world.buildingLevel', { level }) : i18n.t('world.buildingPlot'),
    });
  }

  // ------------------------------------------------------------------ homestead rendering

  /** Garden soil and crops on the homestead. */
  private renderSoil(): void {
    for (const o of this.soilSprites) o.destroy();
    this.soilSprites = [];
    if (this.mapId !== 'homestead') return;
    for (const [key, plot] of Object.entries(this.store.getState().world.state.plots)) {
      const [tx, ty] = key.split(',').map(Number);
      const frame = plot.wateredToday ? TEMP_FRAMES.soilWet : TEMP_FRAMES.soil;
      this.soilSprites.push(this.add.image(tx * T, ty * T, 'temp-interior', frame).setOrigin(0).setDepth(DEPTH.soil));
      const crop = cropFrame(plot);
      if (crop !== null) {
        // Crops stand on the tile and y-sort with the heroine.
        this.soilSprites.push(this.add.image(tx * T + T / 2, ty * T + T, 'temp-crops', crop).setOrigin(0.5, 1).setDepth(ty * T + T - 1));
      }
    }
  }

  /** Placed furniture and outdoor decor on this map. */
  private renderDecor(): void {
    for (const o of this.decorSprites) o.destroy();
    this.decorSprites = [];
    this.decorBlockers.clear(true, true);
    for (const d of this.store.getState().world.state.decor) {
      if (d.map !== this.mapId) continue;
      const item = ITEMS[d.item];
      if (!item?.icon.sheet) continue;
      const img = this.add
        .image(d.x * T + T / 2, d.y * T + T, item.icon.sheet, item.icon.frame)
        .setOrigin(0.5, 1)
        .setDepth(item.collides ? d.y * T + T - 1 : DEPTH.soil);
      this.decorSprites.push(img);
      if (item.collides) {
        const zone = this.add.zone(d.x * T + 2, d.y * T + 8, T - 4, T - 8).setOrigin(0);
        this.physics.add.existing(zone, true);
        this.decorBlockers.add(zone);
      }
    }
  }

  /** Discipline buildings grow with labs; empty plots show a sign. */
  private renderBuildings(): void {
    const s = this.store.getState();
    for (const plot of this.plots) {
      for (const o of plot.objects) o.destroy();
      plot.objects = [];
      const d = Object.values(s.labs.curriculum.disciplines).find((x) => x.pack === plot.pack);
      const level = d ? (s.progress.disciplines[d.key]?.buildingLevel ?? 0) : 0;
      const rows = buildingTiles(level, PACK_STYLE[plot.pack] ?? 'red');
      const bottom = plot.rect.bottom - T; // the last row of the plot is the path
      if (!rows) {
        const x = plot.rect.centerX;
        plot.objects.push(this.add.image(x, bottom, 'temp-town', TEMP_FRAMES.plotSign).setOrigin(0.5, 1).setDepth(bottom));
        plot.objects.push(this.addBlocker(x - 5, bottom - 6, 10, 6));
        continue;
      }
      const w = rows[0].length;
      const left = plot.rect.x + Math.floor((plot.rect.width / T - w) / 2) * T;
      const top = bottom - rows.length * T;
      rows.forEach((row, r) =>
        row.forEach((frame, c) => plot.objects.push(this.add.image(left + c * T, top + r * T, 'temp-town', frame).setOrigin(0).setDepth(bottom))),
      );
      const walls = wallRows(level) * T;
      plot.objects.push(this.addBlocker(left, bottom - walls, w * T, walls));
    }
  }

  /** Props chopped or mined today stay gone until the next day. */
  private removeGathered(): void {
    const day = this.store.getState().world.state.day;
    if (gathered.day !== day) {
      gathered.day = day;
      gathered.keys.clear();
    }
    const decor = this.map.getLayer('decor')?.tilemapLayer;
    if (!decor) return;
    for (const key of gathered.keys) {
      const [map, pos] = key.split(':');
      if (map !== this.mapId) continue;
      const [tx, ty] = pos.split(',').map(Number);
      decor.removeTileAt(tx, ty);
    }
  }

  /** Outline the tile the selected item would act on: honey in reach, clay out of reach. */
  private updateCursor(): void {
    const id = this.selectedItem();
    const item = id ? ITEMS[id] : undefined;
    const active = !!item && (item.kind === 'seed' || item.kind === 'furniture' || (item.kind === 'tool' && item.tool !== 'sword'));
    if (!active || this.store.getState().uiBlocking) {
      this.cursorBox.setVisible(false);
      return;
    }
    const p = this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    const tx = Math.floor(p.x / T);
    const ty = Math.floor(p.y / T);
    this.cursorBox.setPosition(tx * T, ty * T).setVisible(true);
    this.cursorBox.setStrokeStyle(1, this.inReachTile(tx, ty) ? 0xf2c76b : 0xa3432c); // honey-300 / clay-600
  }

  private setAppearance(): void {
    this.heroineKey = ensureHeroine(this, this.store.getState().world.state.player.appearance);
    this.heroine.play(heroineAnim(this.heroineKey, this.facing, false).anim);
  }

  // ------------------------------------------------------------------ frame

  update(time: number, delta: number): void {
    const s = this.store.getState();
    s.tickClock(delta);
    this.move(s.uiBlocking || this.leaving);
    this.heroine.setDepth(this.heroine.y);
    this.updateCursor();
    this.updateLight(time);
  }

  private move(frozen: boolean): void {
    let dx = 0;
    let dy = 0;
    if (!frozen) {
      if (this.cursors.left.isDown) dx -= 1;
      if (this.cursors.right.isDown) dx += 1;
      if (this.cursors.up.isDown) dy -= 1;
      if (this.cursors.down.isDown) dy += 1;
    }
    const moving = dx !== 0 || dy !== 0;
    if (moving) {
      this.facing = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
      const len = Math.hypot(dx, dy);
      this.heroine.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
    } else {
      this.heroine.setVelocity(0, 0);
    }
    const { anim, flipX } = heroineAnim(this.heroineKey, this.facing, moving);
    this.heroine.setFlipX(flipX);
    if (this.heroine.anims.currentAnim?.key !== anim) this.heroine.play(anim);
  }

  private updateLight(time: number): void {
    const minutes = this.store.getState().clockMinutes;
    const ambient = ambientAt(minutes);
    const dark = darkness(minutes);
    const on = ambient !== 0xffffff;
    this.night.setVisible(on);
    for (const o of this.nightOverlays) o.setVisible(dark > 0.05).setAlpha(Math.min(1, dark * 1.4));
    // Repaint only when the ambient color changed, at most twice a second.
    if (on && ambient !== this.lastAmbient && time - this.lastLightPaint > 500) {
      this.night.setLights(dark > 0.05 ? this.lightSources : [], ambient);
      this.lastAmbient = ambient;
      this.lastLightPaint = time;
    }
    for (const f of this.fireflies) {
      f.setVisible(dark > 0.5).setAlpha(dark);
      if (!f.visible) continue;
      const ph = f.getData('phase') as number;
      const home = f.getData('home') as { x: number; y: number };
      f.setPosition(Math.round(home.x + Math.sin(time / 1700 + ph) * 14), Math.round(home.y + Math.cos(time / 1300 + ph * 2) * 8));
    }
  }
}
