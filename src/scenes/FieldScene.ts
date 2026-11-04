/**
 * フィールド（町・草原・ダンジョン・屋内）。
 * 操作：行きたい場所をタップ → 自動で歩く。人や物をタップ → 近くまで歩いて話す/調べる。
 */
import Phaser from 'phaser';
import { CHAR_FRAME, drawCharacterSheet, drawMapCanvas, FACING_FRAME, TILE } from '../art/fieldArt';
import { audio } from '../audio/audio';
import { session } from '../core/session';
import type { Facing } from '../core/types';
import { getMap, type MapDef, type NpcDef, type ObjectDef } from '../data/maps';
import { SPECIES } from '../data/species';
import { checkCondition } from '../data/conditions';
import { activeObjects, approachPath, barrierOpen, canStand, DIRS, facingTo, findPath, npcAt, objectAt, rollEncounter, trainerSpotting, visibleNpcs, type Pos } from '../logic/field';
import { mathRng } from '../logic/rng';

export interface FieldHost {
  onInteractNpc(scene: FieldScene, npc: NpcDef): Promise<void>;
  onInteractObject(scene: FieldScene, obj: ObjectDef): Promise<void>;
  onWildEncounter(scene: FieldScene, speciesId: string, level: number): Promise<void>;
  onTrainerSpotted(scene: FieldScene, npc: NpcDef): Promise<void>;
  onEnterMap(scene: FieldScene, map: MapDef): Promise<void>;
  onStep(scene: FieldScene): void;
}

interface NpcView {
  def: NpcDef;
  sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
  pos: Pos;
}

const STEP_MS = 150;

export class FieldScene extends Phaser.Scene {
  map!: MapDef;
  host!: FieldHost;
  pos: Pos = { x: 0, y: 0 };
  facing: Facing = 'down';
  private player!: Phaser.GameObjects.Sprite;
  private npcs = new Map<string, NpcView>();
  private objectSprites: Phaser.GameObjects.GameObject[] = [];
  private mapImage?: Phaser.GameObjects.Image;
  private path: Pos[] = [];
  private pendingInteract: Pos | null = null;
  private moving = false;
  /** 会話・メニュー・戦闘中は true（歩けない） */
  busy = false;
  private marker!: Phaser.GameObjects.Graphics;
  private keys?: Record<string, Phaser.Input.Keyboard.Key>;
  /** 画面の十字ボタンで押している向き（押している間 歩き続ける） */
  padDir: Facing | null = null;
  /** 一瞬だけ押された方向（離すのが速すぎても1歩は進む） */
  padTap: Facing | null = null;
  private zoomLevel = 1;

  constructor() {
    super('field');
  }

  init(data: { mapId: string; x: number; y: number; facing: Facing; host: FieldHost }): void {
    this.map = getMap(data.mapId);
    this.pos = { x: data.x, y: data.y };
    this.facing = data.facing;
    this.host = data.host;
    this.path = [];
    this.pendingInteract = null;
    this.moving = false;
    this.busy = false;
    this.npcs.clear();
    this.objectSprites = [];
    this.mapImage = undefined; // restart時は前回の画像が破棄済み
    this.padDir = null;
    this.padTap = null;
  }

