import Phaser from 'phaser';
import type { StoreApi } from 'zustand/vanilla';

import { sfx } from '@/audio';
import { ENEMY_DEFS, enemiesFor, PLAYER_COMBAT, SPAWN, SPELL, WEAPONS, weaponDamage } from '@/core/combat';
import { getItem } from '@/core/items';
import { activeSkills } from '@/core/skills';
import i18n from '@/i18n';
import type { GameState } from '@/state/store';
import { showToast } from '@/ui/components/Toasts';

const T = 16;

/** Enemies defeated today stay away until tomorrow: "map:index". Session only. */
const defeated = { day: -1, keys: new Set<string>() };

interface Enemy {
  sprite: Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
  id: string;
  key: string;
  hp: number;
  nextWander: number;
  stunnedUntil: number;
}

export interface CombatOptions {
  store: StoreApi<GameState>;
  heroine: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  layers: Phaser.Tilemaps.TilemapLayer[];
  blockers: Phaser.Physics.Arcade.StaticGroup;
  mapId: string;
  pack: string;
  /** Where the heroine arrives; enemies keep a distance from it. */
  entrance: { x: number; y: number };
  /** Locked fog zones (no enemies inside). */
  locked: Phaser.Geom.Rectangle[];
  notice: (key: string) => void;
  /** True while the scene is leaving (fade to another map): no hits then. */
  leaving: () => boolean;
}

/**
 * Light combat in a location (spec §4): enemies wander and chase when the heroine is
 * near, hurt on contact; the sword, staff and bow attack toward the cursor; the
 * «Іскра знань» spell hits all around.
 */
