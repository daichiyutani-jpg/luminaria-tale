// アプリアイコン（PNG）を生成する。ヒノコロの仮イラストを夜明け色の背景に重ねる。
// 使い方: node scripts/make-icons.mjs
import { writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';
import { MONSTER_ART } from '../src/art/monsterArt.ts';

const mon = MONSTER_ART.hinokoro().replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
function icon(size, pad) {
  const inner = 200 * (1 - pad * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 200 200">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2b1d55"/><stop offset=".6" stop-color="#7a3f86"/><stop offset="1" stop-color="#f08a5a"/></linearGradient></defs>
    <rect width="200" height="200" fill="url(#bg)"/>
    <circle cx="100" cy="104" r="${70 * (1 - pad)}" fill="#ffcf6b" opacity=".25"/>
    <g transform="translate(${100 - inner / 2} ${100 - inner / 2 + 4}) scale(${inner / 200})">${mon}</g>
  </svg>`;
  return new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
}
writeFileSync('public/icons/icon-192.png', icon(192, 0.06));
writeFileSync('public/icons/icon-512.png', icon(512, 0.06));
writeFileSync('public/icons/icon-maskable-512.png', icon(512, 0.16));
writeFileSync('public/icons/apple-touch-icon.png', icon(180, 0.08));
console.log('icons written');
