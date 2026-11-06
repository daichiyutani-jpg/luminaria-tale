/**
 * 【仮イラスト】灯獣の絵をコードで描く（SVG）。
 * 本番のイラストができたら、species.art と同じ名前の画像に差し替える前提。
 *
 * 描き方：
 * - 進化前はかわいく（大きな頭・丸い体・丸い目）、進化するたびにカッコよく強そうに
 *   （つり目 → 光る目、炎・よろい・オーラが増える）
 * - 正面向きで、左半分を描いて左右反転（sym / mir）。形がきれいにそろう
 * - 目はつり目・縦長の瞳、体はグラデーションで立体感、炎・うろこ・毛並みを描き込む
 * - 最後に RENDER_FILTER（光・つや・きめ）を全体にかける
 */

import { GEN_ART, type GenArt, type Plan } from '../data/speciesExtra';

type Recipe = () => string;
type Pt = [number, number];

const OUT = '#1c1424';
const sw = (w = 2, c = OUT) => `stroke="${c}" stroke-width="${w}"`;

/** 左半分のパス（中心 x=100 から始まり、左側を通って中心で終わる）を左右対称の閉じた形にする */
function sym(half: string): string {
  const tokens = half.match(/[MLCQ]|-?\d*\.?\d+/g) ?? [];
  const segs: { c: string; p: Pt[] }[] = [];
  let i = 0;
  let cmd = '';
  while (i < tokens.length) {
    if (/[MLCQ]/.test(tokens[i])) cmd = tokens[i++];
    const n = cmd === 'C' ? 3 : cmd === 'Q' ? 2 : 1;
    const p: Pt[] = [];
    for (let k = 0; k < n; k++) {
      p.push([Number(tokens[i]), Number(tokens[i + 1])]);
      i += 2;
    }
    segs.push({ c: cmd, p });
    if (cmd === 'M') cmd = 'L';
  }
  const f = (p: Pt) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`;
  const m = (p: Pt): Pt => [200 - p[0], p[1]];
  let d = '';
  const ends: Pt[] = [];
  for (const s of segs) {
    d += `${s.c === 'M' ? 'M' : ` ${s.c}`}${s.p.map(f).join(' ')}`;
    ends.push(s.p[s.p.length - 1]);
  }
  for (let k = segs.length - 1; k >= 1; k--) {
    const s = segs[k];
    const to = m(ends[k - 1]);
    if (s.c === 'L') d += ` L${f(to)}`;
    else if (s.c === 'Q') d += ` Q${f(m(s.p[0]))} ${f(to)}`;
    else d += ` C${f(m(s.p[1]))} ${f(m(s.p[0]))} ${f(to)}`;
  }
  return `${d}Z`;
}
/** 左右対称の形を1つ描く */
const P = (half: string, fill: string, w = 2, extra = '') => `<path d="${sym(half)}" fill="${fill}" ${sw(w)} ${extra}/>`;
/** 片側だけ描いた部品を、左右反転してもう1つ置く */
const mir = (c: string) => `${c}<g transform="translate(200 0) scale(-1 1)">${c}</g>`;
const path = (d: string, fill: string, w = 2, extra = '') =>
  `<path d="${d}" fill="${fill}" ${!w ? '' : extra.includes('stroke=') ? `stroke-width="${w}"` : sw(w)} ${extra}/>`;

const rad = (id: string, stops: string[], cx = '38%', cy = '28%', r = '80%') =>
  `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</radialGradient>`;
const lin = (id: string, stops: string[], x1 = 0, y1 = 0, x2 = 0, y2 = 1) =>
  `<linearGradient id="${id}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stops.map((c, i) => `<stop offset="${i / (stops.length - 1)}" stop-color="${c}"/>`).join('')}</linearGradient>`;

/** どの絵でも使う共通の色 */
const COMMON_DEFS =
  lin('fire', ['#fffbe0', '#ffd24a', '#ff7a1a', '#d0300e'], 0, 1, 0, 0) +
  lin('fireCore', ['#ffffff', '#fff4a0', '#ffd24a'], 0, 1, 0, 0) +
  rad('rock', ['#e6d4b4', '#a8875e', '#5e452a']) +
  rad('gold', ['#fff4b0', '#f2c24a', '#9a6a14']) +
  rad('glowY', ['#fffbd0', 'rgba(255,240,140,.6)', 'rgba(255,230,120,0)'], '50%', '50%', '50%');

let uid = 0;

/** つり目（左目として描く。mir で右目もできる）。glow=true は白目なしの光る目 */
function eye(cx: number, cy: number, s: number, iris: string, glow = false): string {
  const id = `e${uid++}`;
  const shape = `M${-s} ${-0.3 * s} Q${-0.15 * s} ${-0.95 * s} ${s} ${0.12 * s} Q${0.05 * s} ${0.62 * s} ${-s} ${-0.3 * s}Z`;
  return `<g transform="translate(${cx} ${cy})">
    <clipPath id="${id}"><path d="${shape}"/></clipPath>
    <path d="${shape}" fill="${glow ? iris : '#fffaf0'}"/>
    <g clip-path="url(#${id})">
      <circle cx="${0.18 * s}" cy="${-0.08 * s}" r="${0.5 * s}" fill="${iris}"/>
      <circle cx="${0.18 * s}" cy="${-0.08 * s}" r="${0.5 * s}" fill="none" stroke="#000" stroke-opacity=".35" stroke-width="${0.12 * s}"/>
      <ellipse cx="${0.18 * s}" cy="${-0.08 * s}" rx="${0.11 * s}" ry="${0.38 * s}" fill="${glow ? '#fff' : '#0c0610'}" ${glow ? 'opacity=".85"' : ''}/>
      <path d="M${-s} ${-0.6 * s} L${s} ${-0.2 * s} L${s} ${-0.75 * s} L${-s} ${-0.9 * s}Z" fill="#000" opacity=".22"/>
    </g>
    <circle cx="${0.02 * s}" cy="${-0.28 * s}" r="${0.13 * s}" fill="#fff"/>
    <path d="M${-s * 1.08} ${-0.3 * s} Q${-0.15 * s} ${-1.02 * s} ${s * 1.05} ${0.14 * s}" fill="none" stroke="${OUT}" stroke-width="${0.22 * s}" stroke-linecap="round"/>
    <path d="M${-s * 0.9} ${-0.22 * s} Q${0.05 * s} ${0.55 * s} ${s} ${0.14 * s}" fill="none" stroke="${OUT}" stroke-width="${0.08 * s}" opacity=".7"/>
  </g>`;
}

/** 炎（根元が (x,y)、先が上。rot は傾き） */
function flame(x: number, y: number, hgt: number, w: number, rot = 0): string {
  const d = `M0 0 C${-w} ${-hgt * 0.22} ${-w * 0.7} ${-hgt * 0.62} ${-w * 0.12} ${-hgt} C${-w * 0.02} ${-hgt * 0.72} ${w * 0.32} ${-hgt * 0.7} ${w * 0.3} ${-hgt * 0.88} C${w * 0.95} ${-hgt * 0.5} ${w} ${-hgt * 0.2} 0 0Z`;
  const core = `M0 ${-hgt * 0.04} C${-w * 0.5} ${-hgt * 0.2} ${-w * 0.3} ${-hgt * 0.5} ${-w * 0.02} ${-hgt * 0.7} C${w * 0.3} ${-hgt * 0.45} ${w * 0.5} ${-hgt * 0.2} 0 ${-hgt * 0.04}Z`;
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="${d}" fill="url(#fire)" stroke="#8a1e08" stroke-width="1.5"/><path d="${core}" fill="url(#fireCore)" opacity=".9"/></g>`;
}

/** 葉（根元が (x,y)、先が上）。葉脈つき */
function leaf(x: number, y: number, len: number, w: number, rot: number, fill: string): string {
  return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 C${w} ${-len * 0.3} ${w * 0.8} ${-len * 0.75} 0 ${-len} C${-w * 0.8} ${-len * 0.75} ${-w} ${-len * 0.3} 0 0Z" fill="${fill}" ${sw(1.5)}/><path d="M0 -2 L0 ${-len * 0.9}" stroke="#1f4a1a" stroke-width="1.2" opacity=".6"/>${[0.3, 0.5, 0.7].map((t) => `<path d="M0 ${-len * t} L${w * 0.5} ${-len * (t + 0.12)} M0 ${-len * t} L${-w * 0.5} ${-len * (t + 0.12)}" stroke="#1f4a1a" stroke-width=".8" opacity=".45"/>`).join('')}</g>`;
}

/** とげの輪（たてがみ・岩など） */
function star(cx: number, cy: number, n: number, r1: number, r2: number, rot: number, fill: string, w = 2): string {
  const pts: string[] = [];
  for (let i = 0; i < n * 2; i++) {
    const a = ((i / (n * 2)) * 360 + rot) * (Math.PI / 180);
    const r = i % 2 ? r2 : r1;
    pts.push(`${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`);
  }
  return `<path d="M${pts.join(' L')}Z" fill="${fill}" ${sw(w)}/>`;
}

/** 毛並み（中心から放射状に短い毛を描く） */
function furRing(cx: number, cy: number, rx: number, ry: number, n: number, len: number, color: string, seed = 1): string {
  let a = seed * 9301;
  const rnd = () => ((a = (a * 9301 + 49297) % 233280) / 233280);
  let out = '';
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2 + rnd() * 0.08;
    const l = len * (0.7 + rnd() * 0.6);
    const x = cx + Math.cos(t) * rx;
    const y = cy + Math.sin(t) * ry;
    const x2 = cx + Math.cos(t + 0.06) * (rx + l);
    const y2 = cy + Math.sin(t + 0.06) * (ry + l);
    out += `<path d="M${x.toFixed(1)} ${y.toFixed(1)} Q${((x + x2) / 2 + Math.sin(t) * 3).toFixed(1)} ${((y + y2) / 2).toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${color}" stroke-width="${(1.2 + rnd() * 1.6).toFixed(1)}" stroke-linecap="round" fill="none"/>`;
  }
  return out;
}

/** かぎづめ（足先の3本） */
const claws = (x: number, y: number, s = 1, c = '#f4efe6') =>
  [-6, 0, 6].map((dx) => `<path d="M${x + dx * s - 2 * s} ${y} L${x + dx * s} ${y + 6 * s} L${x + dx * s + 2 * s} ${y}Z" fill="${c}" ${sw(1)}/>`).join('');

const shadow = (rx = 54, cy = 185) => `<ellipse cx="100" cy="${cy}" rx="${rx}" ry="8" fill="#000" opacity=".22"/>`;
const sparkle = (x: number, y: number, r: number, c = '#fff6b0') =>
  `<path d="M${x} ${y - r} L${x + r * 0.25} ${y - r * 0.25} L${x + r} ${y} L${x + r * 0.25} ${y + r * 0.25} L${x} ${y + r} L${x - r * 0.25} ${y + r * 0.25} L${x - r} ${y} L${x - r * 0.25} ${y - r * 0.25}Z" fill="${c}"/>`;
const bolt = (x: number, y: number, s: number, rot = 0, c = '#fff27a') =>
  `<path transform="translate(${x} ${y}) rotate(${rot}) scale(${s})" d="M0 -14 L-6 0 L0 0 L-4 14 L8 -3 L2 -3 L6 -14Z" fill="${c}" ${sw(1)}/>`;

/**
 * 仕上げのフィルター：形から凹凸を作り、左上からの光で陰影・つや・肌理（きめ）をつける。
 */
