/**
 * 【仮素材】フィールドのタイルと人物をコード（Canvas）で描く。
 */
import type { MapDef } from '../data/maps';

export const TILE = 48;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return `rgb(${r},${g},${b})`;
}

/** 左上から光が当たった丸い塊（葉の茂み・岩など）を放射グラデーションで塗る */
function litBlob(g: CanvasRenderingContext2D, x: number, y: number, r: number, col: string, light = 34, dark = -40): void {
  const grd = g.createRadialGradient(x - r * 0.4, y - r * 0.45, r * 0.1, x, y, r * 1.05);
  grd.addColorStop(0, shade(col, light));
  grd.addColorStop(0.55, col);
  grd.addColorStop(1, shade(col, dark));
  g.fillStyle = grd;
  g.beginPath();
  g.arc(x, y, r, 0, 6.28);
  g.fill();
}

/** 地面に落ちるやわらかい影 */
function softShadow(g: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, a = 0.32): void {
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const grd = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grd.addColorStop(0, `rgba(10,20,10,${a})`);
  grd.addColorStop(0.6, `rgba(10,20,10,${a * 0.6})`);
  grd.addColorStop(1, 'rgba(10,20,10,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(0, 0, rx, 0, 6.28);
  g.fill();
  g.restore();
}

/**
 * 仕上げ：絵全体に「きめ」（細かいざらつき）と、ゆるやかな明暗のむらをつける。
 * のっぺりした単色の面が、土・草・木目のように見えるようになる。
 */
function finishTexture(g: CanvasRenderingContext2D, w: number, h: number, seed: number, grain = 14, mottle = 16): void {
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const r = rng(seed);
  const CELL = 64;
  const gw = Math.ceil(w / CELL) + 2;
  const gh = Math.ceil(h / CELL) + 2;
  const grid = new Float32Array(gw * gh).map(() => r() * 2 - 1);
  const sm = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < h; y++) {
    const gy = y / CELL;
    const y0 = Math.floor(gy);
    const ty = sm(gy - y0);
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] === 0) continue;
      const gx = x / CELL;
      const x0 = Math.floor(gx);
      const tx = sm(gx - x0);
      const a = grid[y0 * gw + x0];
      const b = grid[y0 * gw + x0 + 1];
      const c2 = grid[(y0 + 1) * gw + x0];
      const e = grid[(y0 + 1) * gw + x0 + 1];
      const low = (a + (b - a) * tx) * (1 - ty) + (c2 + (e - c2) * tx) * ty;
      const n = (r() - 0.5) * grain + low * mottle;
      d[i] = Math.max(0, Math.min(255, d[i] + n));
      d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
      d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.85));
    }
  }
  g.putImageData(img, 0, 0);
}