  create(): void {
    const save = session.data;
    save.location = { mapId: this.map.id, x: this.pos.x, y: this.pos.y, facing: this.facing };
    this.cameras.main.setBackgroundColor(this.map.kind === 'indoor' ? '#1d1630' : '#244d33');
    this.redrawMap();

    // 主人公
    const sheetKey = 'char:player';
    if (!this.textures.exists(sheetKey)) this.addSheet(sheetKey, drawCharacterSheet({ body: '#4a7fc0', hair: '#3a2a1a' }, { player: true }));
    this.player = this.add.sprite(0, 0, sheetKey, FACING_FRAME[this.facing]).setOrigin(0.5, 0.92).setDepth(10);
    this.placeAt(this.player, this.pos);

    this.marker = this.add.graphics().setDepth(5);
    this.spawnNpcs();
    this.spawnObjects();
    this.setupCamera();
    this.scale.on('resize', this.setupCamera, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.setupCamera, this));

    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.busy) return;
      if (p.getDistance() > 24 * (window.devicePixelRatio || 1)) return; // ドラッグは無視
      const wp = this.cameras.main.getWorldPoint(p.x, p.y);
      this.onTap({ x: Math.floor(wp.x / TILE), y: Math.floor(wp.y / TILE) });
    });
    if (this.input.keyboard) {
      this.keys = this.input.keyboard.addKeys({ up: 'UP', down: 'DOWN', left: 'LEFT', right: 'RIGHT', a: 'SPACE', b: 'ENTER' }) as Record<string, Phaser.Input.Keyboard.Key>;
    }
    audio.playBgm(this.map.bgm);
    void this.host.onEnterMap(this, this.map);
  }

  private addSheet(key: string, canvas: HTMLCanvasElement): void {
    const tex = this.textures.addCanvas(key, canvas);
    if (!tex) return;
    for (let i = 0; i < 8; i++) tex.add(i, 0, i * CHAR_FRAME.w, 0, CHAR_FRAME.w, CHAR_FRAME.h);
  }

  /** マップ画像を描き直す（黒霞が晴れた時など） */
  redrawMap(): void {
    const save = session.data;
    const key = `map:${this.map.id}:${barrierOpen(this.map, save) ? 1 : 0}`;
    if (!this.textures.exists(key)) this.textures.addCanvas(key, drawMapCanvas(this.map, barrierOpen(this.map, save)));
    if (this.mapImage) this.mapImage.setTexture(key);
    else this.mapImage = this.add.image(0, 0, key).setOrigin(0, 0).setDepth(0);
  }

  private setupCamera(): void {
    const cam = this.cameras.main;
    const vw = this.scale.width;
    const visibleTiles = 9.5;
    this.zoomLevel = vw / (visibleTiles * TILE);
    cam.setZoom(this.zoomLevel);
    cam.setSize(this.scale.width, this.scale.height);
    this.updateCamera(true);
  }

  private updateCamera(instant = false): void {
    const cam = this.cameras.main;
    const mw = this.map.tiles[0].length * TILE;
    const mh = this.map.tiles.length * TILE;
    const vw = cam.width / cam.zoom;
    const vh = cam.height / cam.zoom;
    const px = this.player.x;
    const py = this.player.y - TILE * 0.4;
    const tx = mw <= vw ? mw / 2 : Phaser.Math.Clamp(px, vw / 2, mw - vw / 2);
    const ty = mh <= vh ? mh / 2 : Phaser.Math.Clamp(py, vh / 2, mh - vh / 2);
    if (instant) cam.centerOn(tx, ty);
    else {
      const cx = cam.midPoint.x + (tx - cam.midPoint.x) * 0.25;
      const cy = cam.midPoint.y + (ty - cam.midPoint.y) * 0.25;
      cam.centerOn(cx, cy);
    }
  }

  private placeAt(obj: Phaser.GameObjects.Components.Transform, p: Pos): void {
    obj.setPosition(p.x * TILE + TILE / 2, p.y * TILE + TILE * 0.88);
  }

  private spawnNpcs(): void {
    const save = session.data;
    for (const v of this.npcs.values()) v.sprite.destroy();
    this.npcs.clear();
    for (const def of visibleNpcs(this.map, save)) {
      let sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
      if (def.look.kind === 'monster' || def.look.kind === 'boss') {
        const sp = SPECIES[def.look.speciesId ?? ''];
        const key = `mon:${sp?.art ?? 'fuwamo'}`;
        sprite = this.add.image(0, 0, key).setOrigin(0.5, 0.92);
        const size = def.look.kind === 'boss' ? TILE * 2.6 : TILE * 1.15;
        sprite.setScale(size / 320);
        if (def.look.kind === 'boss') {
          sprite.setTint(0x8a7aa8);
          const mist = this.add.circle(0, 0, TILE * 1.4, 0x1d0f2d, 0.35).setDepth(8);
          this.placeAt(mist, def);
          mist.y -= TILE * 0.8;
          this.tweens.add({ targets: mist, scale: 1.15, alpha: 0.2, duration: 1200, yoyo: true, repeat: -1 });
          this.objectSprites.push(mist);
        }
        this.tweens.add({ targets: sprite, scaleY: sprite.scaleY * 1.04, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      } else {
        const key = `char:${def.look.body}:${def.look.hair}:${def.look.kind}`;
        if (!this.textures.exists(key)) this.addSheet(key, drawCharacterSheet(def.look, { grunt: def.look.kind === 'grunt' }));
        sprite = this.add.sprite(0, 0, key, FACING_FRAME[def.facing]).setOrigin(0.5, 0.92);
      }
      sprite.setDepth(9 + def.y * 0.001);
      this.placeAt(sprite, def);
      if (def.trainerId && !save.defeatedTrainers.includes(def.trainerId)) {
        const mark = this.add.text(0, 0, '!', { fontSize: `${TILE * 0.5}px`, color: '#ffcf6b', fontStyle: 'bold', stroke: '#2b2233', strokeThickness: 4 }).setOrigin(0.5, 1).setDepth(12).setAlpha(0);
        this.placeAt(mark, def);
        mark.y -= TILE * 1.2;
        this.objectSprites.push(mark);
        sprite.setData('mark', mark);
      }
      this.npcs.set(def.id, { def, sprite, pos: { x: def.x, y: def.y } });
    }
  }

  private spawnObjects(): void {
    for (const o of this.objectSprites) o.destroy();
    this.objectSprites = [];
    const save = session.data;
    for (const o of activeObjects(this.map, save)) {
      const opened = save.openedChests.includes(`${this.map.id}:${o.id}`);
      const x = o.x * TILE + TILE / 2;
      const y = o.y * TILE + TILE / 2;
      if (o.kind === 'chest') {
        const g = this.add.graphics().setDepth(4);
        g.fillStyle(0x000000, 0.2).fillEllipse(x, y + TILE * 0.32, TILE * 0.7, TILE * 0.2);
        g.fillStyle(opened ? 0x8a6a44 : 0xc9883a, 1).fillRoundedRect(x - TILE * 0.36, y - TILE * 0.18, TILE * 0.72, TILE * 0.48, 6);
        g.lineStyle(3, 0x2b2233, 1).strokeRoundedRect(x - TILE * 0.36, y - TILE * 0.18, TILE * 0.72, TILE * 0.48, 6);
        if (!opened) {
          g.fillStyle(0xe8a93a, 1).fillRoundedRect(x - TILE * 0.38, y - TILE * 0.34, TILE * 0.76, TILE * 0.22, 6);
          g.lineStyle(3, 0x2b2233, 1).strokeRoundedRect(x - TILE * 0.38, y - TILE * 0.34, TILE * 0.76, TILE * 0.22, 6);
          g.fillStyle(0xffe27a, 1).fillRect(x - 4, y - TILE * 0.2, 8, 10);
        }
        this.objectSprites.push(g);
      } else if (o.kind === 'lantern') {
        const lit = !!(o.flag && save.flags[o.flag]);
        const g = this.add.graphics().setDepth(9 + o.y * 0.001);
        g.fillStyle(0x000000, 0.2).fillEllipse(x, y + TILE * 0.38, TILE * 0.6, TILE * 0.18);
        g.fillStyle(0x6f6a66, 1).fillRect(x - TILE * 0.12, y - TILE * 0.3, TILE * 0.24, TILE * 0.7);
        g.fillStyle(0x4a4542, 1).fillRect(x - TILE * 0.26, y - TILE * 0.72, TILE * 0.52, TILE * 0.44);
        g.fillStyle(lit ? 0xffd166 : 0x2b2240, 1).fillRect(x - TILE * 0.16, y - TILE * 0.64, TILE * 0.32, TILE * 0.28);
        g.fillStyle(0x4a4542, 1).fillTriangle(x - TILE * 0.34, y - TILE * 0.72, x + TILE * 0.34, y - TILE * 0.72, x, y - TILE * 0.98);
        this.objectSprites.push(g);
        if (lit) {
          const glow = this.add.circle(x, y - TILE * 0.5, TILE * 0.7, 0xffd166, 0.25).setDepth(11);
          this.tweens.add({ targets: glow, alpha: 0.08, scale: 1.2, duration: 1000, yoyo: true, repeat: -1 });
          this.objectSprites.push(glow);
        }
      } else if (o.kind === 'hidden') {
        // ときどき きらっと光る
        const star = this.add.star(x, y, 4, 2, 7, 0xffffff, 0.9).setDepth(6).setAlpha(0);
        this.tweens.add({ targets: star, alpha: { from: 0, to: 0.9 }, scale: { from: 0.4, to: 1.1 }, duration: 380, yoyo: true, repeat: -1, repeatDelay: 2600 + Math.random() * 2500, delay: Math.random() * 2000 });
        this.objectSprites.push(star);
      }
    }
  }

  /** NPCの表示条件や宝箱の状態が変わった時に呼ぶ */
  refresh(): void {
    this.redrawMap();
    this.spawnObjects();
    this.spawnNpcs();
  }

  private onTap(t: Pos): void {
    const save = session.data;
    if (t.x === this.pos.x && t.y === this.pos.y) {
      const hidden = objectAt(this.map, save, t.x, t.y);
      if (hidden?.kind === 'hidden') void this.runInteract(hidden);
      return;
    }
    const res = findPath(this.map, save, this.pos, t);
    if (!res) {
      audio.se('bump');
      this.flashMarker(t, 0xff6b6b);
      return;
    }
    this.flashMarker(t, 0xffffff);
    this.path = res.path;
    // 隣のマスをタップした時（目の前の人・物）や、行った先で調べたい時
    const hiddenAtGoal = objectAt(this.map, save, t.x, t.y)?.kind === 'hidden';
    this.pendingInteract = res.interact ?? (hiddenAtGoal ? t : null);
    if (!this.moving) this.nextStep();
  }

  private flashMarker(t: Pos, color: number): void {
    this.marker.clear();
    this.marker.lineStyle(4, color, 0.9).strokeRoundedRect(t.x * TILE + 4, t.y * TILE + 4, TILE - 8, TILE - 8, 8);
    this.marker.setAlpha(1);
    this.tweens.killTweensOf(this.marker);
    this.tweens.add({ targets: this.marker, alpha: 0, duration: 500, delay: 150 });
  }

  /** 1歩進む */
  private nextStep(): void {
    if (this.busy) {
      this.moving = false;
      return;
    }
    const next = this.path.shift();
    if (!next) {
      this.moving = false;
      if (this.pendingInteract) {
        const target = this.pendingInteract;
        this.pendingInteract = null;
        this.interactAt(target);
      }
      return;
    }
    const save = session.data;
    if (!canStand(this.map, save, next.x, next.y)) {
      this.path = [];
      this.moving = false;
      audio.se('bump');
      return;
    }
    this.moving = true;
    this.facing = facingTo(this.pos, next);
    this.pos = next;
    const frame = FACING_FRAME[this.facing];
    this.player.setFrame(frame + 1);
    this.tweens.add({
      targets: this.player,
      x: next.x * TILE + TILE / 2,
      y: next.y * TILE + TILE * 0.88,
      duration: STEP_MS,
      onComplete: () => {
        this.player.setFrame(frame);
        void this.afterStep();
      },
    });
  }

  private async afterStep(): Promise<void> {
    const save = session.data;
    save.location = { mapId: this.map.id, x: this.pos.x, y: this.pos.y, facing: this.facing };
    save.stats.steps++;
    this.host.onStep(this);
    // ワープ
    const warp = this.map.warps.find((w) => w.x === this.pos.x && w.y === this.pos.y);
    if (warp) {
      this.path = [];
      this.pendingInteract = null;
      this.moving = false;
      this.busy = true;
      audio.se('door');
      this.cameras.main.fadeOut(160, 0, 0, 0);
      this.cameras.main.once('camerafadeoutcomplete', () => {
        this.scene.restart({ mapId: warp.to.mapId, x: warp.to.x, y: warp.to.y, facing: warp.to.facing, host: this.host });
      });
      return;
    }
    // トレーナーに見つかる
    const spotter = trainerSpotting(this.map, save, this.pos.x, this.pos.y);
    if (spotter) {
      this.path = [];
      this.pendingInteract = null;
      this.moving = false;
      await this.trainerApproach(spotter);
      return;
    }
    // 草むら
    const enc = rollEncounter(this.map, this.pos.x, this.pos.y, mathRng);
    if (enc) {
      this.path = [];
      this.pendingInteract = null;
      this.moving = false;
      this.busy = true;
      await this.host.onWildEncounter(this, enc.speciesId, enc.level);
      this.busy = false;
      return;
    }
    this.nextStep();
  }

  private async trainerApproach(npc: NpcDef): Promise<void> {
    this.busy = true;
    const view = this.npcs.get(npc.id);
    audio.se('spotted');
    const mark = view?.sprite.getData('mark') as Phaser.GameObjects.Text | undefined;
    if (mark) {
      mark.setAlpha(1);
      await this.wait(600);
      mark.setAlpha(0);
    }
    let last: Pos = { x: npc.x, y: npc.y };
    if (view) {
      for (const p of approachPath(npc, this.pos.x, this.pos.y)) {
        last = p;
        await new Promise<void>((r) => this.tweens.add({ targets: view.sprite, x: p.x * TILE + TILE / 2, y: p.y * TILE + TILE * 0.88, duration: STEP_MS, onComplete: () => r() }));
        if (mark) {
          mark.x = view.sprite.x;
          mark.y = view.sprite.y - TILE * 1.2;
        }
      }
    }
    this.face(facingTo(this.pos, last));
    await this.host.onTrainerSpotted(this, npc);
    // 元の位置に戻す
    if (view) this.placeAt(view.sprite, npc);
    this.busy = false;
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => this.time.delayedCall(ms, () => r()));
  }

  face(f: Facing): void {
    this.facing = f;
    this.player.setFrame(FACING_FRAME[f]);
  }

  /** 目の前（または足元）を調べる */
  private interactAt(t: Pos): void {
    const save = session.data;
    if (Math.abs(t.x - this.pos.x) + Math.abs(t.y - this.pos.y) > 1) return;
    if (t.x !== this.pos.x || t.y !== this.pos.y) this.face(facingTo(this.pos, t));
    const npc = npcAt(this.map, save, t.x, t.y);
    if (npc) {
      void this.runNpc(npc);
      return;
    }
    const obj = objectAt(this.map, save, t.x, t.y);
    if (obj) void this.runInteract(obj);
  }

  private async runNpc(npc: NpcDef): Promise<void> {
    this.busy = true;
    const view = this.npcs.get(npc.id);
    if (view && view.sprite instanceof Phaser.GameObjects.Sprite) {
      const towards = facingTo(npc, this.pos);
      view.sprite.setFrame(FACING_FRAME[towards]);
    }
    try {
      await this.host.onInteractNpc(this, npc);
    } finally {
      if (view && view.sprite.active && view.sprite instanceof Phaser.GameObjects.Sprite) view.sprite.setFrame(FACING_FRAME[npc.facing]);
      this.busy = false;
    }
  }

  private async runInteract(obj: ObjectDef): Promise<void> {
    this.busy = true;
    try {
      await this.host.onInteractObject(this, obj);
    } finally {
      this.busy = false;
    }
  }

  /** 決定キー（キーボード用）：目の前を調べる */
  private interactFront(): void {
    const d = DIRS[this.facing];
    this.interactAt({ x: this.pos.x + d.x, y: this.pos.y + d.y });
  }

  /** 画面の「しらべる」ボタン：目の前の人や物を調べる */
  pressAction(): void {
    if (this.busy || this.moving) return;
    this.path = [];
    this.pendingInteract = null;
    this.interactFront();
  }

  update(): void {
    if (this.player) this.updateCamera();
    if (this.busy) this.padTap = null;
    if (this.busy || this.moving) return;
    const k = this.keys;
    const keyDir: Facing | null = !k ? null : k.up.isDown ? 'up' : k.down.isDown ? 'down' : k.left.isDown ? 'left' : k.right.isDown ? 'right' : null;
    const dir = this.padDir ?? this.padTap ?? keyDir;
    this.padTap = null;
    if (dir) {
      this.pendingInteract = null;
      const d = DIRS[dir];
      const next = { x: this.pos.x + d.x, y: this.pos.y + d.y };
      if (canStand(this.map, session.data, next.x, next.y)) {
        this.path = [next];
        this.nextStep();
      } else this.face(dir);
    } else if (k && (Phaser.Input.Keyboard.JustDown(k.a) || Phaser.Input.Keyboard.JustDown(k.b))) this.interactFront();
  }

  /** 台本から：その場で別のマップへ移動 */
  warpTo(mapId: string, x: number, y: number, facing: Facing): void {
    this.busy = true;
    this.cameras.main.fadeOut(200, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.restart({ mapId, x, y, facing, host: this.host }));
  }

  /** NPCの表示条件（デバッグ・テスト用） */
  npcVisible(id: string): boolean {
    const def = this.map.npcs.find((n) => n.id === id);
    return !!def && checkCondition(session.data, def.showIf);
  }
}