const RENDER_FILTER = `<filter id="rl" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="ba"/>
  <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum"/>
  <feGaussianBlur in="lum" stdDeviation="1.6" result="bl"/>
  <feComposite in="ba" in2="bl" operator="arithmetic" k2=".75" k3=".5" result="h"/>
  <feDiffuseLighting in="h" surfaceScale="6" diffuseConstant="1" lighting-color="#fff" result="dif"><feDistantLight azimuth="225" elevation="50"/></feDiffuseLighting>
  <feSpecularLighting in="h" surfaceScale="6" specularConstant=".4" specularExponent="18" lighting-color="#fff6e0" result="spec"><feDistantLight azimuth="225" elevation="58"/></feSpecularLighting>
  <feTurbulence type="fractalNoise" baseFrequency=".6 1.5" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="ng"/>
  <feComposite in="SourceGraphic" in2="ng" operator="arithmetic" k1=".36" k2=".83" result="tex"/>
  <feComposite in="tex" in2="dif" operator="arithmetic" k1="1.28" result="lit"/>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="ib"/>
  <feComposite in="SourceAlpha" in2="ib" operator="arithmetic" k2="1" k3="-1" result="edge"/>
  <feFlood flood-color="#120a1a" flood-opacity=".5"/>
  <feComposite in2="edge" operator="in" result="ao"/>
  <feMerge><feMergeNode in="lit"/><feMergeNode in="ao"/><feMergeNode in="spec2"/></feMerge>
  <feComposite in2="SourceAlpha" operator="in"/>
</filter>`;