/** マップ全体を1枚の絵にする（地面・道・草・木・建物など。動く物は別） */
export function drawMapCanvas(map: MapDef, barrierOpen: boolean): HTMLCanvasElement {
  const w = map.tiles[0].length;
  const hgt = map.tiles.length;
  const c = document.createElement('canvas');
  c.width = w * TILE;
  c.height = hgt * TILE;
  const g = c.getContext('2d')!;
  const p = map.palette;
  const r = rng(map.id.length * 977 + w * 31);
  const T = TILE;
  const at = (x: number, y: number) => (y < 0 || y >= hgt || x < 0 || x >= w ? 'T' : map.tiles[y][x]);

  // 1) 下地
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      const px = x * T;
      const py = y * T;
      const indoor = map.kind === 'indoor';
      if (indoor) {
        g.fillStyle = (x + y) % 2 ? p.ground : shade(p.ground, -8);
        g.fillRect(px, py, T, T);
        g.strokeStyle = shade(p.ground, -22);
        g.lineWidth = 1;
        g.strokeRect(px + 0.5, py + 0.5, T - 1, T - 1);
      } else {
        g.fillStyle = p.ground;
        g.fillRect(px, py, T, T);
        for (let i = 0; i < 3; i++) {
          g.fillStyle = shade(p.ground, r() > 0.5 ? 10 : -10);
          g.fillRect(px + r() * T, py + r() * T, 3, 3);
        }
      }
      if (ch === ',' || ch === 'B' || (ch === 'D' && !indoor)) {
        g.fillStyle = p.path;
        g.fillRect(px, py, T, T);
        g.fillStyle = shade(p.path, -14);
        for (let i = 0; i < 4; i++) g.fillRect(px + r() * T, py + r() * T, 4, 3);
      }
    }

  // 2) 地形
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      const px = x * T;
      const py = y * T;
      const cx = px + T / 2;
      switch (ch) {
        case '"': {
          // 草むら：濃い根元から明るい先端へ、細い葉を何本も重ねる
          g.fillStyle = shade(p.grass, -26);
          g.fillRect(px, py, T, T);
          for (let row = 0; row < 4; row++) {
            const baseY = py + 14 + row * 10;
            for (let i = 0; i < 9; i++) {
              const bx = px + 1 + i * 5.4 + r() * 3;
              const hgtB = 12 + r() * 9;
              const lean = (r() - 0.5) * 8;
              const grd = g.createLinearGradient(0, baseY, 0, baseY - hgtB);
              grd.addColorStop(0, shade(p.grass, -48));
              grd.addColorStop(0.6, p.grass);
              grd.addColorStop(1, shade(p.grass, 30 + r() * 20));
              g.fillStyle = grd;
              g.beginPath();
              g.moveTo(bx - 2, baseY);
              g.quadraticCurveTo(bx + lean * 0.3, baseY - hgtB * 0.6, bx + lean, baseY - hgtB);
              g.quadraticCurveTo(bx + 1 + lean * 0.3, baseY - hgtB * 0.5, bx + 2.5, baseY);
              g.closePath();
              g.fill();
            }
          }
          break;
        }
        case 'f': {
          const colors = ['#ff8fb6', '#ffe27a', '#ffffff', '#b59bff'];
          for (let i = 0; i < 3; i++) {
            const fx = px + 8 + r() * (T - 16);
            const fy = py + 8 + r() * (T - 16);
            g.fillStyle = colors[Math.floor(r() * colors.length)];
            for (let k = 0; k < 5; k++) {
              g.beginPath();
              g.arc(fx + Math.cos((k / 5) * 6.28) * 3.5, fy + Math.sin((k / 5) * 6.28) * 3.5, 3, 0, 6.28);
              g.fill();
            }
            g.fillStyle = '#f6b13a';
            g.beginPath();
            g.arc(fx, fy, 2.2, 0, 6.28);
            g.fill();
          }
          break;
        }
        case '~': {
          const wg = g.createLinearGradient(px, py, px, py + T);
          wg.addColorStop(0, '#3f8fc6');
          wg.addColorStop(1, '#2a6ea3');
          g.fillStyle = wg;
          g.fillRect(px, py, T, T);
          for (let i = 0; i < 3; i++) {
            const wy = py + 10 + i * 14 + r() * 4;
            const wx = px + r() * 16;
            g.strokeStyle = `rgba(210,240,255,${0.35 + r() * 0.35})`;
            g.lineWidth = 1.5;
            g.beginPath();
            g.moveTo(wx, wy);
            g.quadraticCurveTo(wx + 8, wy - 3, wx + 16, wy);
            g.quadraticCurveTo(wx + 24, wy + 3, wx + 30, wy);
            g.stroke();
          }
          g.fillStyle = 'rgba(255,255,255,.75)';
          g.fillRect(px + r() * T, py + r() * T, 2, 2);
          if (at(x, y - 1) !== '~' && at(x, y - 1) !== 'B') {
            const sg = g.createLinearGradient(0, py, 0, py + 9);
            sg.addColorStop(0, '#e8d7a8');
            sg.addColorStop(0.6, '#c9b07a');
            sg.addColorStop(1, 'rgba(60,110,150,0)');
            g.fillStyle = sg;
            g.fillRect(px, py, T, 9);
          }
          break;
        }
        case 'B': {
          g.fillStyle = '#4aa3df';
          g.fillRect(px, py, T, T);
          g.fillStyle = '#b07a46';
          g.fillRect(px + 4, py, T - 8, T);
          g.strokeStyle = '#7a5030';
          g.lineWidth = 2;
          for (let i = 0; i < 4; i++) {
            g.beginPath();
            g.moveTo(px + 4, py + i * 12 + 6);
            g.lineTo(px + T - 4, py + i * 12 + 6);
            g.stroke();
          }
          break;
        }
        case 'F':
          g.fillStyle = '#c8935a';
          g.fillRect(px, py + 18, T, 6);
          g.fillRect(px + 6, py + 8, 6, 30);
          g.fillRect(px + T - 12, py + 8, 6, 30);
          break;
        case 'R': {
          softShadow(g, cx + 4, py + T - 8, 22, 7);
          const rg = g.createLinearGradient(px + 8, py + 8, px + 40, py + T - 8);
          rg.addColorStop(0, '#c9c3ba');
          rg.addColorStop(0.5, '#958f87');
          rg.addColorStop(1, '#5e5852');
          g.fillStyle = rg;
          g.strokeStyle = '#4a4542';
          g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(px + 8, py + T - 10);
          g.lineTo(px + 11, py + 18);
          g.lineTo(px + 24, py + 8);
          g.lineTo(px + 38, py + 13);
          g.lineTo(px + 43, py + T - 10);
          g.closePath();
          g.fill();
          g.stroke();
          g.strokeStyle = 'rgba(40,36,34,.5)';
          g.beginPath();
          g.moveTo(px + 24, py + 9);
          g.lineTo(px + 22, py + 24);
          g.lineTo(px + 30, py + 34);
          g.stroke();
          g.fillStyle = 'rgba(255,255,255,.35)';
          g.beginPath();
          g.moveTo(px + 13, py + 19);
          g.lineTo(px + 23, py + 11);
          g.lineTo(px + 20, py + 22);
          g.closePath();
          g.fill();
          break;
        }
        case 'W':
          g.fillStyle = '#8a6d55';
          g.fillRect(px, py, T, T);
          g.fillStyle = '#a5876c';
          g.fillRect(px, py + T - 12, T, 12);
          g.fillStyle = 'rgba(255,255,255,.12)';
          g.fillRect(px + 4, py + 4, T - 8, 6);
          break;
        case 'D':
          if (map.kind === 'indoor') {
            g.fillStyle = '#b5814f';
            g.fillRect(px + 6, py, T - 12, T);
            g.fillStyle = '#ffe9b0';
            g.fillRect(px + 10, py + T - 10, T - 20, 6);
          }
          break;
      }
    }

  // 3) 屋根と壁（建物）
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      const px = x * T;
      const py = y * T;
      if (ch === '=') {
        const top = at(x, y - 1) !== '=';
        const bottom = at(x, y + 1) !== '=';
        let base = map.id === 'village' && x > 9 ? '#c4513f' : '#3f73b3';
        if (y > 8) base = '#b97a40';
        const rg = g.createLinearGradient(0, py, 0, py + T);
        rg.addColorStop(0, shade(base, 18));
        rg.addColorStop(1, shade(base, -18));
        g.fillStyle = rg;
        g.fillRect(px, py, T, T);
        // 瓦の段：段ごとに下側を暗く、上側にうすい光
        for (let i = 0; i < 4; i++) {
          const ty = py + i * 12;
          g.fillStyle = 'rgba(0,0,0,.22)';
          g.fillRect(px, ty + 9, T, 3);
          g.fillStyle = 'rgba(255,255,255,.10)';
          g.fillRect(px, ty, T, 2);
          for (let k = 0; k < 4; k++) {
            g.fillStyle = 'rgba(0,0,0,.12)';
            g.fillRect(px + k * 12 + (i % 2) * 6, ty, 1.5, 10);
          }
        }
        if (top) {
          g.fillStyle = shade(base, -30);
          g.fillRect(px, py, T, 5);
          g.fillStyle = 'rgba(255,255,255,.3)';
          g.fillRect(px, py + 5, T, 2);
        }
        if (bottom) {
          g.fillStyle = 'rgba(0,0,0,.3)';
          g.fillRect(px, py + T - 4, T, 4);
        }
      }
      if (ch === '#' || (ch === 'D' && map.kind !== 'indoor')) {
        const wg = g.createLinearGradient(0, py, 0, py + T);
        wg.addColorStop(0, '#e9dcc3');
        wg.addColorStop(1, '#f6ecd8');
        g.fillStyle = wg;
        g.fillRect(px, py, T, T);
        // 柱と土台
        g.fillStyle = '#8a6346';
        g.fillRect(px, py, 3, T);
        g.fillStyle = '#9c8f7e';
        g.fillRect(px, py + T - 6, T, 6);
        if (at(x, y - 1) === '=') {
          const eg = g.createLinearGradient(0, py, 0, py + 14);
          eg.addColorStop(0, 'rgba(0,0,0,.35)');
          eg.addColorStop(1, 'rgba(0,0,0,0)');
          g.fillStyle = eg;
          g.fillRect(px, py, T, 14);
        }
        if (ch === '#') {
          const gg = g.createLinearGradient(px + 12, py + 12, px + T - 12, py + T - 14);
          gg.addColorStop(0, '#d8f2ff');
          gg.addColorStop(0.45, '#7fbfe0');
          gg.addColorStop(1, '#3f7ea3');
          g.fillStyle = '#6b4a32';
          g.fillRect(px + 10, py + 11, T - 20, T - 23);
          g.fillStyle = gg;
          g.fillRect(px + 12, py + 13, T - 24, T - 27);
          g.fillStyle = 'rgba(255,255,255,.45)';
          g.beginPath();
          g.moveTo(px + 14, py + 28);
          g.lineTo(px + 24, py + 14);
          g.lineTo(px + 28, py + 14);
          g.lineTo(px + 18, py + 28);
          g.closePath();
          g.fill();
          g.fillStyle = '#6b4a32';
          g.fillRect(px + T / 2 - 1, py + 13, 2, T - 27);
        } else {
          const dg = g.createLinearGradient(px + 10, 0, px + T - 10, 0);
          dg.addColorStop(0, '#7a4e2d');
          dg.addColorStop(0.5, '#9a653b');
          dg.addColorStop(1, '#6a4226');
          g.fillStyle = '#4a2f1c';
          g.fillRect(px + 8, py + 4, T - 16, T - 4);
          g.fillStyle = dg;
          g.fillRect(px + 10, py + 6, T - 20, T - 6);
          g.strokeStyle = 'rgba(0,0,0,.25)';
          g.lineWidth = 1;
          for (let k = 1; k < 4; k++) {
            g.beginPath();
            g.moveTo(px + 10 + k * 7, py + 7);
            g.lineTo(px + 10 + k * 7, py + T);
            g.stroke();
          }
          litBlob(g, px + T - 16, py + T / 2 + 4, 2.6, '#ffd166', 40, -60);
        }
      }
    }

  // 4) 木（上から重ねて立体感）
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      if (ch !== 'T' && ch !== 'h') continue;
      const px = x * T;
      const py = y * T;
      const cx = px + T / 2;
      softShadow(g, cx + 5, py + T - 6, 22, 7, 0.38);
      const tg = g.createLinearGradient(cx - 5, 0, cx + 5, 0);
      tg.addColorStop(0, '#9a7050');
      tg.addColorStop(1, '#4e3422');
      g.fillStyle = tg;
      g.beginPath();
      g.moveTo(cx - 6, py + T - 4);
      g.lineTo(cx - 4, py + T - 20);
      g.lineTo(cx + 4, py + T - 20);
      g.lineTo(cx + 7, py + T - 4);
      g.closePath();
      g.fill();
      const base = p.tree;
      // 奥の暗い葉 → 手前の明るい葉の順に、光の当たった茂みを重ねる
      const clumps: [number, number, number, number][] = [
        [0, 22, 19, -26],
        [-11, 25, 12, -16],
        [11, 26, 12, -20],
        [-7, 15, 11, -4],
        [8, 15, 11, -8],
        [0, 9, 10, 8],
        [-4, 7, 6, 22],
      ];
      for (const [dx, dy, br, lum] of clumps) litBlob(g, cx + dx, py + dy, br, shade(base, lum), 30, -38);
      for (let i = 0; i < 14; i++) {
        const a = r() * 6.28;
        const rr = r() * 15;
        g.fillStyle = r() > 0.5 ? `rgba(255,255,220,${0.12 + r() * 0.18})` : 'rgba(0,30,0,.18)';
        g.beginPath();
        g.arc(cx + Math.cos(a) * rr - 2, py + 18 + Math.sin(a) * rr * 0.8 - 2, 1.6 + r() * 1.6, 0, 6.28);
        g.fill();
      }
      if (ch === 'h') {
        // 隠し通路：よく見ると少しだけ明るい
        g.fillStyle = 'rgba(255,255,220,.13)';
        g.beginPath();
        g.arc(cx, py + 20, 16, 0, 6.28);
        g.fill();
      }
    }

  // 5) 屋内の家具（台座・ベッド・泉・保管機・看板・灯籠など、マスに描くもの）
  for (let y = 0; y < hgt; y++)
    for (let x = 0; x < w; x++) {
      const ch = at(x, y);
      const px = x * T;
      const py = y * T;
      const cx = px + T / 2;
      if (ch === 'O') {
        g.fillStyle = '#9a7a5a';
        g.fillRect(px + 4, py + 10, T - 8, T - 14);
        g.fillStyle = '#c8a477';
        g.fillRect(px + 4, py + 8, T - 8, 8);
      } else if (ch === 'P' && map.kind === 'indoor' && map.id === 'home') {
        g.fillStyle = '#f2f2f2';
        g.fillRect(px + 4, py + 4, T - 8, T - 6);
        g.fillStyle = '#ef8fb1';
        g.fillRect(px + 4, py + 20, T - 8, T - 22);
        g.fillStyle = '#ffffff';
        g.fillRect(px + 10, py + 8, T - 20, 10);
      } else if (ch === 'P') {
        g.fillStyle = '#7fd1e8';
        g.beginPath();
        g.ellipse(cx, py + T / 2 + 4, 20, 14, 0, 0, 6.28);
        g.fill();
        g.strokeStyle = '#d8d0c0';
        g.lineWidth = 4;
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,.7)';
        g.beginPath();
        g.ellipse(cx - 6, py + T / 2, 6, 3, 0, 0, 6.28);
        g.fill();
      } else if (ch === 'K') {
        g.fillStyle = '#5a6b8a';
        g.fillRect(px + 8, py + 4, T - 16, T - 8);
        g.fillStyle = '#9fe6ff';
        g.fillRect(px + 12, py + 9, T - 24, 14);
        g.fillStyle = '#ffd166';
        g.fillRect(px + 14, py + 30, 6, 6);
        g.fillStyle = '#ff6b6b';
        g.fillRect(px + 26, py + 30, 6, 6);
      } else if (ch === 'S') {
        g.fillStyle = '#7a5537';
        g.fillRect(cx - 3, py + 20, 6, 24);
        g.fillStyle = '#c8935a';
        g.fillRect(px + 6, py + 8, T - 12, 20);
        g.strokeStyle = '#7a5537';
        g.lineWidth = 2;
        g.strokeRect(px + 6, py + 8, T - 12, 20);
        g.fillStyle = '#5a3a22';
        g.fillRect(px + 12, py + 14, T - 24, 2);
        g.fillRect(px + 12, py + 20, T - 28, 2);
      }
    }

  // 6) 黒霞の壁
  if (!barrierOpen) {
    for (let y = 0; y < hgt; y++)
      for (let x = 0; x < w; x++) {
        if (at(x, y) !== 'X') continue;
        const px = x * T;
        const py = y * T;
        const grd = g.createRadialGradient(px + T / 2, py + T / 2, 4, px + T / 2, py + T / 2, T);
        grd.addColorStop(0, 'rgba(30,15,45,.95)');
        grd.addColorStop(1, 'rgba(60,30,80,.55)');
        g.fillStyle = grd;
        g.fillRect(px - 6, py - 6, T + 12, T + 12);
      }
  }
  const indoor = map.kind === 'indoor';
  finishTexture(g, c.width, c.height, map.id.length * 131 + w, indoor ? 8 : 14, indoor ? 8 : 18);
  return c;
}

