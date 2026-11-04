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
          g.fillStyle = shade(p.grass, -10);
          g.fillRect(px, py, T, T);
          for (let i = 0; i < 6; i++) {
            const bx = px + 4 + (i % 3) * 14 + (r() * 4 - 2);
            const by = py + 14 + Math.floor(i / 3) * 18;
            g.fillStyle = i % 2 ? p.grass : shade(p.grass, 18);
            g.beginPath();
            g.moveTo(bx, by + 14);
            g.lineTo(bx + 4, by);
            g.lineTo(bx + 7, by + 8);
            g.lineTo(bx + 10, by - 2);
            g.lineTo(bx + 13, by + 14);
            g.closePath();
            g.fill();
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
          g.fillStyle = '#4aa3df';
          g.fillRect(px, py, T, T);
          g.strokeStyle = '#bfe6ff';
          g.lineWidth = 2;
          for (let i = 0; i < 2; i++) {
            const wy = py + 14 + i * 18 + r() * 4;
            g.beginPath();
            g.moveTo(px + 6, wy);
            g.quadraticCurveTo(px + 14, wy - 4, px + 22, wy);
            g.quadraticCurveTo(px + 30, wy + 4, px + 38, wy);
            g.stroke();
          }
          if (at(x, y - 1) !== '~') {
            g.fillStyle = '#e8d7a8';
            g.fillRect(px, py, T, 5);
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
        case 'R':
          g.fillStyle = 'rgba(0,0,0,.18)';
          g.beginPath();
          g.ellipse(cx, py + T - 8, 18, 6, 0, 0, 6.28);
          g.fill();
          g.fillStyle = '#9a948c';
          g.strokeStyle = '#4a4542';
          g.lineWidth = 2.5;
          g.beginPath();
          g.moveTo(px + 8, py + T - 10);
          g.lineTo(px + 12, py + 16);
          g.lineTo(px + 26, py + 8);
          g.lineTo(px + 40, py + 16);
          g.lineTo(px + 42, py + T - 10);
          g.closePath();
          g.fill();
          g.stroke();
          g.fillStyle = '#c9c3ba';
          g.fillRect(px + 16, py + 16, 8, 5);
          break;
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
        g.fillStyle = map.id === 'village' && x > 9 ? '#d05a4a' : '#4a7fc0';
        if (y > 8) g.fillStyle = '#c9884a';
        g.fillRect(px, py, T, T);
        g.fillStyle = 'rgba(0,0,0,.12)';
        for (let i = 0; i < 4; i++) g.fillRect(px, py + i * 12 + 10, T, 2);
        if (top) {
          g.fillStyle = 'rgba(255,255,255,.25)';
          g.fillRect(px, py, T, 6);
        }
      }
      if (ch === '#' || (ch === 'D' && map.kind !== 'indoor')) {
        g.fillStyle = '#f3e6cf';
        g.fillRect(px, py, T, T);
        g.strokeStyle = '#c9b48f';
        g.lineWidth = 2;
        g.strokeRect(px + 1, py + 1, T - 2, T - 2);
        if (ch === '#') {
          g.fillStyle = '#9fd6f0';
          g.fillRect(px + 12, py + 12, T - 24, T - 26);
          g.strokeStyle = '#6a8fa5';
          g.strokeRect(px + 12, py + 12, T - 24, T - 26);
        } else {
          g.fillStyle = '#8a5a34';
          g.fillRect(px + 10, py + 6, T - 20, T - 6);
          g.fillStyle = '#ffd166';
          g.beginPath();
          g.arc(px + T - 16, py + T / 2 + 4, 3, 0, 6.28);
          g.fill();
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
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.beginPath();
      g.ellipse(cx, py + T - 6, 18, 6, 0, 0, 6.28);
      g.fill();
      g.fillStyle = '#7a5537';
      g.fillRect(cx - 5, py + T - 18, 10, 14);
      const base = p.tree;
      const blobs: [number, number, number, string][] = [
        [cx, py + 18, 18, base],
        [cx - 10, py + 24, 13, shade(base, -12)],
        [cx + 10, py + 24, 13, shade(base, -6)],
        [cx - 4, py + 12, 9, shade(base, 22)],
      ];
      for (const [bx, by, br, col] of blobs) {
        g.fillStyle = col;
        g.beginPath();
        g.arc(bx, by, br, 0, 6.28);
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
  dirs.forEach((dir, di) => {
    for (let f = 0; f < 2; f++) {
      const ox = (di * 2 + f) * FW;
      const cx = ox + FW / 2;
      const bob = f ? 1 : 0;
      // 影
      g.fillStyle = 'rgba(0,0,0,.22)';
      g.beginPath();
      g.ellipse(cx, FH - 5, 13, 4, 0, 0, 6.28);
      g.fill();
      // 足
      g.fillStyle = '#3a3040';
      const step = f ? 3 : -3;
      if (dir === 'left' || dir === 'right') {
        g.fillRect(cx - 5 + step, FH - 16, 5, 11);
        g.fillRect(cx - step, FH - 16, 5, 11);
      } else {
        g.fillRect(cx - 8, FH - 16 + (f ? 2 : 0), 6, 11 - (f ? 2 : 0));
        g.fillRect(cx + 2, FH - 16 + (f ? 0 : 2), 6, 11 - (f ? 0 : 2));
      }
      // 体
      g.fillStyle = look.body;
      g.strokeStyle = '#2b2233';
      g.lineWidth = 2;
      g.beginPath();
      g.roundRect(cx - 12, FH - 34 - bob, 24, 22, 7);
      g.fill();
      g.stroke();
      if (opts.player) {
        g.fillStyle = '#ffd166';
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
      // 頭
      g.fillStyle = '#ffe0c4';
      g.beginPath();
      g.arc(cx, FH - 44 - bob, 13, 0, 6.28);
      g.fill();
      g.stroke();
      // 髪
      g.fillStyle = look.hair;
      g.beginPath();
      if (dir === 'up') g.arc(cx, FH - 45 - bob, 13.5, 0, 6.28);
      else if (dir === 'down') {
        g.arc(cx, FH - 47 - bob, 13.5, Math.PI * 1.02, Math.PI * 1.98);
        g.lineTo(cx + 13, FH - 44 - bob);
        g.quadraticCurveTo(cx, FH - 50 - bob, cx - 13, FH - 44 - bob);
      } else {
        const s = dir === 'left' ? 1 : -1;
        g.arc(cx, FH - 47 - bob, 13.5, Math.PI, Math.PI * 2);
        g.lineTo(cx + 13 * s, FH - 38 - bob);
        g.lineTo(cx + 6 * s, FH - 44 - bob);
      }
      g.fill();
      if (opts.player) {
        // 帽子
        g.fillStyle = '#ef6a3a';
        g.beginPath();
        g.ellipse(cx, FH - 54 - bob, 14, 6, 0, Math.PI, 0);
        g.fill();
        g.fillRect(cx - 14, FH - 55 - bob, 28, 4);
      }
      // 目
      g.fillStyle = '#2b2233';
      if (dir === 'down') {
        g.fillRect(cx - 6, FH - 44 - bob, 3, 5);
        g.fillRect(cx + 3, FH - 44 - bob, 3, 5);
      } else if (dir === 'left') g.fillRect(cx - 8, FH - 44 - bob, 3, 5);
      else if (dir === 'right') g.fillRect(cx + 5, FH - 44 - bob, 3, 5);
    }
  });
  return c;
}

export const CHAR_FRAME = { w: 48, h: 60 };
export const FACING_FRAME: Record<string, number> = { down: 0, up: 2, left: 4, right: 6 };
