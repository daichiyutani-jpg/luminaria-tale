/**
 * 戦闘の見た目（背景・モンスター・演出）。操作パネルと文字は DOM（src/ui/battleUI.ts）。
 */
import Phaser from 'phaser';
import type { StatusId } from '../core/types';
import { battleLayout } from '../ui/battleLayout';

export type Backdrop = 'field' | 'forest' | 'town' | 'indoor' | 'boss';

const STATUS_COLOR: Record<StatusId, number> = { burn: 0xff7a3a, poison: 0xb05ad0, paralyze: 0xffe03a, sleep: 0x9fb0c8, mist: 0x5a4a8a };

export class BattleScene extends Phaser.Scene {
  private enemy!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Image;
  private enemyHome = { x: 0, y: 0 };
  private playerHome = { x: 0, y: 0 };
  private fast = false;
  private bgGfx!: Phaser.GameObjects.Graphics;
  private backdrop: Backdrop = 'field';
  ready = false;

  constructor() {
    super('battle');
  }

  init(data: { backdrop: Backdrop; enemyArt: string; playerArt: string | null; fast: boolean; onReady: () => void }): void {
    this.backdrop = data.backdrop;
    this.fast = data.fast;
    this.ready = false;
    this.events.once('create', () => data.onReady());
    this.registry.set('battleInit', data);
  }

