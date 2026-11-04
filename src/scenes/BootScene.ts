import Phaser from 'phaser';
import { monsterImageUrl } from '../art/monsterArt';
import { SPECIES_LIST } from '../data/species';

/** 仮イラスト（SVG）をテクスチャにしてから次の画面へ進む */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('boot');
  }

  async create(): Promise<void> {
    await loadMonsterTextures(this);
    this.game.events.emit('boot-ready');
  }
}

export async function loadMonsterTextures(scene: Phaser.Scene): Promise<void> {
  const SIZE = 320;
  await Promise.all(
    SPECIES_LIST.map(async (s) => {
      const key = `mon:${s.art}`;
      if (scene.textures.exists(key)) return;
      try {
        const img = new Image();
        img.src = monsterImageUrl(s.art);
        await img.decode();
        const c = document.createElement('canvas');
        c.width = SIZE;
        c.height = SIZE;
        c.getContext('2d')!.drawImage(img, 0, 0, SIZE, SIZE);
        scene.textures.addCanvas(key, c);
      } catch (e) {
        // 1枚読めなくても止めない（灰色の丸で代用）
        console.warn('texture failed', s.art, e);
        const c = document.createElement('canvas');
        c.width = SIZE;
        c.height = SIZE;
        const g = c.getContext('2d')!;
        g.fillStyle = '#bbb';
        g.beginPath();
        g.arc(SIZE / 2, SIZE / 2, SIZE / 3, 0, 6.28);
        g.fill();
        scene.textures.addCanvas(key, c);
      }
    }),
  );
}
