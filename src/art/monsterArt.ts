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
const chonbo: Recipe = () =>
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
    ${mir(eye(87, 104, 8.5, '#ffd84a', true))}
    <path d="M90 115 Q100 111 110 115" fill="none" ${sw(2)}/>`,
    rad('stem', ['#fffaf0', '#ecdcbc', '#a8875a']) + rad('cap', ['#d8a46a', '#9a5e2a', '#4a2a10'], '40%', '25%', '80%') + lin('rope', ['#f6e6b8', '#c8a050', '#8a6420']) + rad('caura', ['rgba(255,240,170,.7)', 'rgba(220,240,140,.25)', 'rgba(200,230,120,0)'], '50%', '50%', '50%'),
  );

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
};

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