const svg = (inner: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs>${RENDER_FILTER}${COMMON_DEFS}${defs}</defs><g filter="url(#rl)"><g stroke-linejoin="round" stroke-linecap="round">${inner}</g></g></svg>`;

// ───────────────────────── ほむら：キツネの系統 ─────────────────────────
const foxHead = (top: number, body: string, cream: string, iris: string, earH = 40, glow = false) => {
  const t = top;
  return `
    ${mir(`${path(`M68 ${t + 22} L52 ${t + 22 - earH} L92 ${t + 8}Z`, body)}${path(`M70 ${t + 16} L58 ${t + 26 - earH * 0.85} L84 ${t + 8}Z`, '#4a140c', 0)}${path(`M71 ${t + 12} L63 ${t + 30 - earH * 0.8} L80 ${t + 8}Z`, '#ff9a5a', 0, 'opacity=".55"')}`)}
    ${P(`M100 ${t} C80 ${t} 62 ${t + 12} 58 ${t + 32} C56 ${t + 48} 64 ${t + 60} 76 ${t + 67} C84 ${t + 71} 92 ${t + 73} 100 ${t + 73}`, body)}
    ${mir(path(`M60 ${t + 40} L38 ${t + 50} L58 ${t + 55} L44 ${t + 66} L68 ${t + 61}Z`, cream, 1.5))}
    ${P(`M100 ${t + 44} C92 ${t + 44} 86 ${t + 48} 82 ${t + 54} C78 ${t + 59} 72 ${t + 60} 66 ${t + 57} C70 ${t + 67} 84 ${t + 73} 100 ${t + 73}`, cream, 1.5)}
    ${mir(path(`M64 ${t + 29} Q74 ${t + 25} 82 ${t + 31} Q74 ${t + 31} 66 ${t + 34}Z`, '#a8200c', 0))}
    ${mir(eye(83, t + 37, 11, iris, glow))}
    <path d="M93 ${t + 50} Q100 ${t + 45} 107 ${t + 50} Q105 ${t + 57} 100 ${t + 58} Q95 ${t + 57} 93 ${t + 50}Z" fill="${OUT}"/><ellipse cx="98" cy="${t + 49}" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>
    <path d="M100 ${t + 58} L100 ${t + 62} M92 ${t + 63} Q96 ${t + 66} 100 ${t + 62} Q104 ${t + 66} 108 ${t + 63}" fill="none" ${sw(1.6)}/>`;
};

const kagurabi: Recipe = () =>
  svg(
    `${shadow(58)}
    ${mir([-62, -38, -16].map((a, i) => flame(100, 150, 96 + i * 8, 22, a)).join(''))}
    ${mir(`${path('M78 128 C74 150 72 168 72 182 L89 182 C89 166 91 150 93 130Z', 'url(#kb)')}${path('M70 177 Q80 171 90 177 L90 185 L70 185Z', '#4a1a0c', 1.5)}${claws(80, 184, 0.7)}`)}
    ${P('M100 92 C84 92 72 106 72 124 C72 140 80 150 90 154 L100 156', 'url(#kb)')}
    ${P('M100 96 L88 100 L80 116 L90 114 L86 132 L96 124 L100 138', 'url(#kc)', 1.5)}
    ${mir(path('M76 104 Q84 112 82 124 Q78 114 72 110Z', '#a8200c', 0))}
    ${foxHead(26, 'url(#kb)', 'url(#kc)', '#ffe14a', 42)}
    ${P('M100 27 L91 36 L94 47 L100 53', 'url(#gold)', 1.5)}
    <circle cx="100" cy="41" r="4" fill="#ff3a1a" ${sw(1.2)}/>
    ${mir(flame(58, 70, 22, 8, -50))}`,
    rad('kb', ['#ffc08a', '#f07a32', '#9a2e14']) + rad('kc', ['#fffaf0', '#f6dcc0', '#cfa47c']),
  );

const homuragitsune: Recipe = () =>
  svg(
    `<circle cx="100" cy="96" r="96" fill="url(#aura)"/>
    ${shadow(66)}
    ${mir([-78, -58, -38, -18].map((a) => flame(100, 150, 112, 22, a)).join(''))}${flame(100, 150, 112, 22, 0)}
    ${mir(`${path('M74 130 C70 150 68 168 68 182 L90 182 C90 166 92 150 94 132Z', 'url(#fb)')}${path('M66 177 Q78 170 90 177 L90 185 L66 185Z', '#3a1208', 1.5)}${claws(78, 184, 0.8)}`)}
    ${P('M100 88 C80 88 62 104 58 128 C56 150 62 168 76 176 L100 178', 'url(#fb)')}
    ${P('M100 92 L86 94 L72 112 L85 108 L78 128 L91 120 L88 142 L97 132 L100 148', 'url(#fc)', 1.5)}
    ${P('M100 96 C86 96 76 92 70 86 L74 96 C80 104 90 108 100 108', 'url(#gold)', 1.5)}
    <circle cx="100" cy="103" r="5" fill="#ff2a12" ${sw(1.2)}/>
    ${foxHead(22, 'url(#fb)', 'url(#fc)', '#fff27a', 38, true)}
    ${mir(flame(56, 14, 18, 7, -18))}
    ${P('M100 23 L92 31 L95 42 L100 48', 'url(#gold)', 1.5)}
    ${mir(path('M62 46 Q60 58 66 66 L70 60Z', 'url(#gold)', 1))}`,
    rad('fb', ['#ffb070', '#e8502a', '#7a1a0c']) + rad('fc', ['#fffaf0', '#ffe0b0', '#d89a5a']) + rad('aura', ['rgba(255,180,80,.55)', 'rgba(255,120,40,.18)', 'rgba(255,80,20,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── しお：イモリ・竜の系統 ─────────────────────────
const minamodra: Recipe = () =>
  svg(
    `${shadow(62)}
    ${path('M120 158 C164 168 192 138 178 100 C172 124 156 138 132 144Z', 'url(#mb)')}
    ${path('M172 108 C184 100 190 88 188 76 C182 90 176 98 168 104Z', '#9fdcff', 1.5)}
    ${mir(`${path('M74 138 C66 154 64 170 62 182 L90 184 C90 170 92 158 95 146Z', 'url(#mb)')}${claws(74, 184, 0.9)}`)}
    ${P('M100 82 C78 82 62 98 60 122 C60 144 70 160 86 164 L100 166', 'url(#mb)')}
    ${P('M100 94 C90 94 84 104 84 118 C84 138 90 154 100 158', '#d4ecf8', 1.5)}
    ${[106, 118, 130, 142].map((y) => `<path d="M86 ${y} Q100 ${y + 4} 114 ${y}" stroke="#7fa8c8" stroke-width="1.4" fill="none"/>`).join('')}
    ${mir(`${path('M64 102 C50 108 42 122 44 138 L56 140 C58 128 64 120 72 116Z', 'url(#mb)')}${claws(50, 140, 0.7)}`)}
    ${mir(`${path('M68 90 L54 78 L70 72 L82 84Z', 'url(#rock)', 1.5)}${path('M58 102 L44 94 L54 86 L66 94Z', 'url(#rock)', 1.5)}`)}
    ${mir(path('M78 34 C70 18 60 8 48 6 C56 18 62 28 70 42Z', 'url(#rock)', 1.5))}
    ${mir(path('M66 50 C50 42 38 44 28 50 C40 54 52 58 64 64Z', '#9fdcff', 1.5, 'fill-opacity=".9"'))}
    ${P('M100 24 C82 24 68 36 66 54 C64 68 72 80 86 86 L100 88', 'url(#mb)')}
    ${P('M100 50 C94 50 88 56 87 64 C87 74 92 82 100 84', 'url(#mb)', 1.5)}
    ${mir(path('M88 70 Q92 80 100 82', 'none', 1.2))}
    <path d="M100 24 C98 12 102 4 110 0 C110 10 108 18 104 26Z" fill="#9fdcff" ${sw(1.5)}/>
    ${mir(eye(84, 48, 9, '#ffd84a'))}
    ${mir('<path d="M94 74 L96 70" stroke="#1c1424" stroke-width="2"/>')}
    <path d="M88 78 Q100 82 112 78" fill="none" ${sw(1.6)}/>${mir(path('M90 78 L92 83 L94 79Z', '#fff', 1))}`,
    rad('mb', ['#8fd0ff', '#2f78c0', '#123766']),
  );

const uzushiodra: Recipe = () =>
  svg(
    `<circle cx="100" cy="90" r="96" fill="url(#uaura)"/>
    <ellipse cx="100" cy="164" rx="92" ry="26" fill="url(#whirl)" ${sw(1.5, '#0f3a66')}/>
    ${[78, 60, 42].map((rx, i) => `<ellipse cx="${100 + i * 3}" cy="${164 - i * 2}" rx="${rx}" ry="${rx * 0.26}" fill="none" stroke="#dff6ff" stroke-width="${3 - i * 0.6}" stroke-dasharray="${40 - i * 8} ${14 + i * 4}" opacity=".85"/>`).join('')}
    <ellipse cx="100" cy="148" rx="60" ry="24" fill="url(#ub)" ${sw()}/>
    <ellipse cx="96" cy="128" rx="46" ry="19" fill="url(#ub)" ${sw()}/>
    ${[[60, 146], [80, 156], [120, 156], [140, 146], [72, 126], [122, 124]].map(([x, y]) => star(x, y, 3, 7, 3, 30, 'url(#rock)', 1.2)).join('')}
    ${mir(path('M82 70 C58 58 34 62 18 78 C38 78 56 82 80 94Z', '#8fdcff', 1.5, 'fill-opacity=".9"'))}
    ${mir(`<path d="M76 72 L40 70 M76 80 L34 80 M78 88 L44 86" stroke="#3a8ac8" stroke-width="1.2" opacity=".7"/>`)}
    ${P('M100 40 C86 40 78 60 78 84 C78 104 82 118 86 128 L100 130', 'url(#ub)')}
    ${P('M100 58 C94 58 90 72 90 88 C90 106 92 118 94 128 L100 128', '#d4ecf8', 1.2)}
    ${[74, 86, 98, 110].map((y) => `<path d="M91 ${y} Q100 ${y + 3} 109 ${y}" stroke="#7fa8c8" stroke-width="1.2" fill="none"/>`).join('')}
    ${mir(path('M76 22 C60 6 42 0 26 2 C40 12 52 22 64 34Z', 'url(#rock)', 1.5))}
    ${mir(path('M66 34 C52 26 40 26 30 30 C42 34 52 38 64 44Z', '#8fdcff', 1.2))}
    ${P('M100 12 C80 12 64 24 62 42 C62 56 74 66 88 70 L100 72', 'url(#ub)')}
    ${P('M100 44 C92 44 84 50 84 58 C86 64 92 68 100 70', '#bfe0f4', 1.2)}
    ${mir(eye(84, 38, 9.5, '#7af0ff', true))}
    ${mir(path('M88 64 L90 70 L93 65Z', '#fff', 1))}
    ${[[30, 150], [170, 148], [48, 132], [156, 128], [20, 168], [182, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#e8fbff" opacity=".9"/>`).join('')}`,
    rad('ub', ['#7fc4f4', '#1f62a8', '#0c2a52']) + rad('whirl', ['#bfeaff', '#3f9ae0', '#174f88'], '50%', '40%', '60%') + rad('uaura', ['rgba(120,210,255,.5)', 'rgba(60,150,240,.15)', 'rgba(40,120,220,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── めぶき：ハリネズミ・獅子の系統 ─────────────────────────
const lionBody = (bodyFill: string, mane: string, iris: string, top = 40, glow = false) => `
    ${mir(`${path('M72 128 C68 150 66 168 64 182 L90 184 C90 168 92 150 94 132Z', bodyFill)}${claws(76, 184, 0.9)}`)}
    ${P('M100 108 C80 108 64 120 62 140 C62 156 72 166 90 168 L100 168', bodyFill)}
    ${star(100, top + 32, 16, 62, 44, 6, mane)}${star(100, top + 32, 16, 50, 36, 17, mane, 1.5)}
    ${P(`M100 ${top} C82 ${top} 68 ${top + 12} 66 ${top + 30} C64 ${top + 46} 74 ${top + 58} 86 ${top + 64} L100 ${top + 68}`, bodyFill)}
    ${P(`M100 ${top + 34} C90 ${top + 34} 82 ${top + 40} 80 ${top + 48} C82 ${top + 58} 90 ${top + 64} 100 ${top + 66}`, '#f6e2b8', 1.5)}
    <path d="M92 ${top + 42} Q100 ${top + 38} 108 ${top + 42} L100 ${top + 50}Z" fill="${OUT}"/>
    <path d="M100 ${top + 50} L100 ${top + 55} M90 ${top + 56} Q100 ${top + 60} 110 ${top + 56}" fill="none" ${sw(1.6)}/>
    ${mir(path(`M90 ${top + 56} L92 ${top + 62} L94 ${top + 57}Z`, '#fff', 1))}
    ${mir(eye(84, top + 24, 9, iris, glow))}`;

const morinonushi: Recipe = () =>
  svg(
    `${shadow(64)}
    ${lionBody('url(#lb)', 'url(#mane)', '#ffd84a')}
    ${[0, 1, 2, 3, 4, 5, 6].map((i) => {
      const a = ((i / 7) * 360 + 20) * (Math.PI / 180);
      const x = 100 + Math.cos(a) * 56;
      const y = 72 + Math.sin(a) * 56;
      return `${star(x, y, 5, 7, 3.5, 0, '#ff8fb6', 1)}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="2.2" fill="#ffe27a"/>`;
    }).join('')}
    ${mir(`${path('M70 150 L64 146 L70 144Z', '#2e5a1e', 1)}${path('M72 166 L66 162 L72 160Z', '#2e5a1e', 1)}`)}`,
    rad('lb', ['#f4d898', '#c89a58', '#6e4e24']) + rad('mane', ['#7fd36a', '#3f9a45', '#1a4a1e'], '50%', '40%', '60%'),
  );

const jukaiou: Recipe = () =>
  svg(
    `<circle cx="100" cy="96" r="98" fill="url(#jaura)"/>
    ${[[100, 26, 30], [66, 34, 24], [134, 34, 24], [44, 56, 18], [156, 56, 18]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#canopy)" ${sw(1.8)}/>`).join('')}
    ${[[88, 18], [112, 22], [60, 30], [140, 28], [100, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#ffe27a"/>`).join('')}
    ${mir(path('M84 60 C76 46 66 38 52 36 L56 32 C68 34 78 40 86 50 C88 40 92 30 98 24 L102 28 C96 36 92 48 92 60Z', '#6a4a2a', 1.5))}
    ${shadow(70)}
    ${lionBody('url(#jb)', 'url(#moss)', '#c8ff5a', 46, true)}
    ${mir(`${path('M66 118 L52 110 L60 98 L76 104Z', 'url(#rock)', 1.5)}${path('M60 134 L46 130 L50 118 L64 122Z', 'url(#rock)', 1.5)}`)}
    ${mir(`${leaf(70, 136, 14, 5, -30, '#6ccf4a')}${leaf(80, 160, 12, 4, -20, '#4cae3f')}`)}`,
    rad('jb', ['#e8c890', '#a8804a', '#54381c']) + rad('moss', ['#5fae4a', '#2f6a2a', '#123a14'], '50%', '40%', '60%') + rad('canopy', ['#9be07a', '#3f9a45', '#1a4a1e']) + rad('jaura', ['rgba(200,255,140,.5)', 'rgba(120,220,90,.15)', 'rgba(90,200,70,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── いかずち：ヒヨコ・雷鳥 ─────────────────────────
const raimeicho: Recipe = () =>
  svg(
    `${shadow(60)}
    ${mir(path('M82 98 C62 70 32 52 4 54 L22 64 L4 74 L28 80 L10 92 L34 96 L18 108 L46 108 L34 120 C56 118 70 116 84 120Z', 'url(#rw)'))}
    ${mir(`<path d="M24 66 L56 82 M16 84 L54 96 M28 102 L58 106" stroke="#2a3a8a" stroke-width="3" opacity=".7"/>`)}
    ${mir(path('M92 144 L78 184 L92 174 L100 188Z', 'url(#rt)', 1.8))}
    ${P('M100 64 C84 64 74 78 74 100 C74 126 84 146 100 152', 'url(#rb)')}
    ${P('M100 86 C92 86 86 96 86 110 C86 128 92 140 100 146', '#fff6c8', 1.2)}
    <path d="M100 96 L92 110 L100 110 L94 126 L108 106 L100 106 L106 96Z" fill="#2a3a8a" opacity=".85"/>
    ${mir(`${path('M88 148 L84 166', 'none', 3, 'stroke="#c07a1a"')}${claws(84, 166, 0.6, '#2a2030')}`)}
    ${mir(bolt(84, 22, 1.1, -30))}${bolt(100, 18, 1.3)}
    ${P('M100 30 C86 30 76 42 76 56 C76 68 86 76 100 78', 'url(#rb)')}
    ${mir(eye(88, 52, 8, '#4ad8ff'))}
    ${P('M100 58 L94 62 L97 74 L100 80', 'url(#beak2)', 1.5)}`,
    rad('rb', ['#fff09a', '#e8b81c', '#8a5a0a']) + lin('rw', ['#fff09a', '#e8b81c', '#7a4a08'], 1, 0, 0, 0) + lin('rt', ['#3a4aa0', '#1a2050']) + lin('beak2', ['#ffcf5a', '#c06a12']),
  );

// ───────────────────────── わたげの系統 ─────────────────────────
const fluff = (fill: string, strand: string, strand2: string, seed: number) => `
    <circle cx="100" cy="112" r="50" fill="${fill}" ${sw(1.5)}/>
    ${furRing(100, 112, 40, 40, 90, 16, strand, seed)}${furRing(100, 112, 46, 46, 70, 12, strand2, seed + 4)}`;

const hikariwata: Recipe = () =>
  svg(
    `<circle cx="100" cy="106" r="94" fill="url(#halo)"/>
    ${Array.from({ length: 16 }, (_, i) => `<path transform="rotate(${i * 22.5} 100 108)" d="M96 40 L100 4 L104 40Z" fill="#fff4b0" opacity=".75"/>`).join('')}
    ${shadow(46, 180)}
    ${mir(path('M56 104 C36 92 22 96 14 108 C28 110 40 116 52 124Z', 'url(#hw)', 1.5))}
    ${fluff('url(#hw)', '#fffbe0', '#f2c84a', 5)}
    ${mir(eye(86, 108, 8.5, '#ff9a1a'))}
    <path d="M94 126 Q100 130 106 126" fill="none" ${sw(1.4)}/>
    ${star(100, 62, 4, 12, 4, -90, 'url(#gold)', 1.2)}
    ${sparkle(150, 60, 8)}${sparkle(46, 66, 6)}${sparkle(160, 150, 6)}`,
    rad('hw', ['#fffbe0', '#f3d36b', '#b88a1a']) + rad('halo', ['rgba(255,250,200,.85)', 'rgba(255,230,120,.25)', 'rgba(255,230,120,0)'], '50%', '50%', '50%'),
  );

const kagewata: Recipe = () =>
  svg(
    `${shadow(40, 186)}
    ${[-30, -12, 8, 26].map((dx, i) => `<path d="M${100 + dx} 150 C${96 + dx} 166 ${110 + dx} 172 ${102 + dx} ${186 - i * 2}" stroke="#4a2f78" stroke-width="${7 - i}" fill="none" stroke-linecap="round" opacity=".9"/>`).join('')}
    ${fluff('url(#kw)', '#8a6ac0', '#2a1a48', 8)}
    ${mir(path('M56 96 C40 80 28 78 16 84 C30 90 40 98 50 110Z', 'url(#kw)', 1.5))}
    ${mir(eye(84, 106, 10, '#d07aff', true))}
    <path d="M86 128 L92 124 L98 130 L104 124 L110 130 L114 126" fill="none" stroke="#e8c8ff" stroke-width="1.6"/>
    ${[[40, 60], [160, 70], [150, 40], [52, 150]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="#6a4a9a" opacity=".45"/>`).join('')}`,
    rad('kw', ['#8a6ac0', '#4a2f78', '#1a0e30']),
  );

const kazewata: Recipe = () =>
  svg(
    `${shadow(46, 182)}
    <path d="M30 140 C10 110 30 60 80 54 C130 48 170 80 160 120" fill="none" stroke="#bff4ec" stroke-width="5" opacity=".75"/>
    <path d="M170 100 C190 130 160 172 110 176 C70 178 40 160 36 130" fill="none" stroke="#e8fffb" stroke-width="3" opacity=".8"/>
    ${fluff('url(#zw)', '#e8fffb', '#2a9a8a', 11)}
    ${mir(path('M56 90 C46 70 50 52 62 40 C62 58 66 72 72 84Z', 'url(#zw)', 1.5))}
    ${path('M100 62 C92 44 98 26 114 16 C110 34 112 48 116 62Z', 'url(#zw)', 1.5)}
    ${mir(eye(84, 108, 9.5, '#1ad0b0'))}
    <path d="M90 128 Q100 124 110 130" fill="none" ${sw(1.5)}/>
    ${[[24, 90], [176, 70], [168, 160]].map(([x, y]) => `<path d="M${x - 10} ${y} Q${x} ${y - 6} ${x + 10} ${y}" stroke="#e8fffb" stroke-width="2.5" fill="none"/>`).join('')}`,
    rad('zw', ['#d8fff8', '#5cc7b8', '#1a6a60']),
  );

// ───────────────────────── いわお：モグラの系統・サル ─────────────────────────
const gankutsu: Recipe = () =>
  svg(
    `${shadow(70)}
    ${path('M24 130 C20 80 56 40 100 38 C144 40 180 80 176 130 C150 120 50 120 24 130Z', 'url(#rock)')}
    ${[[50, 86], [76, 62], [100, 54], [124, 62], [150, 86], [64, 108], [100, 84], [136, 108]].map(([x, y], i) => star(x, y, 3 + (i % 3), 16, 11, i * 17, i % 2 ? 'url(#rock)' : 'url(#rock2)', 1.6)).join('')}
    ${[[70, 72], [130, 96]].map(([x, y]) => `<path d="M${x} ${y} L${x + 6} ${y - 12} L${x + 12} ${y}Z" fill="#9fe6ff" ${sw(1.2)}/>`).join('')}
    ${P('M100 86 C74 86 56 104 54 128 C52 154 70 176 100 180', 'url(#gk)')}
    ${P('M100 118 C88 118 80 130 80 146 C82 162 90 172 100 174', '#a8845a', 1.2)}
    ${mir(`${path('M58 132 C34 134 18 150 16 170 C30 176 48 172 62 160Z', '#d8a890', 2)}${[18, 28, 38, 48].map((x, i) => `<path d="M${x} ${170 - i * 3} L${x - 6} ${188 - i * 2} L${x + 6} ${172 - i * 3}Z" fill="#f8f0e0" ${sw(1.4)}/>`).join('')}`)}
    ${mir(eye(86, 116, 7, '#ff9a3a', true))}
    <path d="M92 126 Q100 120 108 126 L104 136 Q100 140 96 136Z" fill="#e8808f" ${sw(1.5)}/>
    <path d="M90 146 Q100 150 110 146" fill="none" ${sw(1.6)}/>`,
    rad('gk', ['#a8845a', '#6a4a2a', '#2e1c0c']) + rad('rock2', ['#c8c0b4', '#8a8278', '#4a443e']),
  );

// ───────────────────────── はやて：鳥の系統 ─────────────────────────
const arashiwashi: Recipe = () =>
  svg(
    `${shadow(64)}
    ${mir(path('M84 96 C64 66 34 48 2 50 L20 60 L2 70 L26 76 L6 88 L32 92 L14 104 L42 104 L30 118 C54 116 72 116 86 120Z', 'url(#aw)'))}
    ${mir(`<path d="M20 62 L56 80 M12 82 L52 94 M24 100 L58 104" stroke="#1a3a5a" stroke-width="2.5" opacity=".7"/>`)}
    ${mir(path('M92 142 L76 186 L92 176 L100 190Z', '#2a4a6a', 1.8))}
    ${P('M100 62 C82 62 72 78 72 100 C72 126 84 146 100 152', 'url(#ab)')}
    ${mir(`${path('M88 148 L84 168', 'none', 3, 'stroke="#d0a01a"')}${claws(84, 168, 0.7, '#1a1420')}`)}
    ${P('M100 24 C84 24 72 36 72 52 C72 66 84 76 100 78', 'url(#ah)')}
    ${mir(path('M76 40 L58 30 L66 44 L52 46 L72 54Z', 'url(#ah)', 1.5))}
    ${mir(eye(87, 48, 8.5, '#ffd84a'))}
    ${P('M100 52 L92 58 L96 70 L100 78', 'url(#beak2)', 1.5)}
    ${bolt(30, 130, 0.8, 20, '#e8fbff')}${bolt(170, 130, 0.8, -20, '#e8fbff')}`,
    rad('ab', ['#7ad0e0', '#3f9fb8', '#14445a']) + lin('aw', ['#c8f0fa', '#3f9fb8', '#123a50'], 1, 0, 0, 0) + rad('ah', ['#ffffff', '#e0eef4', '#9ab0bc']) + lin('beak2', ['#ffd85a', '#c0820c']),
  );

// ───────────────────────── かげ：蛾の系統 ─────────────────────────
const lantern = (x: number, y: number, r: number) =>
  `<circle cx="${x}" cy="${y}" r="${r * 1.8}" fill="url(#glowY)" opacity=".8"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 1.25}" fill="url(#lan)" ${sw(1.4)}/><path d="M${x - r} ${y - r * 0.4} H${x + r} M${x - r} ${y + r * 0.4} H${x + r}" stroke="#8a3a0a" stroke-width="1" opacity=".7"/>`;

const yamitourou: Recipe = () =>
  svg(
    `<ellipse cx="100" cy="100" rx="96" ry="80" fill="url(#mist)"/>
    ${shadow(60)}
    ${mir(path('M92 92 C54 20 0 30 2 88 C2 128 54 134 90 114Z', 'url(#tw)'))}
    ${mir(path('M92 116 C56 124 22 146 30 176 C40 194 80 174 94 132Z', 'url(#tw2)'))}
    ${mir(`${lantern(40, 66, 13)}${lantern(28, 104, 9)}${lantern(62, 96, 8)}${lantern(56, 160, 9)}<path d="M14 54 Q50 90 86 102 M10 120 Q50 116 88 112" stroke="#150a24" stroke-width="1.5" fill="none" opacity=".7"/>`)}
    ${P('M100 60 C88 60 84 78 84 100 C84 132 92 160 100 172', 'url(#tb)')}
    ${[108, 122, 136, 150, 162].map((y) => `<path d="M86 ${y} Q100 ${y + 4} 114 ${y}" stroke="#150a24" stroke-width="1.4" fill="none"/>`).join('')}
    ${lantern(100, 136, 7)}
    ${furRing(100, 80, 13, 13, 30, 7, '#9a7ac8', 12)}
    ${mir(path('M94 54 C80 30 66 14 48 6 C56 24 66 40 84 58Z', '#3a2460', 1.4))}
    ${mir(`<path d="M76 32 L66 36 M68 22 L58 26 M60 14 L50 18" stroke="#3a2460" stroke-width="1.6"/>`)}
    ${P('M100 48 C88 48 82 58 82 68 C82 80 90 86 100 86', 'url(#tb)')}
    ${mir(eye(89, 66, 8, '#ffb43a', true))}`,
    rad('tb', ['#8a6ab8', '#4a2f78', '#180c30']) + rad('tw', ['#9a80c8', '#5a3f8a', '#150a28']) + rad('tw2', ['#7a60a8', '#3e2868', '#120822']) + rad('lan', ['#fffbd0', '#ffb43a', '#d0500a']) + rad('mist', ['rgba(120,80,180,.35)', 'rgba(80,50,130,.12)', 'rgba(60,30,100,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── ひかり：森の主 ─────────────────────────
const hotarunoou: Recipe = () =>
  svg(
    `<circle cx="100" cy="100" r="98" fill="url(#halo2)"/>
    ${mir(path('M92 100 C50 30 2 40 4 96 C6 134 56 134 90 116Z', 'url(#hw2)', 1.5, 'fill-opacity=".85"'))}
    ${mir(path('M92 118 C60 128 28 150 36 178 C46 194 82 172 94 134Z', 'url(#hw2)', 1.5, 'fill-opacity=".8"'))}
    ${mir(`<path d="M14 80 Q50 92 86 104 M24 56 Q56 80 88 98 M40 160 Q66 140 90 124" stroke="#8aa83a" stroke-width="1.2" fill="none"/>`)}
    ${P('M100 112 C84 112 76 128 76 146 C76 168 86 182 100 186', 'url(#abd)')}
    ${[128, 142, 156, 170].map((y) => `<path d="M80 ${y} Q100 ${y + 5} 120 ${y}" stroke="#7a8a1a" stroke-width="1.5" fill="none"/>`).join('')}
    <ellipse cx="100" cy="164" rx="18" ry="18" fill="url(#glowY)"/>
    ${P('M100 72 C86 72 78 84 78 100 C78 112 86 120 100 122', 'url(#hb3)')}
    ${mir(`${path('M86 80 L66 96 L64 112', 'none', 3)}${path('M84 100 L62 118 L66 134', 'none', 3)}${path('M86 112 L70 136 L76 152', 'none', 3)}`)}
    ${mir(path('M92 36 C84 20 72 10 56 8 C64 16 68 22 72 30', 'none', 2.4))}
    ${mir('<circle cx="56" cy="8" r="5" fill="#fffbd0" stroke="#1c1424" stroke-width="1.5"/>')}
    ${P('M100 34 C84 34 74 46 74 60 C74 74 86 82 100 84', 'url(#hb3)')}
    ${path('M78 40 L84 22 L92 34 L100 16 L108 34 L116 22 L122 40Z', 'url(#gold)', 1.6)}
    ${[84, 100, 116].map((x, i) => `<circle cx="${x}" cy="${[24, 18, 24][i]}" r="2.5" fill="#ff5a3a"/>`).join('')}
    ${mir(eye(86, 60, 10, '#d9ff5a', true))}
    <path d="M90 76 Q100 80 110 76" fill="none" ${sw(1.6)}/>
    ${[[30, 150], [170, 150], [36, 36], [164, 40], [16, 110], [184, 110], [60, 186], [140, 186]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="url(#glowY)"/><circle cx="${x}" cy="${y}" r="2.5" fill="#fffbd0"/>`).join('')}`,
    rad('hb3', ['#e8ff9a', '#9ab83a', '#3e5a10']) + rad('abd', ['#fffbd0', '#e8f27a', '#8a9a1a']) + rad('hw2', ['#f8ffd8', '#d9f27a', '#7a9a2a']) + rad('halo2', ['rgba(240,255,160,.6)', 'rgba(220,255,120,.18)', 'rgba(200,255,100,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── 進化前：かわいい姿 ─────────────────────────
// 頭を大きく・体は丸く・目は大きな丸目。進化するとつり目・筋肉・炎やよろいが増えて強そうになる。

/** 大きな丸い目（左目として描く。mir で右目もできる） */
function cuteEye(cx: number, cy: number, r: number, iris: string): string {
  return `<g transform="translate(${cx} ${cy})">
    <ellipse rx="${r}" ry="${r * 1.15}" fill="#fff" ${sw(r * 0.1)}/>
    <ellipse cy="${r * 0.12}" rx="${r * 0.8}" ry="${r * 0.95}" fill="${iris}"/>
    <ellipse cy="${r * 0.42}" rx="${r * 0.62}" ry="${r * 0.42}" fill="#fff" opacity=".22"/>
    <ellipse cy="${r * 0.2}" rx="${r * 0.42}" ry="${r * 0.55}" fill="#120a14"/>
    <circle cx="${-r * 0.3}" cy="${-r * 0.32}" r="${r * 0.33}" fill="#fff"/>
    <circle cx="${r * 0.32}" cy="${r * 0.4}" r="${r * 0.14}" fill="#fff"/>
  </g>`;
}
const blush = (x: number, y: number, rx = 8) => mir(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.55}" fill="#ff7a9a" opacity=".45"/>`);
const cuteMouth = (y: number, w = 6) => `<path d="M${100 - w} ${y} Q${100 - w / 2} ${y + w * 0.7} 100 ${y} Q${100 + w / 2} ${y + w * 0.7} ${100 + w} ${y}" fill="none" ${sw(1.6)}/>`;

const hinokoro: Recipe = () =>
  svg(
    `${shadow(44)}
    ${path('M124 162 C150 168 170 150 164 124 C156 138 144 146 130 148Z', 'url(#hb)')}
    ${flame(164, 128, 30, 11, 14)}
    <ellipse cx="100" cy="152" rx="32" ry="28" fill="url(#hb)" ${sw()}/>
    <ellipse cx="100" cy="158" rx="18" ry="16" fill="url(#hc)"/>
    ${mir(`<ellipse cx="84" cy="178" rx="10" ry="7" fill="url(#hb)" ${sw()}/>`)}
    ${mir(`${path('M62 76 C52 56 52 36 60 22 C72 30 86 46 92 62Z', 'url(#hb)')}${path('M66 68 C60 54 60 42 64 32 C72 40 80 50 84 60Z', '#ff9a8a', 0, 'opacity=".8"')}`)}
    <circle cx="100" cy="96" r="48" fill="url(#hb)" ${sw()}/>
    ${P('M100 98 C88 98 72 104 64 116 C70 132 86 140 100 140', 'url(#hc)', 1.5)}
    ${mir(cuteEye(80, 94, 12, '#c8641a'))}
    ${blush(68, 116)}
    <ellipse cx="100" cy="114" rx="6" ry="4.5" fill="${OUT}"/><ellipse cx="98" cy="113" rx="2" ry="1.2" fill="#fff" opacity=".7"/>
    ${cuteMouth(121)}
    ${flame(100, 62, 16, 6)}`,
    rad('hb', ['#ffc08a', '#f58a46', '#c4541e']) + rad('hc', ['#fffcf4', '#fbe8d2', '#e4c4a0']),
  );

const shizukun: Recipe = () =>
  svg(
    `${shadow(48)}
    ${path('M126 160 C152 168 172 156 168 136 C160 148 146 152 132 150Z', 'url(#sb)')}
    <ellipse cx="100" cy="154" rx="38" ry="26" fill="url(#sb)" ${sw()}/>
    <ellipse cx="100" cy="160" rx="24" ry="15" fill="#e2f4ff"/>
    ${mir(`<ellipse cx="74" cy="176" rx="11" ry="7" fill="url(#sb)" ${sw()}/>`)}
    ${mir([[44, 88, -30], [40, 104, 0], [46, 120, 30]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="6" transform="rotate(${r} ${x} ${y})" fill="url(#gill)" ${sw(1.5)}/>`).join(''))}
    <ellipse cx="100" cy="104" rx="52" ry="42" fill="url(#sb)" ${sw()}/>
    ${mir(cuteEye(80, 102, 12, '#2a6ab8'))}
    ${blush(66, 122)}
    ${cuteMouth(124, 8)}
    <path d="M100 26 C90 42 84 50 84 60 C84 70 92 76 100 76 C108 76 116 70 116 60 C116 50 110 42 100 26Z" fill="url(#drop)" fill-opacity=".92" ${sw(2)}/>
    <ellipse cx="94" cy="56" rx="3" ry="7" fill="#fff" opacity=".85"/>`,
    rad('sb', ['#b4e6ff', '#5aa8ec', '#2a64a8']) + rad('gill', ['#ffe8f0', '#ff9ab8', '#d0507a']) + rad('drop', ['#ffffff', '#b8ecff', '#4aa8ee']),
  );

const mebukin: Recipe = () =>
  svg(
    `${shadow(50)}
    ${Array.from({ length: 9 }, (_, i) => {
      const a = -72 + i * 18;
      const r = (a * Math.PI) / 180;
      return leaf(100 + Math.sin(r) * 30, 112 - Math.cos(r) * 28, 34, 13, a, i % 2 ? 'url(#lf)' : 'url(#lf2)');
    }).join('')}
    <circle cx="100" cy="124" r="50" fill="url(#mb2)" ${sw()}/>
    ${P('M100 96 C82 96 64 108 62 128 C62 150 80 164 100 164', 'url(#mf)', 1.5)}
    ${mir(`<ellipse cx="80" cy="176" rx="11" ry="7" fill="#7a5032" ${sw(1.5)}/>`)}
    ${mir(cuteEye(82, 124, 11, '#3a8a2a'))}
    ${blush(70, 144)}
    <ellipse cx="100" cy="142" rx="5" ry="4" fill="${OUT}"/>
    ${cuteMouth(149, 5)}
    ${leaf(100, 76, 18, 7, 10, 'url(#lf)')}`,
    rad('mb2', ['#a88464', '#7a5a3a', '#4a3220']) + rad('mf', ['#fffaf0', '#f6e4c8', '#d8b68e']) + lin('lf', ['#3f9a3a', '#7ad85a', '#d2f8a8'], 0, 1, 0, 0) + lin('lf2', ['#2f8a2a', '#5cc04a', '#b2ec88'], 0, 1, 0, 0),
  );

const piricchi: Recipe = () =>
  svg(
    `${shadow(46)}
    ${bolt(100, 54, 1.1, 8)}
    ${mir(`<ellipse cx="52" cy="122" rx="14" ry="9" transform="rotate(-30 52 122)" fill="url(#pw)" ${sw()}/>`)}
    ${mir(path('M88 166 L86 180 M86 180 L80 184 M86 180 L86 186 M86 180 L92 184', 'none', 2.5, 'stroke="#e0901a"'))}
    <circle cx="100" cy="116" r="52" fill="url(#pb)" ${sw()}/>
    ${furRing(100, 116, 48, 48, 30, 4, '#ffeb8a', 3)}
    <ellipse cx="100" cy="138" rx="28" ry="22" fill="#fff8d0" opacity=".9"/>
    ${mir(cuteEye(80, 108, 12, '#2a7ad8'))}
    ${blush(64, 128)}
    ${P('M100 118 L92 124 L100 132', 'url(#beak)', 1.5)}`,
    rad('pb', ['#fff8b8', '#ffd84a', '#d8a018']) + rad('pw', ['#fff8b8', '#f2c42c', '#b8840c']) + lin('beak', ['#ffc04a', '#e8801a'], 0, 0, 0, 1),
  );

const koishimo: Recipe = () =>
  svg(
    `${shadow(48)}
    <circle cx="100" cy="122" r="50" fill="url(#ko)" ${sw()}/>
    ${[[80, 76, 12], [104, 70, 13], [124, 82, 10]].map(([x, y, r], i) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r * 0.8}" fill="${i === 1 ? 'url(#rock2)' : 'url(#rock)'}" ${sw(1.6)}/>`).join('')}
    ${P('M100 112 C86 112 74 122 72 136 C74 154 88 164 100 164', '#e2c4a0', 1.2)}
    ${mir(`${path('M58 140 C46 142 40 152 42 160 C50 162 58 158 64 152Z', '#f6c8b8', 1.8)}${[44, 50, 56].map((x) => `<path d="M${x} 160 l-1 6 l4 -5Z" fill="#fff" ${sw(1)}/>`).join('')}`)}
    ${mir(`<ellipse cx="82" cy="176" rx="11" ry="6" fill="#f6c8b8" ${sw(1.5)}/>`)}
    ${mir(cuteEye(82, 116, 10, '#5a3a22'))}
    ${blush(70, 134)}
    <ellipse cx="100" cy="132" rx="8" ry="6" fill="#ff8fa8" ${sw(1.5)}/><ellipse cx="97" cy="130" rx="2.5" ry="1.5" fill="#fff" opacity=".7"/>
    ${cuteMouth(143, 5)}`,
    rad('ko', ['#c8a884', '#9a7652', '#5e4228']) + rad('rock2', ['#d8d0c4', '#a09888', '#5e5850']),
  );

const kazamidori: Recipe = () =>
  svg(
    `${shadow(44)}
    ${mir(path('M92 156 L80 176 L94 170Z', 'url(#zt)', 1.6))}
    ${mir(`<ellipse cx="54" cy="122" rx="15" ry="9" transform="rotate(-24 54 122)" fill="url(#zw2)" ${sw()}/>`)}
    ${mir(path('M90 160 L88 178 M88 178 L82 182 M88 178 L94 182', 'none', 2.5, 'stroke="#e0901a"'))}
    <circle cx="100" cy="118" r="48" fill="url(#zb)" ${sw()}/>
    <ellipse cx="100" cy="140" rx="26" ry="20" fill="#f4fcff" opacity=".9"/>
    ${path('M100 72 L98 52 L114 48 L108 56 L120 60 L102 62 L101 72Z', 'url(#gold)', 1.5)}
    ${mir(cuteEye(80, 110, 12, '#e0661a'))}
    ${blush(64, 130)}
    ${P('M100 120 L92 126 L100 134', 'url(#beak2)', 1.5)}`,
    rad('zb', ['#e0f8ff', '#9ad8e6', '#4a96aa']) + lin('zw2', ['#f0fcff', '#9ad8e6', '#4a86a0'], 1, 0, 0, 0) + lin('zt', ['#7ac0d4', '#2a5a70']) + lin('beak2', ['#ffcf5a', '#d8801a']),
  );

const yoiyami: Recipe = () =>
  svg(
    `${shadow(46)}
    ${mir(`<ellipse cx="56" cy="104" rx="34" ry="28" transform="rotate(-20 56 104)" fill="url(#yw)" ${sw()}/>`)}
    ${mir(`<ellipse cx="66" cy="148" rx="20" ry="16" transform="rotate(20 66 148)" fill="url(#yw2)" ${sw()}/>`)}
    ${mir(`${lantern(48, 100, 9)}${lantern(64, 150, 6)}`)}
    <ellipse cx="100" cy="128" rx="30" ry="40" fill="url(#yb)" ${sw()}/>
    ${furRing(100, 112, 24, 22, 34, 6, '#d8c4f0', 9)}
    ${mir(path('M92 84 C86 68 78 58 70 54', 'none', 2.4))}
    ${mir(`<circle cx="70" cy="54" r="6" fill="#ffd27a" ${sw(1.5)}/>`)}
    <circle cx="100" cy="110" r="30" fill="url(#yb)" ${sw()}/>
    ${mir(cuteEye(88, 108, 10, '#ffb43a'))}
    ${blush(78, 124, 6)}
    ${cuteMouth(124, 5)}`,
    rad('yb', ['#c8b0e8', '#8a6ac0', '#4a3278']) + rad('yw', ['#d8c8f4', '#9a80cc', '#5a3f8a']) + rad('yw2', ['#c8b4ea', '#8064b4', '#4a3278']) + rad('lan', ['#fffbd0', '#ffc04a', '#e07a1a']),
  );

const fuwamo: Recipe = () =>
  svg(
    `${shadow(46, 180)}
    ${fluff('url(#fw)', '#fffaf0', '#e0d4c0', 2)}
    <circle cx="100" cy="116" r="32" fill="url(#fwc)" opacity=".7"/>
    ${mir(cuteEye(84, 108, 11, '#8a6a4a'))}
    ${blush(72, 126, 7)}
    ${cuteMouth(128, 5)}
    ${mir(`<ellipse cx="84" cy="168" rx="9" ry="6" fill="#efe4d0" ${sw(1.5)}/>`)}`,
    rad('fw', ['#ffffff', '#f4ede0', '#c8b8a0']) + rad('fwc', ['#ffffff', 'rgba(255,255,255,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── 伝説：チョンボ（千年の松の根元に生える灯獣） ─────────────────────────
// ボッキーの 血管（軸と かさに うき出る。太い線＋明るいふちで もり上がって見せる）
const BOKKI_VEIN_PATHS = [
  'M100 186 C96 170 104 158 98 146 C94 138 100 128 96 120',
  'M98 146 C88 142 84 134 80 126',
  'M100 160 C110 154 112 146 118 140',
  'M84 184 C80 172 86 162 80 150 C77 144 78 138 74 132',
  'M116 184 C120 172 114 164 120 154 C123 148 122 142 126 136',
  'M80 150 C86 148 90 152 94 150',
  'M120 154 C114 152 110 156 106 154',
  'M100 18 C96 30 102 40 96 52 C92 60 96 70 92 78',
  'M96 52 C86 50 80 56 72 54',
  'M100 34 C110 40 108 52 116 58 C120 62 118 70 122 76',
  'M70 36 C74 46 70 56 66 64',
  'M130 36 C126 46 130 56 134 64',
];
const BOKKI_VEINS = BOKKI_VEIN_PATHS.map(
  (d) => `<path d="${d}" stroke="#7a1a2a" stroke-width="5" fill="none" stroke-linecap="round" opacity=".85"/><path d="${d}" stroke="#d8506a" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#ffb0b8" stroke-width="0.9" fill="none" stroke-linecap="round" opacity=".8" transform="translate(-0.8 -0.8)"/>`,
).join('') + [[62, 150], [138, 146], [100, 196]].map(([x, y]) => `<path d="M${x} ${y} l-5 3 M${x} ${y} l5 3" stroke="#ff8a6a" stroke-width="2" opacity=".8"/>`).join('');

/** チョンボの絵。power=true でボッキー（血管が うき出た 力の すがた） */
const matsuArt = (power: boolean) =>
  svg(
    `<circle cx="100" cy="100" r="98" fill="url(#caura)"/>
    ${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      const x = 100 + Math.cos(a) * 82;
      const y = 104 + Math.sin(a) * 76;
      return `<path d="M${x.toFixed(1)} ${y.toFixed(1)} l-6 -9 M${x.toFixed(1)} ${y.toFixed(1)} l6 -9" stroke="#3f7a3a" stroke-width="2"/>`;
    }).join('')}
    ${[[30, 40], [170, 46], [20, 130], [180, 120], [58, 20], [146, 18]].map(([x, y]) => sparkle(x, y, 5, '#fff2a8')).join('')}
    ${shadow(58)}
    ${mir(`<path d="M80 176 C70 180 58 182 46 188 M86 180 C80 186 74 190 66 194" stroke="#7a5a32" stroke-width="4" fill="none"/>`)}
    ${mir(`${path('M80 122 C64 120 50 110 42 96', 'none', 6, 'stroke="#8a6438"')}${[-40, -20, 0, 20, 40].map((r) => `<path transform="rotate(${r} 42 96)" d="M42 96 L42 76" stroke="#2f6a2a" stroke-width="2"/>`).join('')}`)}
    ${P('M100 78 C86 78 72 82 70 96 C68 124 66 152 62 174 C68 184 84 188 100 188', 'url(#stem)')}
    ${P('M100 82 C88 82 76 84 71 90 L70 104 C80 100 90 100 100 100', '#9a6a3a', 0, 'opacity=".55"')}
    ${[[82, 108], [118, 110], [86, 150], [114, 156], [80, 172], [120, 172], [100, 104]].map(([x, y]) => `<path d="M${x - 6} ${y} Q${x} ${y - 5} ${x + 6} ${y}" stroke="#8a5a2e" stroke-width="2" fill="none" opacity=".7"/>`).join('')}
    ${[88, 94, 100, 106, 112].map((x) => `<path d="M${x} 92 Q${x + (x - 100) * 0.3} 140 ${x + (x - 100) * 0.6} 182" stroke="#b89a70" stroke-width="1" fill="none" opacity=".6"/>`).join('')}
    ${P('M100 120 C88 120 76 118 70 116 L69 130 C78 134 90 136 100 136', 'url(#rope)', 1.5)}
    ${mir([76, 84, 92].map((x) => `<path d="M${x} 118 L${x - 5} 132" stroke="#6a4a1a" stroke-width="1.5"/>`).join(''))}
    ${mir(path('M80 134 L76 144 L84 148 L78 160 L86 162', 'none', 3, 'stroke="#fffdf4"'))}
    ${P('M100 78 C88 78 74 78 64 80 C70 86 86 88 100 88', '#f0e2c4', 1.5)}
    ${mir([68, 76, 84, 92].map((x) => `<path d="M${x} 81 L${x + 3} 87" stroke="#c8ae84" stroke-width="1"/>`).join(''))}
    ${P('M100 12 C78 12 58 28 54 54 C52 68 56 78 66 81 C78 83 90 83 100 83', 'url(#cap)')}
    ${mir([72, 82, 92].map((x) => `<path d="M100 16 Q${x} 36 ${x - 12} 78" stroke="#3a2008" stroke-width="1.4" fill="none" opacity=".45"/>`).join(''))}
    ${mir(`<path d="M66 46 l8 -3 M78 30 l6 -4 M60 64 l8 -2" stroke="#e8c898" stroke-width="2" opacity=".6"/>`)}
    ${power ? BOKKI_VEINS : ''}
    ${mir(eye(87, 104, 8.5, power ? '#ff5a3a' : '#ffd84a', true))}
    ${power ? mir('<path d="M78 94 L94 99" stroke="#2a1008" stroke-width="3.4" stroke-linecap="round"/>') : ''}
    ${power ? '<path d="M88 117 L112 117" stroke="#2a1008" stroke-width="3" stroke-linecap="round"/><path d="M92 117 L92 120 M100 117 L100 120 M108 117 L108 120" stroke="#2a1008" stroke-width="1.4"/>' : '<path d="M90 115 Q100 111 110 115" fill="none" ' + sw(2) + '/>'}`,
    (power ? rad('stem', ['#ffe8d8', '#e8b898', '#a8664a']) : rad('stem', ['#fffaf0', '#ecdcbc', '#a8875a'])) + (power ? rad('cap', ['#e8946a', '#a8462a', '#5a1a10'], '40%', '25%', '80%') : rad('cap', ['#d8a46a', '#9a5e2a', '#4a2a10'], '40%', '25%', '80%')) + lin('rope', ['#f6e6b8', '#c8a050', '#8a6420']) + (power ? rad('caura', ['rgba(255,150,110,.75)', 'rgba(240,90,70,.3)', 'rgba(220,60,60,0)'], '50%', '50%', '50%') : rad('caura', ['rgba(255,240,170,.7)', 'rgba(220,240,140,.25)', 'rgba(200,230,120,0)'], '50%', '50%', '50%')),
  );

const chonbo: Recipe = () => matsuArt(false);
const bokki: Recipe = () => matsuArt(true);

export const MONSTER_ART: Record<string, Recipe> = {
  hinokoro,
  kagurabi,
  homuragitsune,
  shizukun,
  minamodra,
  uzushiodra,
  mebukin,
  morinonushi,
  jukaiou,
  piricchi,
  raimeicho,
  fuwamo,
  hikariwata,
  kagewata,
  kazewata,
  koishimo,
  gankutsu,
  kazamidori,
  arashiwashi,
  yoiyami,
  yamitourou,
  hotarunoou,
  chonbo,
  bokki,
};

// ───────────────────────── 設計図から描く灯獣（2つ目の町以降） ─────────────────────────
// src/data/speciesExtra.ts の GEN_ART（体の形・段階・色・属性）から絵を組み立てる。
// 段階 1=かわいい（大きな丸い目・丸い体）、2=カッコいい（つり目・とがった耳や角）、3=いちばん強そう（光る目・オーラ・飾りが増える）

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function tone(c: string, amt: number): string {
  const [r, g, b] = hex(c);
  const f = (v: number) => Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt));
  return `#${[f(r), f(g), f(b)].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`;
}

/** 左右対称に置く（中心 cx を軸に反転） */
const mirAt = (c: string, cx: number) => `${c}<g transform="translate(${cx * 2} 0) scale(-1 1)">${c}</g>`;

/** 属性の飾り（頭の上）。s は段階 */
function featureTop(el: GenArt['feature'], s: number, x: number, y: number, acc: string): string {
  const k = 0.7 + s * 0.3;
  switch (el) {
    case 'blaze':
      return s === 1 ? flame(x, y, 18, 7) : flame(x - 8, y + 2, 22 * k, 8, -18) + flame(x + 8, y + 2, 22 * k, 8, 18) + flame(x, y, 30 * k, 10);
    case 'tide':
      return s === 1
        ? `<path d="M${x} ${y - 24} C${x - 8} ${y - 12} ${x - 12} ${y - 6} ${x - 12} ${y} C${x - 12} ${y + 8} ${x + 12} ${y + 8} ${x + 12} ${y} C${x + 12} ${y - 6} ${x + 8} ${y - 12} ${x} ${y - 24}Z" fill="#bfeaff" ${sw(1.6)}/>`
        : `<path d="M${x - 14} ${y + 4} C${x - 16} ${y - 10} ${x - 6} ${y - 26 * k} ${x + 8} ${y - 34 * k} C${x + 2} ${y - 20} ${x + 12} ${y - 12} ${x + 16} ${y + 4}Z" fill="url(#gTide)" ${sw(1.6)}/>`;
    case 'sprout':
      return s === 1
        ? leaf(x - 4, y, 20, 8, -20, '#6ccf4a') + leaf(x + 4, y, 16, 7, 24, '#4cae3a')
        : [-50, -25, 0, 25, 50].slice(s === 2 ? 1 : 0, s === 2 ? 4 : 5).map((a) => leaf(x, y + 4, 26 * k, 9, a, a % 50 ? '#5cc04a' : '#3f9a3a')).join('');
    case 'volt':
      return s === 1 ? bolt(x, y - 10, 0.9, 10) : bolt(x - 12, y - 10, 1.1 * k, -20) + bolt(x + 12, y - 10, 1.1 * k, 20) + (s === 3 ? bolt(x, y - 22, 1.3, 0) : '');
    case 'stone':
      return s === 1
        ? `<ellipse cx="${x}" cy="${y - 6}" rx="10" ry="8" fill="url(#rock)" ${sw(1.5)}/>`
        : [-16, 0, 16].map((dx, i) => `<path d="M${x + dx - 7} ${y + 4} L${x + dx} ${y - (i === 1 ? 30 : 20) * k} L${x + dx + 7} ${y + 4}Z" fill="${s === 3 ? 'url(#gGem)' : 'url(#rock)'}" ${sw(1.5)}/>`).join('');
    case 'gale':
      return s === 1
        ? `<path d="M${x} ${y} C${x - 10} ${y - 14} ${x + 6} ${y - 22} ${x + 10} ${y - 12}" fill="none" stroke="#e8fbff" stroke-width="5"/>`
        : [-14, 0, 14].map((dx) => `<path d="M${x + dx - 4} ${y + 4} C${x + dx - 6} ${y - 14} ${x + dx * 1.6} ${y - 26 * k} ${x + dx * 2} ${y - 30 * k} C${x + dx * 0.8 + 2} ${y - 16} ${x + dx + 6} ${y - 6} ${x + dx + 4} ${y + 4}Z" fill="${acc}" ${sw(1.4)}/>`).join('');
    case 'shine':
      return s === 1
        ? star(x, y - 10, 5, 10, 4.5, -90, 'url(#gold)', 1.5)
        : `<ellipse cx="${x}" cy="${y - 10}" rx="${22 * k}" ry="${7 * k}" fill="none" stroke="#ffe680" stroke-width="${3 + s}"/>${star(x, y - 12, 4, 9 * k, 3.5, -90, 'url(#gold)', 1.2)}`;
    case 'shade':
      return mirAt(
        `<path d="M${x - 10} ${y + 6} C${x - 18} ${y - 6} ${x - 22} ${y - (s === 1 ? 10 : 30 * k)} ${x - (s === 1 ? 14 : 30)} ${y - (s === 1 ? 14 : 40 * k)} C${x - 12} ${y - 16} ${x - 6} ${y - 6} ${x - 2} ${y + 6}Z" fill="${s === 1 ? tone(acc, 0.2) : '#2a1a3a'}" ${sw(1.5)}/>`,
        x,
      );
    default:
      return s === 1
        ? `<path d="M${x - 6} ${y + 2} C${x - 8} ${y - 12} ${x + 2} ${y - 16} ${x} ${y - 6} C${x + 4} ${y - 16} ${x + 12} ${y - 8} ${x + 6} ${y + 2}Z" fill="${acc}" ${sw(1.4)}/>`
        : furRing(x, y + 10, 16, 8, 18, 10 * k, acc, 4);
  }
}

/** 最終進化の後光（オーラ） */
const auraFx = (c: string) =>
  `<circle cx="100" cy="104" r="96" fill="url(#gAura)"/>${Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `<path d="M${(100 + Math.cos(a) * 60).toFixed(1)} ${(104 + Math.sin(a) * 60).toFixed(1)} L${(100 + Math.cos(a + 0.05) * 92).toFixed(1)} ${(104 + Math.sin(a + 0.05) * 92).toFixed(1)}" stroke="${c}" stroke-width="3" opacity=".35"/>`;
  }).join('')}`;

/** 顔。段階1は丸目のかわいい顔、2・3はつり目（3は光る目） */
function face(s: number, y: number, r: number, iris: string, plan: Plan): string {
  if (s === 1) {
    const er = r * 0.27;
    const nose =
      plan === 'bird'
        ? P(`M100 ${y + r * 0.26} L${100 - r * 0.16} ${y + r * 0.38} L100 ${y + r * 0.52}`, 'url(#gold)', 1.5)
        : `<ellipse cx="100" cy="${y + r * 0.3}" rx="${r * 0.1}" ry="${r * 0.07}" fill="${OUT}"/>${cuteMouth(y + r * 0.44, r * 0.13)}`;
    return `${mir(cuteEye(100 - r * 0.42, y - r * 0.02, er, iris))}${blush(100 - r * 0.66, y + r * 0.42, r * 0.17)}${nose}`;
  }
  const glow = s === 3;
  const e = mir(eye(100 - r * 0.42, y - r * 0.02, r * 0.27, iris, glow));
  const brow = mir(`<path d="M${100 - r * 0.78} ${y - r * 0.36} L${100 - r * 0.14} ${y - r * 0.18}" stroke="${OUT}" stroke-width="${(r * 0.09).toFixed(1)}" stroke-linecap="round"/>`);
  const mouth =
    plan === 'bird'
      ? P(`M100 ${y + r * 0.18} L${100 - r * 0.2} ${y + r * 0.3} L100 ${y + r * 0.62}`, 'url(#gold)', 1.6)
      : `<path d="M${100 - r * 0.22} ${y + r * 0.46} Q100 ${y + r * 0.56} ${100 + r * 0.22} ${y + r * 0.46}" fill="none" ${sw(1.8)}/>${mir(`<path d="M${100 - r * 0.16} ${y + r * 0.48} l${r * 0.05} ${r * 0.14} l${r * 0.05} ${-r * 0.13}Z" fill="#fff" ${sw(0.8)}/>`)}`;
  return `${e}${brow}${mouth}`;
}

/** 耳・角など（頭の形ごと） */
function ears(plan: Plan, s: number, y: number, r: number): string {
  const k = s === 1 ? 0.8 : s === 2 ? 1.1 : 1.35;
  switch (plan) {
    case 'beast':
      return s === 1
        ? mir(`<g transform="rotate(-24 ${100 - r * 0.72} ${y - r * 0.72})"><ellipse cx="${100 - r * 0.72}" cy="${y - r * 0.72}" rx="${r * 0.3}" ry="${r * 0.42}" fill="url(#gB)" ${sw()}/><ellipse cx="${100 - r * 0.72}" cy="${y - r * 0.66}" rx="${r * 0.15}" ry="${r * 0.26}" fill="#ff9aa8" opacity=".7"/></g>`)
        : mir(path(`M${100 - r * 0.55} ${y - r * 0.6} L${100 - r * 0.95} ${y - r * 1.2 * k} L${100 - r * 0.18} ${y - r * 0.9}Z`, 'url(#gB)'));
    case 'bug':
      return mir(`${path(`M${100 - r * 0.3} ${y - r * 0.85} C${100 - r * 0.5} ${y - r * 1.4 * k} ${100 - r * 0.9} ${y - r * 1.5 * k} ${100 - r * 1.05} ${y - r * 1.45 * k}`, 'none', 2.4)}<circle cx="${100 - r * 1.05}" cy="${y - r * 1.45 * k}" r="${r * 0.13}" fill="url(#gA)" ${sw(1.4)}/>`);
    case 'serpent':
      return s === 1
        ? ''
        : mir(path(`M${100 - r * 0.5} ${y - r * 0.7} C${100 - r * 0.7} ${y - r * 1.2 * k} ${100 - r * 1.05} ${y - r * 1.4 * k} ${100 - r * 1.25} ${y - r * 1.45 * k} C${100 - r * 0.9} ${y - r * 1.1} ${100 - r * 0.6} ${y - r * 0.9} ${100 - r * 0.25} ${y - r * 0.82}Z`, 'url(#gHorn)', 1.6));
    case 'bird':
      return path(`M100 ${y - r * 0.9} C96 ${y - r * 1.5 * k} 112 ${y - r * 1.7 * k} 118 ${y - r * 1.6 * k} C110 ${y - r * 1.3} 108 ${y - r * 1.1} 106 ${y - r * 0.92}Z`, 'url(#gA)', 1.5);
    case 'fish':
      return mir(path(`M${100 - r * 0.8} ${y - r * 0.2} C${100 - r * 1.3} ${y - r * 0.5 * k} ${100 - r * 1.5} ${y - r * 0.1} ${100 - r * 1.35} ${y + r * 0.3} C${100 - r * 1.15} ${y + r * 0.1} ${100 - r} ${y + r * 0.15} ${100 - r * 0.88} ${y + r * 0.25}Z`, 'url(#gA)', 1.5));
    case 'plant':
      const n = s === 1 ? 5 : 7;
      return Array.from({ length: n }, (_, i) => {
        const ang = -80 + (160 / (n - 1)) * i;
        return `<ellipse cx="100" cy="${y - r * 0.95}" rx="${r * 0.2 * k}" ry="${r * 0.42 * k}" transform="rotate(${ang} 100 ${y})" fill="url(#gA)" ${sw(1.4)}/>`;
      }).join('');
    case 'golem':
      return s === 1 ? '' : mir(`<path d="M${100 - r * 0.9} ${y - r * 0.5} L${100 - r * 1.1} ${y - r * 0.9 * k} L${100 - r * 0.55} ${y - r * 0.75}Z" fill="url(#rock)" ${sw(1.5)}/>`);
    default:
      return '';
  }
}

/** 頭（顔・耳・属性の飾りを含む） */
function head(sp: GenArt, y: number, r: number): string {
  const s = sp.stage;
  const coolShape =
    sp.plan === 'golem'
      ? `<path d="M${100 - r} ${y - r * 0.7} Q100 ${y - r * 1.05} ${100 + r} ${y - r * 0.7} L${100 + r * 0.95} ${y + r * 0.6} Q100 ${y + r * 0.95} ${100 - r * 0.95} ${y + r * 0.6}Z" fill="url(#gB)" ${sw()}/>`
      : P(`M100 ${y - r} C${100 - r * 0.62} ${y - r} ${100 - r} ${y - r * 0.55} ${100 - r} ${y - r * 0.05} C${100 - r} ${y + r * 0.42} ${100 - r * 0.6} ${y + r * 0.78} 100 ${y + r * 0.92}`, 'url(#gB)');
  const shape = s === 1 ? `<circle cx="100" cy="${y}" r="${r}" fill="url(#gB)" ${sw()}/>` : coolShape;
  const muzzle = sp.plan === 'beast' || sp.plan === 'serpent' ? `<ellipse cx="100" cy="${y + r * 0.42}" rx="${r * 0.5}" ry="${r * 0.36}" fill="url(#gC)"/>` : '';
  return `${ears(sp.plan, s, y, r)}${shape}${muzzle}${face(s, y, r, sp.iris, sp.plan)}${featureTop(sp.feature, s, 100, y - r * (sp.plan === 'plant' ? 1.25 : 0.92), sp.accent)}`;
}

/** 体（頭より後ろに描く部分）。r=0 は頭と体がひとつながりの形で、y は顔の位置 */
function body(sp: GenArt): { back: string; y: number; r: number } {
  const s = sp.stage;
  const B = 'url(#gB)';
  const C = 'url(#gC)';
  const A = 'url(#gA)';
  const feet = (x: number, y: number, rx: number) => mir(`<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${rx * 0.62}" fill="${B}" ${sw()}/>`);
  switch (sp.plan) {
    case 'beast':
      if (s === 1)
        return { back: `${path('M126 158 C150 166 168 148 160 126 C152 140 142 146 130 148Z', B)}<ellipse cx="100" cy="152" rx="34" ry="28" fill="${B}" ${sw()}/><ellipse cx="100" cy="158" rx="19" ry="16" fill="${C}"/>${feet(84, 178, 10)}`, y: 98, r: 46 };
      return {
        back: `${path(`M128 150 C156 ${150 - s * 6} 176 ${120 - s * 8} 166 ${96 - s * 6} C158 120 146 136 128 140Z`, B)}${s === 3 ? furRing(100, 96, 46, 40, 40, 14, sp.accent, 5) : ''}
          ${mir(`${path('M80 140 C76 156 74 170 74 182 L92 182 C92 168 93 154 95 142Z', B)}${claws(83, 183, 0.75)}`)}
          ${P(`M100 ${s === 3 ? 84 : 92} C80 ${s === 3 ? 84 : 92} 66 108 66 128 C66 146 78 156 100 158`, B)}${P('M100 104 C90 104 82 112 82 126 C84 140 92 148 100 150', C, 1.4)}`,
        y: s === 3 ? 60 : 66,
        r: s === 3 ? 34 : 33,
      };
    case 'bird':
      if (s === 1)
        return { back: `${mir(`<ellipse cx="54" cy="124" rx="15" ry="9" transform="rotate(-28 54 124)" fill="${A}" ${sw()}/>`)}${mir(path('M90 160 L88 178 M88 178 L82 182 M88 178 L94 182', 'none', 2.5, 'stroke="#e0901a"'))}<circle cx="100" cy="122" r="48" fill="${B}" ${sw()}/><ellipse cx="100" cy="142" rx="26" ry="20" fill="${C}" opacity=".9"/>`, y: 112, r: 0 };
      return {
        back: `${mir(path(`M86 112 C${60 - s * 10} ${90 - s * 12} ${30 - s * 8} ${70 - s * 10} ${12 - s * 4} ${78 - s * 14} C26 100 34 118 48 132 C40 136 30 142 ${22 - s * 2} 148 C46 152 66 150 84 144Z`, A))}
          ${mir([0, 1, 2].map((i) => `<path d="M${40 - i * 8 - s * 3} ${110 + i * 10} L${66 - i * 4} ${122 + i * 6}" stroke="${OUT}" stroke-width="1" opacity=".4"/>`).join(''))}
          ${mir(path('M90 168 L86 184 M86 184 L78 188 M86 184 L86 190 M86 184 L94 188', 'none', 3, 'stroke="#d8801a"'))}
          <ellipse cx="100" cy="132" rx="${30 + s * 3}" ry="${40 + s * 2}" fill="${B}" ${sw()}/><ellipse cx="100" cy="142" rx="${18 + s * 2}" ry="28" fill="${C}"/>`,
        y: s === 3 ? 72 : 76,
        r: 30,
      };
    case 'fish':
      if (s === 1)
        return { back: `${mir(path('M58 128 C40 120 30 128 30 142 C42 140 52 140 60 140Z', A))}${path('M100 66 C110 52 126 50 132 58 C120 62 112 70 108 78Z', A)}<circle cx="100" cy="118" r="50" fill="${B}" ${sw()}/><ellipse cx="100" cy="140" rx="30" ry="20" fill="${C}" opacity=".9"/>`, y: 112, r: 0 };
      return {
        back: `${mir(path(`M64 120 C${40 - s * 6} ${100 - s * 6} ${22 - s * 6} 110 ${18 - s * 4} 132 C38 134 50 140 62 146Z`, A))}
          ${path(`M100 ${60 - s * 6} C112 ${40 - s * 10} 136 ${34 - s * 8} 150 ${40 - s * 6} C132 50 122 62 116 80Z`, A)}
          ${mir(path('M86 166 C80 178 70 184 60 186 C72 188 86 186 94 180Z', A))}
          ${P(`M100 ${70 - s * 2} C76 ${74 - s * 2} 60 100 60 126 C60 152 78 172 100 176`, B)}${P('M100 116 C88 116 76 126 74 140 C78 158 90 166 100 168', C, 1.4)}
          ${[0, 1, 2].map((i) => `<path d="M${80 + i * 4} ${132 + i * 8} Q100 ${126 + i * 8} ${120 - i * 4} ${132 + i * 8}" stroke="${OUT}" stroke-width="1" fill="none" opacity=".3"/>`).join('')}`,
        y: 106,
        r: 0,
      };
    case 'serpent':
      if (s === 1)
        return { back: `${path('M128 164 C156 170 172 154 164 134 C156 148 144 152 132 154Z', B)}<ellipse cx="100" cy="158" rx="40" ry="24" fill="${B}" ${sw()}/><ellipse cx="100" cy="164" rx="24" ry="13" fill="${C}"/>`, y: 104, r: 44 };
      return {
        back: `${s === 3 ? mir(path('M84 112 C60 80 30 64 10 70 C24 84 30 98 32 112 C40 106 50 104 60 108 C56 118 58 128 64 136Z', A)) : ''}
          <ellipse cx="100" cy="166" rx="${58 + s * 4}" ry="20" fill="${B}" ${sw()}/><ellipse cx="100" cy="166" rx="${36 + s * 4}" ry="10" fill="${C}"/>
          ${path('M86 160 C78 140 80 116 88 98 L112 98 C120 116 122 140 114 160Z', B)}${path('M92 158 C88 140 90 120 95 104 L105 104 C110 120 112 140 108 158Z', C, 1.2)}
          ${mir([0, 1, 2, 3].map((i) => `<path d="M${86 - i * 0.5} ${110 + i * 12} l-8 -4 l4 8Z" fill="${A}" ${sw(1)}/>`).join(''))}`,
        y: s === 3 ? 66 : 70,
        r: 32,
      };
    case 'bug':
      if (s === 1)
        return { back: `${mir(`<ellipse cx="74" cy="168" rx="10" ry="6" fill="${B}" ${sw(1.5)}/>`)}<ellipse cx="100" cy="156" rx="30" ry="22" fill="${B}" ${sw()}/>${[0, 1, 2].map((i) => `<path d="M76 ${150 + i * 7} Q100 ${146 + i * 7} 124 ${150 + i * 7}" stroke="${OUT}" stroke-width="1.2" fill="none" opacity=".45"/>`).join('')}`, y: 104, r: 44 };
      return {
        back: `${mir(`<ellipse cx="${56 - s * 4}" cy="${100 - s * 4}" rx="${30 + s * 6}" ry="${20 + s * 4}" transform="rotate(-30 ${56 - s * 4} ${100 - s * 4})" fill="${A}" fill-opacity=".85" ${sw(1.6)}/><ellipse cx="${62 - s * 2}" cy="140" rx="${22 + s * 4}" ry="${14 + s * 2}" transform="rotate(24 ${62 - s * 2} 140)" fill="${A}" fill-opacity=".7" ${sw(1.4)}/>`)}
          ${mir(`<circle cx="${60 - s * 4}" cy="${96 - s * 4}" r="${6 + s * 2}" fill="${C}" opacity=".9"/>`)}
          ${mir([0, 1, 2].map((i) => path(`M90 ${130 + i * 12} L${72 - i * 2} ${140 + i * 14} L${68 - i * 2} ${158 + i * 10}`, 'none', 2.2)).join(''))}
          <ellipse cx="100" cy="140" rx="22" ry="34" fill="${B}" ${sw()}/>${[0, 1, 2, 3].map((i) => `<path d="M82 ${126 + i * 9} Q100 ${122 + i * 9} 118 ${126 + i * 9}" stroke="${OUT}" stroke-width="1.2" fill="none" opacity=".45"/>`).join('')}`,
        y: 82,
        r: 30,
      };
    case 'blob':
      if (s === 1) return { back: `${P('M100 64 C70 76 52 108 52 138 C52 166 72 182 100 182', B)}${P('M100 120 C84 120 72 132 72 150 C74 168 86 176 100 176', C, 1.2)}`, y: 124, r: 0 };
      return {
        back: `${mir(path('M60 130 C40 128 30 140 30 152 C42 150 52 152 60 156Z', B))}${P('M100 42 C64 56 44 100 44 136 C44 168 66 186 100 186', B)}${P('M100 116 C80 116 66 132 66 152 C68 172 84 180 100 180', C, 1.2)}`,
        y: 110,
        r: 0,
      };
    case 'golem':
      if (s === 1)
        return { back: `${feet(82, 178, 11)}<ellipse cx="100" cy="124" rx="52" ry="54" fill="${B}" ${sw()}/>${[[76, 150, 6], [126, 136, 5], [110, 166, 4]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${tone(sp.body, -0.2)}" opacity=".6"/>`).join('')}`, y: 118, r: 0 };
      return {
        back: `${mir(`${path(`M68 ${100 - s * 2} C${46 - s * 6} 100 ${36 - s * 6} 122 ${38 - s * 6} 146 C${44 - s * 4} 156 58 158 66 150Z`, B)}${path(`M${38 - s * 6} 146 L${30 - s * 6} 162 L${50 - s * 4} 164 L56 152Z`, 'url(#rock)', 1.6)}`)}
          ${mir(path('M78 148 L74 182 L96 182 L96 150Z', B))}
          <path d="M${60 - s * 2} 92 L${140 + s * 2} 92 L${134 + s * 2} 156 L${66 - s * 2} 156Z" fill="${B}" ${sw()}/>
          <path d="M80 104 L120 104 L116 140 L84 140Z" fill="${C}" opacity=".85"/>
          ${s === 3 ? mir([[70, 96, 26], [62, 120, 20]].map(([x, y, h]) => `<path d="M${x - 6} ${y} L${x - 2} ${y - h} L${x + 6} ${y}Z" fill="url(#gGem)" ${sw(1.4)}/>`).join('')) : ''}`,
        y: 70,
        r: 30,
      };
    case 'plant':
      if (s === 1)
        return { back: `${mir(`<path d="M86 172 C80 180 72 184 64 186 M92 176 C90 182 86 188 82 192" stroke="#7a5a32" stroke-width="3.5" fill="none"/>`)}<ellipse cx="100" cy="156" rx="30" ry="26" fill="url(#gLeaf)" ${sw()}/>${mir(leaf(78, 150, 24, 10, -70, '#5cc04a'))}`, y: 108, r: 40 };
      return {
        back: `${mir(`<path d="M86 172 C78 182 66 186 54 190 M92 178 C88 186 82 192 76 196" stroke="#7a5a32" stroke-width="4" fill="none"/>`)}
          ${mir(`${leaf(80, 130, 40 + s * 6, 14, -60, '#4cae3a')}${leaf(84, 150, 34 + s * 4, 12, -100, '#3f9a3a')}`)}
          ${P('M100 96 C86 98 76 112 72 130 C66 152 70 170 100 180', 'url(#gLeaf)')}
          ${mir(`<ellipse cx="78" cy="150" rx="${18 + s * 3}" ry="30" transform="rotate(14 78 150)" fill="${A}" fill-opacity=".9" ${sw(1.4)}/>`)}`,
        y: 72,
        r: 32,
      };
    case 'sprite':
      if (s === 1)
        return { back: `${mir(path('M70 138 C58 142 52 152 54 160 C62 158 70 154 76 148Z', B))}<path d="M100 132 C82 132 74 146 74 160 C78 172 88 180 100 184 C112 180 122 172 126 160 C126 146 118 132 100 132Z" fill="${B}" ${sw()}/>`, y: 102, r: 42 };
      return {
        back: `${mir(path(`M84 112 C${62 - s * 6} ${96 - s * 6} ${40 - s * 8} ${96 - s * 4} ${26 - s * 6} ${108 - s * 4} C44 116 58 122 78 130Z`, A, 1.5, 'fill-opacity=".85"'))}
          ${P(`M100 100 C84 102 76 116 72 134 C66 156 64 172 ${s === 3 ? 56 : 62} 186 C78 190 90 188 100 184`, B)}
          ${P('M100 112 C92 114 86 124 84 140 C82 160 84 174 100 178', C, 1.2)}
          ${mir(`<path d="M74 132 C62 140 56 152 56 164 C62 160 68 156 76 152Z" fill="${B}" ${sw(1.5)}/>`)}`,
        y: 72,
        r: 32,
      };
    case 'turtle':
      if (s === 1)
        return { back: `${feet(78, 176, 11)}<path d="M50 150 C50 112 74 92 100 92 C126 92 150 112 150 150Z" fill="${A}" ${sw()}/>${[[82, 116], [118, 116], [100, 106], [100, 132], [70, 140], [130, 140]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="${tone(sp.accent, 0.2)}" ${sw(1.2)}/>`).join('')}<ellipse cx="100" cy="156" rx="46" ry="16" fill="${C}" ${sw(1.5)}/>`, y: 114, r: 32 };
      return {
        back: `${feet(70, 178, 14)}
          <path d="M${36 - s * 4} 160 C${36 - s * 4} 104 64 ${76 - s * 6} 100 ${76 - s * 6} C136 ${76 - s * 6} ${164 + s * 4} 104 ${164 + s * 4} 160Z" fill="${A}" ${sw()}/>
          ${[[74, 112], [126, 112], [100, 96], [100, 132], [60, 140], [140, 140]].map(([x, y]) => `<path d="M${x - 10} ${y} L${x} ${y - 9} L${x + 10} ${y} L${x} ${y + 9}Z" fill="${tone(sp.accent, 0.15)}" ${sw(1.2)}/>`).join('')}
          ${s === 3 ? `${mir(`<path d="M64 96 L60 72 L74 92Z" fill="url(#rock)" ${sw(1.4)}/>`)}<path d="M100 ${70 - s * 6} L100 ${44 - s * 6}" stroke="#6a4a2a" stroke-width="4"/>${leaf(100, 48 - s * 6, 24, 12, -30, '#4cae3a')}${leaf(100, 48 - s * 6, 24, 12, 30, '#3f9a3a')}` : mir(`<path d="M70 98 L66 82 L80 94Z" fill="url(#rock)" ${sw(1.4)}/>`)}
          <ellipse cx="100" cy="164" rx="58" ry="16" fill="${C}" ${sw(1.5)}/>`,
        y: 124,
        r: 28,
      };
  }
}

function genRecipe(sp: GenArt): string {
  const b = body(sp);
  const s = sp.stage;
  // 頭と体がひとつながりの形（ひな鳥・魚・ぷにぷに・岩のこども）は、体の上に顔と飾りだけを描く
  const top = b.y - (sp.plan === 'blob' ? (s === 1 ? 58 : 66) : 50);
  const merged = `${sp.plan === 'fish' && s > 1 ? ears('fish', s, b.y, 34) : ''}${sp.plan === 'bird' ? ears('bird', Math.max(2, s), b.y - 8, 30) : ''}${face(s, b.y, 40, sp.iris, sp.plan)}${featureTop(sp.feature, s, 100, top, sp.accent)}`;
  const top2 = b.r === 0 ? merged : head(sp, b.y, b.r);
  const defs =
    rad('gB', [tone(sp.body, 0.45), sp.body, tone(sp.body, -0.42)]) +
    rad('gC', [tone(sp.belly, 0.4), sp.belly, tone(sp.belly, -0.2)]) +
    rad('gA', [tone(sp.accent, 0.4), sp.accent, tone(sp.accent, -0.4)]) +
    rad('gHorn', ['#fffaf0', '#d8c8a8', '#7a6a4a']) +
    rad('gGem', ['#ffffff', tone(sp.accent, 0.3), tone(sp.accent, -0.3)]) +
    lin('gTide', ['#e8fbff', '#7ad0f8', '#2a7ad0'], 0, 1, 0, 0) +
    lin('gLeaf', ['#d2f8a8', '#5cc04a', '#2f7a2a'], 0, 0, 0, 1) +
    rad('gAura', [`${tone(sp.accent, 0.5)}cc`, `${sp.accent}33`, `${sp.accent}00`], '50%', '50%', '50%');
  const glowParts = s === 3 ? auraFx(tone(sp.accent, 0.3)) : '';
  const sparkles = s === 3 ? [[26, 36], [174, 40], [20, 120], [182, 128]].map(([x, y]) => sparkle(x, y, 5, tone(sp.accent, 0.6))).join('') : '';
  return svg(`${glowParts}${sparkles}${shadow(s === 1 ? 44 : 56)}${b.back}${top2}`, defs);
}

for (const [id, spec] of Object.entries(GEN_ART)) MONSTER_ART[id] = () => genRecipe(spec);

const cache = new Map<string, string>();

/** 画像のデータURL（img要素・Phaserのテクスチャ両方で使う） */
export function monsterImageUrl(artId: string): string {
  let url = cache.get(artId);
  if (!url) {
    const recipe = MONSTER_ART[artId];
    const text = recipe ? recipe() : svg(`<circle cx="100" cy="110" r="60" fill="#ccc" ${sw(3)}/><text x="100" y="124" font-size="48" text-anchor="middle">?</text>`);
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    cache.set(artId, url);
  }
  return url;
}

/** 図鑑の未発見用シルエット */
export function silhouetteUrl(artId: string): string {
  const key = `sil:${artId}`;
  let url = cache.get(key);
  if (!url) {
    const recipe = MONSTER_ART[artId];
    const text = (recipe ? recipe() : svg(''))
      .replace('<g filter="url(#rl)">', '<g>')
      .replace('<g stroke-linejoin="round" stroke-linecap="round">', '<g stroke-linejoin="round" filter="url(#sil)">')
      .replace('<defs>', '<defs><filter id="sil"><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0 0.3  0 0 0 1 0"/></filter>');
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    cache.set(key, url);
  }
  return url;
}