  create(): void {
    const data = this.registry.get('battleInit') as { enemyArt: string; playerArt: string | null };
    this.bgGfx = this.add.graphics();
    this.layout();
    this.enemy = this.add.image(this.enemyHome.x, this.enemyHome.y, `mon:${data.enemyArt}`).setOrigin(0.5, 0.9);
    this.player = this.add.image(this.playerHome.x, this.playerHome.y, data.playerArt ? `mon:${data.playerArt}` : `mon:${data.enemyArt}`).setOrigin(0.5, 0.9);
    this.player.setFlipX(true);
    this.player.setVisible(!!data.playerArt);
    this.sizeSprites();
    // 登場演出
    this.enemy.x += this.scale.width;
    this.tweens.add({ targets: this.enemy, x: this.enemyHome.x, duration: this.fast ? 200 : 450, ease: 'Cubic.out' });
    this.startBreath();
    this.scale.on('resize', this.onResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.onResize, this));
    this.ready = true;
  }

  private breath: Phaser.Tweens.Tween | null = null;

  /** 敵がゆっくり息をする動き（大きさが変わったら作り直す） */
  private startBreath(): void {
    this.breath?.stop();
    this.breath = this.tweens.add({ targets: this.enemy, scaleY: this.enemy.scaleX * 1.03, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  }

  private onResize(): void {
    this.layout();
    this.enemy.setPosition(this.enemyHome.x, this.enemyHome.y);
    this.player.setPosition(this.playerHome.x, this.playerHome.y);
    const visible = this.enemy.alpha > 0.5;
    this.breath?.stop();
    this.sizeSprites();
    if (visible) this.startBreath();
  }

  private layout(): void {
    const W = this.scale.width;
    const H = this.scale.height;
    const L = this.cssLayout();
    const k = this.cssScale();
    this.enemyHome = { x: L.enemy.x * k, y: L.enemy.y * k };
    this.playerHome = { x: L.player.x * k, y: L.player.y * k };
    const g = this.bgGfx;
    g.clear();
    const skies: Record<Backdrop, [number, number, number]> = {
      field: [0x8fd3ff, 0xd8f3ff, 0x8fd36a],
      town: [0xffd9a8, 0xfff1d6, 0xb8d98a],
      forest: [0x1f3d33, 0x3f6b4a, 0x2f5a3a],
      indoor: [0xe6d3b5, 0xf5ead8, 0xc8a477],
      boss: [0x1d0f2d, 0x4a2a5a, 0x2b3d2a],
    };
    const [top, mid, ground] = skies[this.backdrop];
    const hz = this.enemyHome.y * 0.62;
    const es = L.enemy.size * k;
    const ps = L.player.size * k;
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(top), Phaser.Display.Color.ValueToColor(mid), steps, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (hz * i) / steps, W, hz / steps + 1);
    }
    // 地面：地平線から手前へ明るくなる
    for (let i = 0; i < steps; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(Phaser.Display.Color.ValueToColor(ground).darken(18), Phaser.Display.Color.ValueToColor(ground).lighten(8), steps, i);
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, hz + ((H - hz) * i) / steps, W, (H - hz) / steps + 1);
    }
    // 足場
    g.fillStyle(0x000000, 0.12);
    g.fillEllipse(this.enemyHome.x, this.enemyHome.y - es * 0.02, es * 1.15, es * 0.2);
    g.fillEllipse(this.playerHome.x, this.playerHome.y - ps * 0.02, ps * 1.2, ps * 0.2);
    g.fillStyle(0xffffff, 0.18);
    g.fillEllipse(this.enemyHome.x, this.enemyHome.y - es * 0.04, es * 1.0, es * 0.13);
    g.fillEllipse(this.playerHome.x, this.playerHome.y - ps * 0.04, ps * 1.05, ps * 0.13);
    if (this.backdrop === 'forest' || this.backdrop === 'boss') {
      for (let i = 0; i < 18; i++) {
        g.fillStyle(this.backdrop === 'boss' ? 0xd9ff5a : 0xfff3a0, 0.5);
        g.fillCircle((W * ((i * 37) % 100)) / 100, hz * (0.1 + ((i * 53) % 80) / 100), 2 + (i % 3));
      }
    }
  }

  private sizeSprites(): void {
    const L = this.cssLayout();
    const k = this.cssScale();
    this.enemy.setScale((L.enemy.size * k) / 320);
    this.player.setScale((L.player.size * k) / 320);
  }

  /** ゲーム画面のピクセル ÷ CSS ピクセル（高解像度の端末では 2 など） */
  private cssScale(): number {
    const cw = this.game.canvas.clientWidth;
    return cw > 0 ? this.scale.width / cw : 1;
  }

  private cssLayout() {
    const k = this.cssScale();
    return battleLayout(this.scale.width / k, this.scale.height / k);
  }

  private sprite(side: 0 | 1) {
    return side === 0 ? this.player : this.enemy;
  }

  private dur(ms: number): number {
    return this.fast ? Math.round(ms * 0.45) : ms;
  }

  private tween(cfg: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
    return new Promise((resolve) => {
      if (!this.sys.isActive()) return resolve();
      this.tweens.add({ ...cfg, onComplete: () => resolve() });
    });
  }

  async attack(side: 0 | 1): Promise<void> {
    const s = this.sprite(side);
    const home = side === 0 ? this.playerHome : this.enemyHome;
    const dx = (side === 0 ? 1 : -1) * this.scale.width * 0.08;
    const dy = (side === 0 ? -1 : 1) * this.scale.height * 0.03;
    await this.tween({ targets: s, x: home.x + dx, y: home.y + dy, duration: this.dur(110), yoyo: true, ease: 'Quad.out' });
    s.setPosition(home.x, home.y);
  }

  async hit(side: 0 | 1, eff = 1): Promise<void> {
    const s = this.sprite(side);
    const home = side === 0 ? this.playerHome : this.enemyHome;
    if (eff > 1) this.cameras.main.shake(this.dur(220), 0.012);
    const spark = this.add.star(s.x, s.y - s.displayHeight * 0.45, 6, s.displayWidth * 0.08, s.displayWidth * (eff > 1 ? 0.32 : 0.22), 0xffffff, 0.95);
    this.tween({ targets: spark, scale: 1.6, alpha: 0, duration: this.dur(260) }).then(() => spark.destroy());
    for (let i = 0; i < 3; i++) {
      s.setAlpha(0.2);
      await this.wait(this.dur(55));
      s.setAlpha(1);
      await this.wait(this.dur(55));
    }
    await this.tween({ targets: s, x: home.x + 8, duration: this.dur(40), yoyo: true, repeat: 1 });
    s.setPosition(home.x, home.y);
  }

  async heal(side: 0 | 1): Promise<void> {
    const s = this.sprite(side);
    for (let i = 0; i < 6; i++) {
      const p = this.add.circle(s.x + (Math.random() - 0.5) * s.displayWidth * 0.6, s.y - Math.random() * s.displayHeight * 0.4, 5, 0x9fffa0, 0.9);
      void this.tween({ targets: p, y: p.y - s.displayHeight * 0.4, alpha: 0, duration: this.dur(600), delay: i * 60 }).then(() => p.destroy());
    }
    await this.wait(this.dur(400));
  }

  async statusFx(side: 0 | 1, status: StatusId): Promise<void> {
    const s = this.sprite(side);
    s.setTint(STATUS_COLOR[status]);
    await this.wait(this.dur(300));
    s.clearTint();
  }

  async statFx(side: 0 | 1, up: boolean): Promise<void> {
    const s = this.sprite(side);
    for (let i = 0; i < 5; i++) {
      const tri = this.add.triangle(s.x + (i - 2) * s.displayWidth * 0.16, s.y - s.displayHeight * (up ? 0.2 : 0.8), 0, up ? 12 : 0, 8, up ? 0 : 12, 16, up ? 12 : 0, up ? 0xff8a5a : 0x5a8aff, 0.85);
      void this.tween({ targets: tri, y: tri.y + (up ? -1 : 1) * s.displayHeight * 0.4, alpha: 0, duration: this.dur(500), delay: i * 50 }).then(() => tri.destroy());
    }
    await this.wait(this.dur(450));
  }

  async faint(side: 0 | 1): Promise<void> {
    const s = this.sprite(side);
    await this.tween({ targets: s, y: s.y + s.displayHeight * 0.3, alpha: 0, duration: this.dur(420), ease: 'Quad.in' });
    s.setVisible(false);
  }

  async withdraw(side: 0 | 1): Promise<void> {
    const s = this.sprite(side);
    await this.tween({ targets: s, scale: s.scale * 0.1, alpha: 0, duration: this.dur(240) });
    s.setVisible(false);
  }

  async sendOut(side: 0 | 1, art: string): Promise<void> {
    const s = this.sprite(side);
    const home = side === 0 ? this.playerHome : this.enemyHome;
    s.setTexture(`mon:${art}`);
    s.setVisible(true);
    s.setAlpha(0);
    s.setPosition(home.x, home.y);
    s.clearTint();
    this.sizeSprites();
    const target = s.scale;
    s.setScale(target * 0.2);
    const flash = this.add.circle(home.x, home.y - s.displayHeight * 2, 40, 0xffffff, 0.9);
    void this.tween({ targets: flash, scale: 3, alpha: 0, duration: this.dur(300) }).then(() => flash.destroy());
    await this.tween({ targets: s, scale: target, alpha: 1, duration: this.dur(280), ease: 'Back.out' });
  }

  private lantern: Phaser.GameObjects.Container | null = null;

  async throwLantern(): Promise<void> {
    const c = this.add.container(this.playerHome.x, this.playerHome.y - this.scale.height * 0.1);
    const g = this.add.graphics();
    const r = Math.min(this.scale.width, this.scale.height) * 0.035;
    g.fillStyle(0x4a4542, 1).fillRect(-r * 0.9, -r * 1.4, r * 1.8, r * 0.4);
    g.fillStyle(0xffd166, 1).fillRoundedRect(-r * 0.7, -r, r * 1.4, r * 1.8, 6);
    g.lineStyle(3, 0x2b2233, 1).strokeRoundedRect(-r * 0.7, -r, r * 1.4, r * 1.8, 6);
    g.fillStyle(0x4a4542, 1).fillRect(-r * 0.9, r * 0.8, r * 1.8, r * 0.4);
    const glow = this.add.circle(0, 0, r * 2, 0xffd166, 0.3);
    c.add([glow, g]);
    this.lantern = c;
    const tx = this.enemyHome.x;
    const ty = this.enemyHome.y - this.enemy.displayHeight * 0.4;
    await this.tween({ targets: c, x: tx, duration: this.dur(420), ease: 'Linear' });
    // 放物線は y を別にアニメーション
    c.y = ty;
    // 吸い込まれる
    await this.tween({ targets: this.enemy, scale: this.enemy.scale * 0.05, alpha: 0, duration: this.dur(300) });
    await this.tween({ targets: c, y: this.enemyHome.y - r * 1.2, duration: this.dur(200), ease: 'Bounce.out' });
  }

  async shakeLantern(): Promise<void> {
    if (!this.lantern) return;
    await this.tween({ targets: this.lantern, angle: 18, duration: this.dur(120), yoyo: true });
    await this.tween({ targets: this.lantern, angle: -18, duration: this.dur(120), yoyo: true });
    await this.wait(this.dur(250));
  }

  async captureResult(success: boolean): Promise<void> {
    if (!this.lantern) return;
    if (success) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const st = this.add.star(this.lantern.x, this.lantern.y, 5, 4, 10, 0xfff3a0, 1);
        void this.tween({ targets: st, x: st.x + Math.cos(a) * 80, y: st.y + Math.sin(a) * 80, alpha: 0, duration: this.dur(600) }).then(() => st.destroy());
      }
      this.lantern.setAlpha(0.9);
      await this.wait(this.dur(500));
    } else {
      this.lantern.destroy();
      this.lantern = null;
      const flash = this.add.circle(this.enemyHome.x, this.enemyHome.y - this.enemy.displayHeight * 0.4, 30, 0xffffff, 1);
      void this.tween({ targets: flash, scale: 4, alpha: 0, duration: this.dur(300) }).then(() => flash.destroy());
      this.sizeSprites();
      const target = this.enemy.scale;
      this.enemy.setScale(target * 0.1);
      await this.tween({ targets: this.enemy, scale: target, alpha: 1, duration: this.dur(280), ease: 'Back.out' });
    }
  }

  wait(ms: number): Promise<void> {
    return new Promise((r) => {
      if (!this.sys.isActive()) return r();
      this.time.delayedCall(ms, () => r());
    });
  }

  setFast(f: boolean): void {
    this.fast = f;
  }
}