export class Combat {
  private enemies: Enemy[] = [];
  private projectiles!: Phaser.Physics.Arcade.Group;
  private nextAttack = 0;
  private nextSpell = 0;
  private invulnerableUntil = 0;
  /** While set, the heroine is pushed back and does not take input. */
  knockback: { vx: number; vy: number; until: number } | null = null;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly o: CombatOptions,
  ) {
    this.makeTextures();
    this.projectiles = scene.physics.add.group({ allowGravity: false });
    for (const layer of o.layers) {
      scene.physics.add.collider(this.projectiles, layer, (p) => (p as Phaser.GameObjects.GameObject).destroy());
    }
    this.spawn();
  }

  // ------------------------------------------------------------------ setup

  private makeTextures(): void {
    const tex = this.scene.textures;
    if (!tex.exists('spark-bolt')) {
      const c = tex.createCanvas('spark-bolt', 5, 5)!;
      const ctx = c.getContext();
      ctx.fillStyle = '#9fe3d2'; // rune-glow
      ctx.fillRect(1, 1, 3, 3);
      ctx.fillStyle = '#e9f3fb';
      ctx.fillRect(2, 2, 1, 1);
      ctx.fillStyle = '#7cc4c0'; // river-300
      for (const [x, y] of [[2, 0], [0, 2], [4, 2], [2, 4]]) ctx.fillRect(x, y, 1, 1);
      c.refresh();
    }
    if (!tex.exists('arrow-bolt')) {
      const c = tex.createCanvas('arrow-bolt', 8, 3)!;
      const ctx = c.getContext();
      ctx.fillStyle = '#5a3420'; // wood-700
      ctx.fillRect(0, 1, 6, 1);
      ctx.fillStyle = '#e8d09c'; // parchment-200 tip
      ctx.fillRect(6, 0, 2, 3);
      ctx.fillStyle = '#a3432c'; // clay-600 fletching
      ctx.fillRect(0, 0, 1, 3);
      c.refresh();
    }
  }

  private spawn(): void {
    const s = this.o.store.getState();
    const day = s.world.state.day;
    if (defeated.day !== day) {
      defeated.day = day;
      defeated.keys.clear();
    }
    const kinds = enemiesFor(this.o.pack);
    if (kinds.length === 0) return;
    // Same places all day long, different every day.
    const rng = new Phaser.Math.RandomDataGenerator([`${this.o.mapId}:${day}`]);
    const map = this.o.layers[0].tilemap;
    const free: { x: number; y: number }[] = [];
    for (let ty = 1; ty < map.height - 1; ty++) {
      for (let tx = 1; tx < map.width - 1; tx++) {
        if (this.o.layers.some((l) => l.getTileAt(tx, ty)?.collides)) continue;
        const x = tx * T + T / 2;
        const y = ty * T + T - 2;
        if (Phaser.Math.Distance.Between(x, y, this.o.entrance.x, this.o.entrance.y) < SPAWN.minDistanceFromEntrance) continue;
        if (this.o.locked.some((r) => r.contains(x, y))) continue;
        free.push({ x, y });
      }
    }
    for (let i = 0; i < SPAWN.perLocation && free.length > 0; i++) {
      const at = free.splice(rng.between(0, free.length - 1), 1)[0];
      const id = rng.pick(kinds);
      const key = `${this.o.mapId}:${i}`;
      if (defeated.keys.has(key)) continue;
      this.addEnemy(id, key, at.x, at.y);
    }
  }

  private addEnemy(id: string, key: string, x: number, y: number): void {
    const def = ENEMY_DEFS[id];
    const sprite = this.scene.physics.add.image(x, y, `enemy-${id}`).setOrigin(0.5, 1);
    sprite.body.setSize(12, 8).setOffset(2, 8);
    sprite.setCollideWorldBounds(true);
    sprite.setDepth(y);
    // The Procrastination Ghost drifts through walls; everyone else bumps into them.
    if (id !== 'ghost') {
      for (const layer of this.o.layers) this.scene.physics.add.collider(sprite, layer);
      this.scene.physics.add.collider(sprite, this.o.blockers);
    }
    const enemy: Enemy = { sprite, id, key, hp: def.hp, nextWander: 0, stunnedUntil: 0 };
    this.enemies.push(enemy);
    this.scene.physics.add.overlap(this.o.heroine, sprite, () => this.touch(enemy));
    this.scene.physics.add.overlap(this.projectiles, sprite, (_e, p) => this.hitByProjectile(enemy, p as Phaser.Types.Physics.Arcade.ImageWithDynamicBody));
  }

  // ------------------------------------------------------------------ frame

  update(time: number, frozen: boolean): void {
    const h = this.o.heroine;
    for (const e of this.enemies) {
      const def = ENEMY_DEFS[e.id];
      e.sprite.setDepth(e.sprite.y);
      if (frozen || time < e.stunnedUntil) {
        if (frozen) e.sprite.setVelocity(0, 0);
        continue;
      }
      const d = Phaser.Math.Distance.Between(e.sprite.x, e.sprite.y, h.x, h.y);
      if (d < def.aggro) {
        const a = Phaser.Math.Angle.Between(e.sprite.x, e.sprite.y, h.x, h.y);
        e.sprite.setVelocity(Math.cos(a) * def.speed, Math.sin(a) * def.speed);
        e.sprite.setFlipX(Math.cos(a) < 0);
      } else if (time > e.nextWander) {
        const idle = Math.random() < 0.4;
        const a = Math.random() * Math.PI * 2;
        const v = idle ? 0 : def.speed * 0.5;
        e.sprite.setVelocity(Math.cos(a) * v, Math.sin(a) * v);
        e.nextWander = time + 1200 + Math.random() * 1600;
      }
    }
    for (const p of this.projectiles.getChildren() as Phaser.Types.Physics.Arcade.ImageWithDynamicBody[]) {
      if (time > (p.getData('dies') as number)) p.destroy();
    }
    if (this.knockback && time > this.knockback.until) this.knockback = null;
    if (time > this.invulnerableUntil) h.clearTint();
  }

  // ------------------------------------------------------------------ hits

  private touch(enemy: Enemy): void {
    const now = this.scene.time.now;
    const s = this.o.store.getState();
    if (now < this.invulnerableUntil || s.uiBlocking || s.sleepRequest || this.o.leaving()) return;
    this.invulnerableUntil = now + PLAYER_COMBAT.invulnerableMs;
    s.damagePlayer(ENEMY_DEFS[enemy.id].damage);
    sfx('hurt');
    const h = this.o.heroine;
    const a = Phaser.Math.Angle.Between(enemy.sprite.x, enemy.sprite.y, h.x, h.y);
    this.knockback = { vx: Math.cos(a) * PLAYER_COMBAT.knockback, vy: Math.sin(a) * PLAYER_COMBAT.knockback, until: now + 160 };
    h.setTint(0xd9503f); // bar-health
  }

  private damage(enemy: Enemy, amount: number, from: { x: number; y: number }): void {
    if (enemy.hp <= 0) return;
    enemy.hp -= amount;
    const a = Phaser.Math.Angle.Between(from.x, from.y, enemy.sprite.x, enemy.sprite.y);
    enemy.sprite.setVelocity(Math.cos(a) * 140, Math.sin(a) * 140);
    enemy.stunnedUntil = this.scene.time.now + 180;
    enemy.sprite.setTintFill(0xfbf3dc); // parchment-50 flash
    this.scene.time.delayedCall(90, () => enemy.sprite.active && enemy.sprite.clearTint());
    if (enemy.hp <= 0) {
      sfx('enemy-defeat');
      this.defeat(enemy);
    } else sfx('enemy-hit');
  }

  private defeat(enemy: Enemy): void {
    defeated.keys.add(enemy.key);
    this.enemies = this.enemies.filter((e) => e !== enemy);
    enemy.sprite.body.enable = false;
    this.scene.tweens.add({ targets: enemy.sprite, alpha: 0, y: enemy.sprite.y - 4, duration: 300, onComplete: () => enemy.sprite.destroy() });
    const loot = this.o.store.getState().defeatEnemy(enemy.id);
    const items = loot.items.map((i) => getItem(i).name).join(', ');
    showToast(
      {
        icon: 'spark',
        title: i18n.t('combat.defeated', { name: ENEMY_DEFS[enemy.id].name }),
        text: i18n.t('combat.loot', { coins: loot.coins, count: loot.coins }) + (items ? ` · ${items}` : ''),
      },
      2500,
    );
  }

  private hitByProjectile(enemy: Enemy, p: Phaser.Types.Physics.Arcade.ImageWithDynamicBody): void {
    if (!p.active) return;
    const dmg = p.getData('damage') as number;
    p.destroy();
    this.damage(enemy, dmg, { x: p.x, y: p.y });
  }

  // ------------------------------------------------------------------ attacks

  /** Attack toward a world point with a weapon (sword, staff, bow). */
  attack(tool: string, target: { x: number; y: number }): void {
    const now = this.scene.time.now;
    const w = WEAPONS[tool];
    if (!w || now < this.nextAttack) return;
    this.nextAttack = now + w.cooldown;
    const h = this.o.heroine;
    const origin = { x: h.x, y: h.y - 10 };
    const a = Phaser.Math.Angle.Between(origin.x, origin.y, target.x, target.y);
    const dmg = weaponDamage(tool, this.o.store.getState().effects);
    if (w.kind === 'melee') {
      sfx('swing');
      this.swing(tool, origin, a);
      for (const e of [...this.enemies]) {
        const ex = e.sprite.x;
        const ey = e.sprite.y - 6;
        const dist = Phaser.Math.Distance.Between(origin.x, origin.y, ex, ey);
        const diff = Math.abs(Phaser.Math.Angle.Wrap(Phaser.Math.Angle.Between(origin.x, origin.y, ex, ey) - a));
        if (dist <= w.range + 6 && (diff < 1.3 || dist < 10)) this.damage(e, dmg, origin);
      }
      return;
    }
    sfx(w.kind === 'arrow' ? 'swing' : 'shoot');
    const key = w.kind === 'arrow' ? 'arrow-bolt' : 'spark-bolt';
    const p = this.projectiles.create(origin.x, origin.y, key) as Phaser.Types.Physics.Arcade.ImageWithDynamicBody;
    p.setRotation(a).setDepth(origin.y + 20);
    p.body.setSize(4, 4);
    p.setVelocity(Math.cos(a) * (w.speed ?? 150), Math.sin(a) * (w.speed ?? 150));
    p.setData('damage', dmg);
    p.setData('dies', now + (w.range / (w.speed ?? 150)) * 1000);
    if (w.kind === 'spark') p.setBlendMode(Phaser.BlendModes.ADD);
  }

  /** The sword sweeps across the attack direction. */
  private swing(tool: string, origin: { x: number; y: number }, angle: number): void {
    const icon = getItem(tool).icon;
    const x = origin.x + Math.cos(angle) * 10;
    const y = origin.y + Math.sin(angle) * 10;
    let blade: Phaser.GameObjects.Image;
    // The sword icon (the start-menu sword) points to the upper left: turn it to the attack direction.
    let turn = 0;
    if (icon.texture) {
      blade = this.scene.add.image(x, y, icon.texture);
      turn = (3 * Math.PI) / 4;
    } else if (icon.sheet !== undefined && icon.frame !== undefined) {
      blade = this.scene.add.image(x, y, icon.sheet, icon.frame);
    } else return;
    blade.setDepth(origin.y + 30).setRotation(angle + turn - 0.9);
    this.scene.tweens.add({ targets: blade, rotation: angle + turn + 0.9, duration: 140, onComplete: () => blade.destroy() });
  }

  /** «Іскра знань» (Science skill): hits every enemy around the heroine. */
  castSpell(): void {
    const s = this.o.store.getState();
    const known = activeSkills(s.labs.skills ?? [], s.progress.skillPoints).includes(SPELL.id);
    if (!known) {
      this.o.notice('combat.noSpell');
      return;
    }
    const now = this.scene.time.now;
    if (now < this.nextSpell) return;
    if (s.world.state.player.energy < SPELL.energy) {
      this.o.notice('world.fail.tired');
      return;
    }
    this.nextSpell = now + SPELL.cooldown;
    s.spendEnergy(SPELL.energy);
    sfx('spell');
    const h = this.o.heroine;
    const c = { x: h.x, y: h.y - 8 };
    const ring = this.scene.add.circle(c.x, c.y, 4).setStrokeStyle(2, 0x9fe3d2).setDepth(h.y + 40); // rune-glow
    this.scene.tweens.add({ targets: ring, radius: SPELL.radius, alpha: 0, duration: 260, onComplete: () => ring.destroy() });
    for (const e of [...this.enemies]) {
      if (Phaser.Math.Distance.Between(c.x, c.y, e.sprite.x, e.sprite.y - 6) <= SPELL.radius) this.damage(e, SPELL.damage, c);
    }
  }
}
