import Phaser from 'phaser';

/** タイトルの背景（夜明け前の群島と、ただよう灯） */
export class TitleScene extends Phaser.Scene {
  constructor() {
    super('title');
  }

  create(): void {
    const { width: W, height: H } = this.scale;
    const g = this.add.graphics();
    const steps = 24;
    for (let i = 0; i < steps; i++) {
      const t = i / (steps - 1);
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(0x1d1640),
        Phaser.Display.Color.ValueToColor(0xf08a5a),
        100,
        Math.pow(t, 1.6) * 100,
      );
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1);
      g.fillRect(0, (H * i) / steps, W, H / steps + 2);
    }
    // 星
    for (let i = 0; i < 70; i++) {
      const s = this.add.circle(Math.random() * W, Math.random() * H * 0.5, Math.random() * 2 * (W / 400) + 0.5, 0xffffff, Math.random() * 0.8 + 0.2);
      this.tweens.add({ targets: s, alpha: 0.1, duration: 1000 + Math.random() * 2000, yoyo: true, repeat: -1, delay: Math.random() * 2000 });
    }
    // 島のシルエット
    const isl = this.add.graphics();
    isl.fillStyle(0x2b1d44, 1);
    const base = H * 0.78;
    isl.fillEllipse(W * 0.2, base, W * 0.7, H * 0.12);
    isl.fillEllipse(W * 0.85, base + H * 0.02, W * 0.6, H * 0.1);
    isl.fillStyle(0x1d1630, 1);
    isl.fillRect(0, base + H * 0.03, W, H);
    // 海の光
    for (let i = 0; i < 8; i++) {
      const l = this.add.rectangle(W * 0.5, base + H * 0.06 + i * H * 0.02, W * (0.5 - i * 0.05), 2 * (W / 400), 0xffcf6b, 0.25);
      this.tweens.add({ targets: l, alpha: 0.05, duration: 900 + i * 200, yoyo: true, repeat: -1 });
    }
    // 灯獣のシルエット（ヒノコロ・シズクン・メブキン）
    const mons = ['hinokoro', 'shizukun', 'mebukin'];
    mons.forEach((m, i) => {
      if (!this.textures.exists(`mon:${m}`)) return;
      const img = this.add.image(W * (0.25 + i * 0.25), base - H * 0.02, `mon:${m}`);
      img.setScale((W * 0.24) / 320);
      img.setOrigin(0.5, 0.9);
      this.tweens.add({ targets: img, y: img.y - H * 0.012, duration: 1400 + i * 300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    });
    // ただよう灯
    for (let i = 0; i < 26; i++) this.spawnLight(W, H, true);
    this.time.addEvent({ delay: 500, loop: true, callback: () => this.spawnLight(W, H, false) });
  }

  private spawnLight(W: number, H: number, initial: boolean): void {
    const r = (Math.random() * 4 + 2) * (W / 400);
    const x = Math.random() * W;
    const y = initial ? Math.random() * H : H + 10;
    const glow = this.add.circle(x, y, r * 3, 0xffcf6b, 0.15);
    const core = this.add.circle(x, y, r, 0xfff3c0, 0.9);
    const dur = 7000 + Math.random() * 6000;
    this.tweens.add({
      targets: [glow, core],
      y: y - H * (0.6 + Math.random() * 0.5),
      x: x + (Math.random() - 0.5) * W * 0.2,
      alpha: 0,
      duration: dur,
      onComplete: () => {
        glow.destroy();
        core.destroy();
      },
    });
  }
}
