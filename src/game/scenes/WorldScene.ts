import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';

import { setNight, setPlace, sfx, type Sfx } from '@/audio';
import { getPack } from '@/core/content';
import { addItem, cropFrame, decorAt, harvest, isRipe, pickUpDecor, placeDecor, plant, till, water } from '@/core/homestead';
import { getItem, ITEMS } from '@/core/items';
import { MENTORS, visitorsToday } from '@/core/mentors';
import { todayIso } from '@/core/rules';
import { ambientAt, darkness } from '@/core/time';
import i18n, { loc } from '@/i18n';
import type { GameState } from '@/state/store';
import { showToast } from '@/ui/components/Toasts';

import { ensureHeroine, heroineAnim, type Facing } from '../assets/heroine';
import { buildingKey, TEMP_FRAMES, TILESET_TEXTURES, type MapId } from '../assets/manifest';
import { LIGHT, LIGHT_RADIUS, type Light } from '../lighting/lightmap';
import { NightLayer, createGlowOverlay } from '../lighting/NightLayer';
import { revivalMatrix } from '../lighting/revival';
import { buildingTiles, PACK_STYLE, wallRows } from '../world/buildings';
import { Combat } from '../world/Combat';

/** Lantern glass color in lamp-post.png (set by scripts/assets/build_sprites.py). */
const LAMP_GLASS_RGB: [number, number, number] = [58, 66, 78];
/** Walking speed in source pixels per second. */
const SPEED = 64;
/** One footstep sound per stride (the walk cycle has two steps). */
const STEP_MS = 300;
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
  private lastStep = 0;
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
  /** Where the location's mentor stands, and where visiting mentors gather on the homestead. */
  private mentorSpot: { x: number; y: number } | null = null;
  private visitSpots: { x: number; y: number }[] = [];
  private mentorObjects: Phaser.GameObjects.GameObject[] = [];
  private mentorTalk: { rect: Phaser.Geom.Rectangle; pack: string }[] = [];
  private mailbox: Phaser.GameObjects.Image | null = null;
  private combat: Combat | null = null;
  private night!: NightLayer;
  private lightSources: Light[] = [];
  private nightOverlays: Phaser.GameObjects.Image[] = [];
  private fireflies: Phaser.GameObjects.Image[] = [];
  private lastAmbient = -1;
  private lastLightPaint = 0;
  private revivalFx: Phaser.FX.ColorMatrix | null = null;
  private leaving = false;
  private lastNotice = 0;
  /** Last world action came from E/Q: aim at the tile in front of her, not at the mouse. */
  private keyAim = false;
  private lastInset = 0;
  private unsubscribe: (() => void)[] = [];

  constructor() {
    super('world');
  }

  create(data: SceneData): void {
    this.store = this.registry.get('store') as StoreApi<GameState>;
    this.mapId = data.map;
    setPlace(data.map);
    this.leaving = false;
    this.facing = 'down';
    this.gates = [];
    this.interacts = [];
    this.gardens = [];
    this.plots = [];
    this.soilSprites = [];
    this.decorSprites = [];
    this.mentorSpot = null;
    this.visitSpots = [];
    this.mentorObjects = [];
    this.mentorTalk = [];
    this.mailbox = null;
    this.combat = null;
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
        case 'mentor':
          this.mentorSpot = { x, y };
          break;
        case 'visit':
          this.visitSpots.push({ x, y });
          break;
        case 'mailbox':
          this.mailbox = this.add.image(x, y, 'mailbox', 0).setOrigin(0.5, 1).setDepth(y);
          this.addBlocker(x - 3, y - 4, 6, 4);
          this.interacts.push({ rect: new Phaser.Geom.Rectangle(x - 8, y - 32, 16, 32), action: 'mail' });
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
    // Enemies live in the locations only.
    const pack = this.packOfMap();
    if (pack) {
      this.combat = new Combat(this, {
        store: this.store,
        heroine: this.heroine,
        layers,
        blockers: this.blockers,
        mapId: this.mapId,
        pack,
        entrance: spawns.get('from-homestead') ?? spawn,
        locked: this.gates.filter((g) => g.body).map((g) => g.rect),
        notice: (key) => this.notice(key),
        leaving: () => this.leaving,
      });
    }
    this.removeGathered();
    this.renderSoil();
    this.renderDecor();
    this.renderBuildings();
    this.renderMentors();
    this.updateMailbox();
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
    // No global preventDefault: Space and Shift are not used by the world, and the page never
    // scrolls (overflow: hidden). Capturing them would stop Space from pressing a focused UI
    // button and arrows from moving a slider, even while a window is open (WCAG 2.1.1).
    this.input.keyboard!.clearCaptures();
    // Keyboard alternative to the mouse (WCAG 2.1.1): E is the main action (like the left button),
    // Q the secondary one (like the right button). No capture, so they still type in text fields.
    this.input.keyboard!.addKey('E', false).on('down', () => this.onKeyAction(false));
    this.input.keyboard!.addKey('Q', false).on('down', () => this.onKeyAction(true));
    this.input.on(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
    this.input.on(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
    this.input.mouse?.disableContextMenu();

    this.announce();

    this.unsubscribe = [
      this.store.subscribe((s, prev) => {
        if (s.world.state.player.appearance !== prev.world.state.player.appearance) this.setAppearance();
        if (s.progress !== prev.progress) {
          this.buildGates();
          this.applyRevival();
          this.renderBuildings();
          this.renderMentors();
        }
        if (s.labs.mail !== prev.labs.mail) this.updateMailbox();
        if (s.world.state.plots !== prev.world.state.plots) this.renderSoil();
        if (s.world.state.decor !== prev.world.state.decor) this.renderDecor();
        if (s.worldEpoch !== prev.worldEpoch) this.goTo('house', 'bed');
      }),
    ];
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribe.forEach((u) => u());
      this.scale.off(Phaser.Scale.Events.RESIZE, this.fitCamera, this);
      this.input.off(Phaser.Input.Events.POINTER_DOWN, this.onPointer, this);
      this.input.off(Phaser.Input.Events.POINTER_MOVE, this.onPointerMove, this);
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
    // y-sort by the sprite's base; flat things (rugs, mats) lie under everyone.
    img.setDepth(p.flat ? DEPTH.soil : y);
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
    // Tiled gives an array; Phaser leaves {} when a map has none.
    const props = this.map.properties as unknown;
    const list = Array.isArray(props) ? (props as { name: string; value: unknown }[]) : [];
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
    showToast({ icon: 'spark', title: loc(getPack(pack).location.name), text: i18n.t('world.revival', { stage }) });
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
      this.notice('world.pathFog', { name: loc(getPack(exit.requiresPack).location.name) });
      return;
    }
    this.goTo(exit.target, exit.spawn);
  }

  private goTo(map: MapId, spawn: string): void {
    if (this.leaving) return;
    this.leaving = true;
    // Through a door: in or out of the house (not when carried to bed at night).
    if (spawn !== 'bed' && (map === 'house' || this.mapId === 'house')) sfx('door');
    this.heroine.setVelocity(0, 0);
    const cam = this.cameras.main;
    cam.fadeOut(200, 46, 27, 18);
    cam.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.restart({ map, spawn }));
  }

  private onPointer(pointer: Phaser.Input.Pointer): void {
    const s = this.store.getState();
    if (s.uiBlocking || this.leaving) return;
    this.keyAim = false;
    const world = pointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2;
    if (pointer.rightButtonDown()) {
      this.secondaryAt(world);
      return;
    }
    if (!pointer.leftButtonDown()) return;
    this.primaryAt(world);
  }

  private onPointerMove(): void {
    this.keyAim = false;
  }

  /** E / Q: act in front of the heroine (or on the nearest thing she can reach). */
  private onKeyAction(secondary: boolean): void {
    if (this.store.getState().uiBlocking || this.leaving) return;
    this.keyAim = true;
    const front = this.frontPoint();
    if (secondary) {
      this.secondaryAt(front);
      return;
    }
    // A weapon attacks where she looks; otherwise the bed, journal, shop or a mentor within reach comes first.
    const tool = ITEMS[this.selectedItem() ?? '']?.tool;
    const weapon = tool === 'sword' || tool === 'staff' || tool === 'bow';
    const near = weapon ? null : this.nearestInReach();
    this.primaryAt(near ? new Phaser.Math.Vector2(near.centerX, near.centerY) : front);
  }

  /** Centre of the tile in front of her feet. */
  private frontPoint(): Phaser.Math.Vector2 {
    const step = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[this.facing];
    const tx = Math.floor(this.heroine.x / T) + step[0];
    const ty = Math.floor((this.heroine.y - 1) / T) + step[1];
    return new Phaser.Math.Vector2(tx * T + T / 2, ty * T + T / 2);
  }

  /** The closest bed / journal / shop / mailbox or mentor within reach. */
  private nearestInReach(): Phaser.Geom.Rectangle | null {
    let best: Phaser.Geom.Rectangle | null = null;
    let bestDist = Infinity;
    for (const rect of [...this.interacts.map((i) => i.rect), ...this.mentorTalk.map((m) => m.rect)]) {
      if (!this.inReachRect(rect)) continue;
      const d = Phaser.Math.Distance.Between(this.heroine.x, this.heroine.y - 4, rect.centerX, rect.centerY);
      if (d < bestDist) {
        best = rect;
        bestDist = d;
      }
    }
    return best;
  }

  /** Right button / Q: the spell in a fight, otherwise place or pick up furniture. */
  private secondaryAt(world: Phaser.Math.Vector2): void {
    if (this.combat) this.combat.castSpell();
    else this.onPlace(world);
  }

  /** Left button / E at a world point. */
  private primaryAt(world: Phaser.Math.Vector2): void {
    const s = this.store.getState();
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
      else if (it.action === 'mail') s.requestUi('mail');
      return;
    }
    // Mentors: click to talk.
    for (const m of this.mentorTalk) {
      if (!Phaser.Geom.Rectangle.Contains(m.rect, world.x, world.y)) continue;
      if (!this.inReachRect(m.rect)) this.notice('world.tooFar');
      else s.talkTo(m.pack);
      return;
    }
    // 2) The selected tool or item on the tile under the cursor.
    const tx = Math.floor(world.x / T);
    const ty = Math.floor(world.y / T);
    if (this.useItem(tx, ty, world)) return;
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
  private useItem(tx: number, ty: number, world: Phaser.Math.Vector2): boolean {
    const s = this.store.getState();
    const key = `${tx},${ty}`;
    // Weapons attack toward the cursor (no reach limit).
    const weapon = this.selectedItem();
    if (weapon && (ITEMS[weapon]?.tool === 'sword' || ITEMS[weapon]?.tool === 'staff' || ITEMS[weapon]?.tool === 'bow')) {
      if (this.combat) this.combat.attack(weapon, world);
      else this.notice('combat.noEnemies');
      return true;
    }
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
    let sound: Sfx | null = null;
    if (ripe) {
      sound = 'harvest';
      // Anything in hand harvests a ripe crop.
      const crop = plot!.crop!;
      reason = s.act('harvest', (w) => harvest(w, key, s.effects));
      if (!reason) showToast({ icon: 'spark', title: i18n.t('world.harvested', { name: getItem(crop).name }) });
    } else if (item?.tool === 'hoe') {
      sound = 'till';
      if (this.mapId !== 'homestead' || !this.inGarden(tx, ty)) reason = 'notGarden';
      else if (decorAt(s.world.state, this.mapId, tx, ty)) reason = 'occupied';
      else reason = s.act('till', (w) => till(w, key));
    } else if (item?.tool === 'water') {
      sound = 'water';
      if (this.mapId !== 'homestead') reason = 'notTilled';
      else if (s.effects.waterWide) {
        // Modeling «Зелені руки»: the can waters three plots in a row for the price of one.
        reason = s.act('water', (w) => {
          let next = w;
          let any = false;
          for (const k of [`${tx - 1},${ty}`, key, `${tx + 1},${ty}`]) {
            const r = water(next, k);
            if (r.ok) {
              next = r.world;
              any = true;
            }
          }
          return any ? { ok: true, world: next } : water(w, key);
        });
      } else reason = s.act('water', (w) => water(w, key));
    } else if (item?.kind === 'seed') {
      sound = 'plant';
      reason = this.mapId === 'homestead' ? s.act('plant', (w) => plant(w, key, id!)) : 'notTilled';
    } else if (item?.tool === 'axe' || item?.tool === 'pickaxe') {
      reason = this.gather(tx, ty, item.tool);
    }
    if (reason) this.notice(`world.fail.${reason}`);
    else if (sound) sfx(sound);
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
    sfx(tool === 'axe' ? 'chop' : 'mine');
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
      title: loc(p.building.name),
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
      const icon = item?.icon;
      if (!icon || (!icon.sheet && !icon.texture)) continue;
      const img = (icon.texture ? this.add.image(d.x * T + T / 2, d.y * T + T, icon.texture) : this.add.image(d.x * T + T / 2, d.y * T + T, icon.sheet!, icon.frame))
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
      const art = buildingKey(plot.pack, Math.min(5, level));
      if (this.textures.exists(art)) {
        // The owner's sprite, standing on the plot; walls block, the roof is walked behind.
        const img = this.add.image(plot.rect.centerX, bottom, art).setOrigin(0.5, 1).setDepth(bottom);
        const bw = Math.round(img.width * 0.8);
        const bh = Math.min(3 * T, Math.max(8, Math.round(img.height * 0.4)));
        plot.objects.push(img, this.addBlocker(plot.rect.centerX - bw / 2, bottom - bh, bw, bh));
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

  /**
   * Mentors: the location's mentor at their clearing; on a deadline day the mentor
   * of that discipline visits the homestead (spec §6). 16×32 figures drawn after the portraits.
   */
  private renderMentors(): void {
    for (const o of this.mentorObjects) {
      this.tweens.killTweensOf(o);
      o.destroy();
    }
    this.mentorObjects = [];
    this.mentorTalk = [];
    const s = this.store.getState();
    const place = (pack: string, x: number, y: number) => {
      if (!MENTORS[pack] || !this.textures.exists(`mentor-${pack}`)) return;
      const img = this.add.image(x, y, `mentor-${pack}`).setOrigin(0.5, 1).setDepth(y);
      // A small bob so mentors read as alive.
      this.tweens.add({ targets: img, y: y - 1, duration: 600, yoyo: true, repeat: -1, ease: 'Stepped' });
      this.mentorObjects.push(img, this.addBlocker(x - 5, y - 5, 10, 5));
      this.mentorTalk.push({ pack, rect: new Phaser.Geom.Rectangle(x - 8, y - 32, 16, 32) });
    };
    const pack = this.packOfMap();
    if (pack && this.mentorSpot) place(pack, this.mentorSpot.x, this.mentorSpot.y);
    if (this.mapId === 'homestead') {
      visitorsToday(s.labs.curriculum, todayIso()).forEach((p, i) => {
        const spot = this.visitSpots[i % Math.max(1, this.visitSpots.length)];
        if (spot) place(p, spot.x, spot.y);
      });
    }
  }

  /** The mailbox flag is up while there are unread letters. */
  private updateMailbox(): void {
    if (!this.mailbox) return;
    const unread = (this.store.getState().labs.mail ?? []).some((l) => !l.read);
    this.mailbox.setFrame(unread ? 1 : 0);
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
    const weapon = item?.tool === 'sword' || item?.tool === 'staff' || item?.tool === 'bow';
    const active = !!item && !weapon && (item.kind === 'seed' || item.kind === 'furniture' || item.kind === 'tool');
    if (!active || this.store.getState().uiBlocking) {
      this.cursorBox.setVisible(false);
      return;
    }
    const p = this.keyAim ? this.frontPoint() : (this.input.activePointer.positionToCamera(this.cameras.main) as Phaser.Math.Vector2);
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
    this.combat?.update(time, s.uiBlocking || !!s.sleepRequest || this.leaving);
    this.move(s.uiBlocking || this.leaving || !!s.sleepRequest);
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
    const kb = this.combat?.knockback;
    if (kb) {
      // Pushed back by a hit: no input for a moment.
      this.heroine.setVelocity(kb.vx, kb.vy);
    } else if (moving) {
      this.facing = dx < 0 ? 'left' : dx > 0 ? 'right' : dy < 0 ? 'up' : 'down';
      const len = Math.hypot(dx, dy);
      this.heroine.setVelocity((dx / len) * SPEED, (dy / len) * SPEED);
      if (this.time.now - this.lastStep > STEP_MS) {
        this.lastStep = this.time.now;
        sfx('step');
      }
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
    // Morning and evening tints keep the day version; it turns to night with the dark.
    setNight(Math.max(0, (dark - 0.25) / 0.75));
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