export interface CharLook {
  body: string;
  hair: string;
}

/** 人物の4方向×2コマのスプライトシート（横8コマ：下0,1 上2,3 左4,5 右6,7） */
export function drawCharacterSheet(look: CharLook, opts: { grunt?: boolean; player?: boolean } = {}): HTMLCanvasElement {
  const FW = 48;
  const FH = 60;
  const c = document.createElement('canvas');
  c.width = FW * 8;
  c.height = FH;
  const g = c.getContext('2d')!;
  const dirs = ['down', 'up', 'left', 'right'] as const;
  const OUTL = 'rgba(30,22,40,.85)';
  const skin = '#f6d2b4';
  dirs.forEach((dir, di) => {
    for (let f = 0; f < 2; f++) {
      const ox = (di * 2 + f) * FW;
      const cx = ox + FW / 2;
      const bob = f ? 1 : 0;
      const side = dir === 'left' || dir === 'right';
      const s = dir === 'left' ? -1 : 1;
      // 影（やわらかく）
      softShadow(g, cx + 2, FH - 5, 14, 4.5, 0.4);
      // 足（ズボン＋靴）
      const step = f ? 3 : -3;
      const leg = (lx: number, ly: number, lh: number) => {
        const lg = g.createLinearGradient(lx, 0, lx + 6, 0);
        lg.addColorStop(0, '#4a4258');
        lg.addColorStop(1, '#2a2434');
        g.fillStyle = lg;
        g.fillRect(lx, ly, 6, lh);
        g.fillStyle = '#5a3a2a';
        g.beginPath();
        g.roundRect(lx - 1, ly + lh - 4, 8, 5, 2);
        g.fill();
      };
      if (side) {
        leg(cx - 5 + step, FH - 17, 12);
        leg(cx - 1 - step, FH - 17, 12);
      } else {
        leg(cx - 8, FH - 17 + (f ? 2 : 0), 12 - (f ? 2 : 0));
        leg(cx + 2, FH - 17 + (f ? 0 : 2), 12 - (f ? 0 : 2));
      }
      // 腕（体の後ろ側）
      const armSwing = f ? 2 : -2;
      g.fillStyle = shade(look.body, -30);
      if (!side) {
        g.beginPath();
        g.roundRect(cx - 16, FH - 32 - bob + armSwing, 5, 15, 2.5);
        g.roundRect(cx + 11, FH - 32 - bob - armSwing, 5, 15, 2.5);
        g.fill();
        g.fillStyle = skin;
        g.beginPath();
        g.arc(cx - 13.5, FH - 17 - bob + armSwing, 2.6, 0, 6.28);
        g.arc(cx + 13.5, FH - 17 - bob - armSwing, 2.6, 0, 6.28);
        g.fill();
      }
      // 体（服）：左上から光が当たる
      const bg = g.createLinearGradient(cx - 12, FH - 34, cx + 12, FH - 12);
      bg.addColorStop(0, shade(look.body, 34));
      bg.addColorStop(0.5, look.body);
      bg.addColorStop(1, shade(look.body, -42));
      g.fillStyle = bg;
      g.strokeStyle = OUTL;
      g.lineWidth = 1.4;
      g.beginPath();
      g.roundRect(cx - 12, FH - 34 - bob, 24, 21, 7);
      g.fill();
      g.stroke();
      // 服のしわ・えり
      g.strokeStyle = 'rgba(0,0,0,.18)';
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(cx - 6, FH - 22 - bob);
      g.quadraticCurveTo(cx - 2, FH - 18 - bob, cx - 4, FH - 14 - bob);
      g.moveTo(cx + 6, FH - 24 - bob);
      g.quadraticCurveTo(cx + 3, FH - 19 - bob, cx + 5, FH - 14 - bob);
      g.stroke();
      if (dir === 'down') {
        g.fillStyle = 'rgba(255,255,255,.55)';
        g.beginPath();
        g.moveTo(cx - 6, FH - 34 - bob);
        g.lineTo(cx, FH - 29 - bob);
        g.lineTo(cx + 6, FH - 34 - bob);
        g.closePath();
        g.fill();
      }
      if (opts.player) {
        const sg = g.createLinearGradient(0, FH - 26 - bob, 0, FH - 22 - bob);
        sg.addColorStop(0, '#ffe08a');
        sg.addColorStop(1, '#d9a531');
        g.fillStyle = sg;
        g.fillRect(cx - 12, FH - 26 - bob, 24, 4);
      }
      if (opts.grunt) {
        g.fillStyle = '#9b7fe0';
        g.beginPath();
        g.moveTo(cx - 5, FH - 30 - bob);
        g.lineTo(cx, FH - 20 - bob);
        g.lineTo(cx + 5, FH - 30 - bob);
        g.fill();
      }
      // 腕（横向きは手前に1本）
      if (side) {
        const ag = g.createLinearGradient(cx - 3, 0, cx + 3, 0);
        ag.addColorStop(0, shade(look.body, 10));
        ag.addColorStop(1, shade(look.body, -36));
        g.fillStyle = ag;
        g.beginPath();
        g.roundRect(cx - 3 + armSwing * s, FH - 32 - bob, 6, 15, 3);
        g.fill();
        g.fillStyle = skin;
        g.beginPath();
        g.arc(cx + armSwing * s, FH - 17 - bob, 2.8, 0, 6.28);
        g.fill();
      }
      // 首
      g.fillStyle = shade(skin, -28);
      g.fillRect(cx - 3, FH - 36 - bob, 6, 4);
      // 頭（肌の陰影）
      const hy = FH - 44 - bob;
      const hg = g.createRadialGradient(cx - 4, hy - 5, 2, cx, hy, 14);
      hg.addColorStop(0, '#ffeedd');
      hg.addColorStop(0.6, skin);
      hg.addColorStop(1, '#d9a988');
      g.fillStyle = hg;
      g.strokeStyle = OUTL;
      g.lineWidth = 1.4;
      g.beginPath();
      g.ellipse(cx, hy, 12, 13, 0, 0, 6.28);
      g.fill();
      g.stroke();
      // 耳
      if (side) {
        g.fillStyle = shade(skin, -16);
        g.beginPath();
        g.ellipse(cx - 2 * s, hy + 1, 2.5, 3.5, 0, 0, 6.28);
        g.fill();
      }
      // 髪（グラデーション＋つや）
      const hairG = g.createLinearGradient(cx - 12, hy - 14, cx + 10, hy + 6);
      hairG.addColorStop(0, shade(look.hair, 40));
      hairG.addColorStop(0.45, look.hair);
      hairG.addColorStop(1, shade(look.hair, -40));
      g.fillStyle = hairG;
      g.beginPath();
      if (dir === 'up') {
        g.ellipse(cx, hy - 1, 13, 13.5, 0, 0, 6.28);
      } else if (dir === 'down') {
        g.ellipse(cx, hy - 3, 13, 11, 0, Math.PI * 1.02, Math.PI * 1.98);
        g.lineTo(cx + 13, hy + 2);
        g.quadraticCurveTo(cx + 6, hy - 6, cx + 2, hy - 4);
        g.quadraticCurveTo(cx - 4, hy - 7, cx - 13, hy + 2);
      } else {
        // 前髪（顔の側）から頭の上を通って後ろ髪へ
        for (let k = 0; k <= 12; k++) {
          const th = (k / 12) * Math.PI;
          const px2 = cx + s * 13 * Math.cos(th);
          const py2 = hy - 2 - 12 * Math.sin(th);
          if (k === 0) g.moveTo(px2, py2);
          else g.lineTo(px2, py2);
        }
        g.lineTo(cx - 12 * s, hy + 8);
        g.lineTo(cx - 5 * s, hy + 3);
        g.lineTo(cx + 1 * s, hy - 5);
        g.lineTo(cx + 8 * s, hy - 4);
        g.closePath();
      }
      g.fill();
      g.strokeStyle = 'rgba(255,255,255,.35)';
      g.lineWidth = 1.6;
      g.beginPath();
      g.arc(cx - 2, hy - 4, 8, Math.PI * 1.15, Math.PI * 1.55);
      g.stroke();
      if (opts.player) {
        // 帽子
        const cg = g.createLinearGradient(0, hy - 16, 0, hy - 6);
        cg.addColorStop(0, '#ff9a6a');
        cg.addColorStop(1, '#c8461c');
        g.fillStyle = cg;
        g.beginPath();
        g.ellipse(cx, hy - 9, 13.5, 8, 0, Math.PI, 0);
        g.fill();
        g.fillStyle = '#a83a16';
        if (dir === 'down') g.fillRect(cx - 14, hy - 10, 28, 3.5);
        else if (side) {
          g.beginPath();
          g.ellipse(cx + 9 * s, hy - 8, 8, 2.4, 0, 0, 6.28);
          g.fill();
        } else g.fillRect(cx - 13, hy - 10, 26, 3);
      }
      // 顔
      if (dir === 'down' || side) {
        const eye = (ex: number) => {
          g.fillStyle = '#fff';
          g.beginPath();
          g.ellipse(ex, hy + 1, 2.3, 2.8, 0, 0, 6.28);
          g.fill();
          g.fillStyle = '#3a2a24';
          g.beginPath();
          g.ellipse(ex + (side ? s * 0.6 : 0), hy + 1.4, 1.6, 2.2, 0, 0, 6.28);
          g.fill();
          g.fillStyle = '#fff';
          g.fillRect(ex - 0.6 + (side ? s * 0.4 : 0), hy - 0.2, 1, 1);
        };
        if (dir === 'down') {
          eye(cx - 5);
          eye(cx + 5);
          g.fillStyle = 'rgba(240,120,120,.3)';
          g.beginPath();
          g.ellipse(cx - 7, hy + 6, 2.6, 1.5, 0, 0, 6.28);
          g.ellipse(cx + 7, hy + 6, 2.6, 1.5, 0, 0, 6.28);
          g.fill();
          g.strokeStyle = '#9a5a4a';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(cx - 2, hy + 7.5);
          g.quadraticCurveTo(cx, hy + 8.8, cx + 2, hy + 7.5);
          g.stroke();
        } else {
          eye(cx + 6 * s);
          g.strokeStyle = '#9a5a4a';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(cx + 6 * s, hy + 8);
          g.lineTo(cx + 9 * s, hy + 7.5);
          g.stroke();
        }
      }
    }
  });
  return c;
}

export const CHAR_FRAME = { w: 48, h: 60 };
export const FACING_FRAME: Record<string, number> = { down: 0, up: 2, left: 4, right: 6 };
