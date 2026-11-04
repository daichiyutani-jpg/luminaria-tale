/**
 * 【仮イラスト】灯獣の絵をコードで描く（SVG）。
 * 本番のイラストができたら、species.art と同じ名前の画像に差し替える前提。
 *
 * 描き方：
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
const foxHead = (top: number, body: string, cream: string, iris: string, earH = 40) => {
  const t = top;
  return `
    ${mir(`${path(`M68 ${t + 22} L52 ${t + 22 - earH} L92 ${t + 8}Z`, body)}${path(`M70 ${t + 16} L58 ${t + 26 - earH * 0.85} L84 ${t + 8}Z`, '#4a140c', 0)}${path(`M71 ${t + 12} L63 ${t + 30 - earH * 0.8} L80 ${t + 8}Z`, '#ff9a5a', 0, 'opacity=".55"')}`)}
    ${P(`M100 ${t} C80 ${t} 62 ${t + 12} 58 ${t + 32} C56 ${t + 48} 64 ${t + 60} 76 ${t + 67} C84 ${t + 71} 92 ${t + 73} 100 ${t + 73}`, body)}
    ${mir(path(`M60 ${t + 40} L38 ${t + 50} L58 ${t + 55} L44 ${t + 66} L68 ${t + 61}Z`, cream, 1.5))}
    ${P(`M100 ${t + 44} C92 ${t + 44} 86 ${t + 48} 82 ${t + 54} C78 ${t + 59} 72 ${t + 60} 66 ${t + 57} C70 ${t + 67} 84 ${t + 73} 100 ${t + 73}`, cream, 1.5)}
    ${mir(path(`M64 ${t + 29} Q74 ${t + 25} 82 ${t + 31} Q74 ${t + 31} 66 ${t + 34}Z`, '#a8200c', 0))}
    ${mir(eye(83, t + 37, 11, iris))}
    <path d="M93 ${t + 50} Q100 ${t + 45} 107 ${t + 50} Q105 ${t + 57} 100 ${t + 58} Q95 ${t + 57} 93 ${t + 50}Z" fill="${OUT}"/><ellipse cx="98" cy="${t + 49}" rx="2.2" ry="1.2" fill="#fff" opacity=".6"/>
    <path d="M100 ${t + 58} L100 ${t + 62} M92 ${t + 63} Q96 ${t + 66} 100 ${t + 62} Q104 ${t + 66} 108 ${t + 63}" fill="none" ${sw(1.6)}/>`;
};

const hinokoro: Recipe = () =>
  svg(
    `${shadow(50)}
    ${path('M118 162 C160 170 188 134 172 94 C164 114 150 126 130 132Z', 'url(#hb)')}
    ${flame(171, 98, 46, 16, 18)}
    ${P('M100 104 C80 104 64 124 64 150 C64 170 72 182 84 184 L100 184', 'url(#hb)')}
    ${mir(`${path('M82 140 C80 156 78 170 78 182 L95 182 C95 168 95 154 96 142Z', 'url(#hb)')}${path('M76 177 Q86 171 96 177 L96 185 L76 185Z', '#5a2210', 1.5)}${claws(86, 184, 0.7)}`)}
    ${P('M100 110 L84 111 L74 128 L85 125 L80 143 L92 134 L95 150 L100 140', 'url(#hc)', 1.5)}
    ${foxHead(40, 'url(#hb)', 'url(#hc)', '#ffc23a')}
    ${flame(100, 60, 18, 7)}`,
    rad('hb', ['#ffb27a', '#f0712f', '#a8361a']) + rad('hc', ['#fffaf0', '#f6dcc0', '#cfa47c']),
  );

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
    ${foxHead(22, 'url(#fb)', 'url(#fc)', '#fff27a', 38)}
    ${mir(flame(56, 14, 18, 7, -18))}
    ${P('M100 23 L92 31 L95 42 L100 48', 'url(#gold)', 1.5)}
    ${mir(path('M62 46 Q60 58 66 66 L70 60Z', 'url(#gold)', 1))}`,
    rad('fb', ['#ffb070', '#e8502a', '#7a1a0c']) + rad('fc', ['#fffaf0', '#ffe0b0', '#d89a5a']) + rad('aura', ['rgba(255,180,80,.55)', 'rgba(255,120,40,.18)', 'rgba(255,80,20,0)'], '50%', '50%', '50%'),
  );

// ───────────────────────── しお：イモリ・竜の系統 ─────────────────────────
const shizukun: Recipe = () =>
  svg(
    `${shadow(56)}
    ${path('M122 166 C160 176 186 160 178 132 C170 148 152 156 130 154Z', 'url(#sb)')}
    ${path('M150 156 C162 150 172 142 176 132 C176 146 168 156 156 160Z', '#9fe0ff', 0, 'opacity=".7"')}
    ${mir(`${path('M72 150 C58 156 48 166 44 178 L66 180 C68 170 74 162 82 158Z', 'url(#sb)')}${[46, 54, 62].map((x) => `<circle cx="${x}" cy="181" r="4" fill="#2f78c0" ${sw(1.2)}/>`).join('')}`)}
    ${P('M100 110 C80 110 64 126 62 146 C62 164 76 176 100 178', 'url(#sb)')}
    ${P('M100 122 C88 122 80 134 80 148 C82 162 90 170 100 170', '#d8f0ff', 1.5)}
    ${[134, 144, 154, 162].map((y) => `<path d="M84 ${y} Q100 ${y + 4} 116 ${y}" stroke="#8fb8d8" stroke-width="1.2" fill="none"/>`).join('')}
    ${mir(`${path('M54 82 C40 72 30 68 20 70 C28 78 38 84 50 90Z', 'url(#gill)', 1.5)}${path('M50 94 C36 92 24 94 14 100 C26 104 38 104 50 101Z', 'url(#gill)', 1.5)}${path('M54 105 C42 110 34 116 30 126 C42 122 50 117 60 111Z', 'url(#gill)', 1.5)}`)}
    ${P('M100 60 C76 60 52 70 48 90 C46 106 60 118 80 122 L100 124', 'url(#sb)')}
    ${mir([[70, 140], [66, 160], [78, 166]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#bfe6ff" opacity=".8"/>`).join(''))}
    ${mir([[62, 74], [56, 100], [74, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#bfe6ff" opacity=".8"/>`).join(''))}
    ${mir(eye(76, 90, 10, '#ffd84a'))}
    <path d="M78 110 Q100 118 122 110" fill="none" ${sw(2)}/>
    <path d="M100 10 C88 30 80 40 80 52 C80 64 90 72 100 72 C110 72 120 64 120 52 C120 40 112 30 100 10Z" fill="url(#drop)" fill-opacity=".92" ${sw(2)}/>
    <ellipse cx="92" cy="48" rx="4" ry="9" fill="#fff" opacity=".85"/>
    <circle cx="105" cy="58" r="5" fill="#fff6b0" opacity=".9"/>`,
    rad('sb', ['#9fdcff', '#3f8fd8', '#173f78']) + rad('gill', ['#ffe0ea', '#ff7aa8', '#b02a60']) + rad('drop', ['#ffffff', '#a8e6ff', '#3a9ae8']),
  );

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
    `<ellipse cx="100" cy="164" rx="92" ry="26" fill="url(#whirl)" ${sw(1.5, '#0f3a66')}/>
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
    ${mir(eye(84, 38, 9.5, '#fff07a'))}
    ${mir(path('M88 64 L90 70 L93 65Z', '#fff', 1))}
    ${[[30, 150], [170, 148], [48, 132], [156, 128], [20, 168], [182, 170]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#e8fbff" opacity=".9"/>`).join('')}`,
    rad('ub', ['#7fc4f4', '#1f62a8', '#0c2a52']) + rad('whirl', ['#bfeaff', '#3f9ae0', '#174f88'], '50%', '40%', '60%'),
  );

// ───────────────────────── めぶき：ハリネズミ・獅子の系統 ─────────────────────────
const mebukin: Recipe = () =>
  svg(
    `${shadow(56)}
    ${Array.from({ length: 13 }, (_, i) => {
      const a = -84 + i * 14;
      const r = (a * Math.PI) / 180;
      return leaf(100 + Math.sin(r) * 34, 128 - Math.cos(r) * 30, 54, 13, a, i % 2 ? 'url(#lf)' : 'url(#lf2)');
    }).join('')}
    ${P('M100 78 C76 78 56 98 54 126 C54 154 72 172 100 174', 'url(#mb2)')}
    ${P('M100 100 C86 100 76 112 74 128 C74 146 86 160 100 164', 'url(#mf)', 1.5)}
    ${mir(`<ellipse cx="78" cy="176" rx="13" ry="7" fill="#5a3a22" ${sw(1.5)}/>${claws(78, 180, 0.6)}`)}
    ${mir(eye(85, 124, 8.5, '#9bff5a'))}
    <ellipse cx="100" cy="150" rx="7" ry="5.5" fill="${OUT}"/><ellipse cx="98" cy="148" rx="2" ry="1.4" fill="#fff" opacity=".7"/>
    <path d="M92 158 Q100 162 108 158" fill="none" ${sw(1.5)}/>
    ${mir(path('M76 138 Q82 136 86 140', 'none', 1.2))}`,
    rad('mb2', ['#8a6a4a', '#5e4228', '#2e1e10']) + rad('mf', ['#fff6e4', '#f0d8b4', '#c49a6a']) + lin('lf', ['#2f7a2a', '#6ccf4a', '#c8f59a'], 0, 1, 0, 0) + lin('lf2', ['#24661f', '#4cae3f', '#a6e878'], 0, 1, 0, 0),
  );

const lionBody = (bodyFill: string, mane: string, iris: string, top = 40) => `
    ${mir(`${path('M72 128 C68 150 66 168 64 182 L90 184 C90 168 92 150 94 132Z', bodyFill)}${claws(76, 184, 0.9)}`)}
    ${P('M100 108 C80 108 64 120 62 140 C62 156 72 166 90 168 L100 168', bodyFill)}
    ${star(100, top + 32, 16, 62, 44, 6, mane)}${star(100, top + 32, 16, 50, 36, 17, mane, 1.5)}
    ${P(`M100 ${top} C82 ${top} 68 ${top + 12} 66 ${top + 30} C64 ${top + 46} 74 ${top + 58} 86 ${top + 64} L100 ${top + 68}`, bodyFill)}
    ${P(`M100 ${top + 34} C90 ${top + 34} 82 ${top + 40} 80 ${top + 48} C82 ${top + 58} 90 ${top + 64} 100 ${top + 66}`, '#f6e2b8', 1.5)}
    <path d="M92 ${top + 42} Q100 ${top + 38} 108 ${top + 42} L100 ${top + 50}Z" fill="${OUT}"/>
    <path d="M100 ${top + 50} L100 ${top + 55} M90 ${top + 56} Q100 ${top + 60} 110 ${top + 56}" fill="none" ${sw(1.6)}/>
    ${mir(path(`M90 ${top + 56} L92 ${top + 62} L94 ${top + 57}Z`, '#fff', 1))}
    ${mir(eye(84, top + 24, 9, iris))}`;

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
    `${[[100, 26, 30], [66, 34, 24], [134, 34, 24], [44, 56, 18], [156, 56, 18]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#canopy)" ${sw(1.8)}/>`).join('')}
    ${[[88, 18], [112, 22], [60, 30], [140, 28], [100, 40]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3" fill="#ffe27a"/>`).join('')}
    ${mir(path('M84 60 C76 46 66 38 52 36 L56 32 C68 34 78 40 86 50 C88 40 92 30 98 24 L102 28 C96 36 92 48 92 60Z', '#6a4a2a', 1.5))}
    ${shadow(70)}
    ${lionBody('url(#jb)', 'url(#moss)', '#c8ff5a', 46)}
    ${mir(`${path('M66 118 L52 110 L60 98 L76 104Z', 'url(#rock)', 1.5)}${path('M60 134 L46 130 L50 118 L64 122Z', 'url(#rock)', 1.5)}`)}
    ${mir(`${leaf(70, 136, 14, 5, -30, '#6ccf4a')}${leaf(80, 160, 12, 4, -20, '#4cae3f')}`)}`,
    rad('jb', ['#e8c890', '#a8804a', '#54381c']) + rad('moss', ['#5fae4a', '#2f6a2a', '#123a14'], '50%', '40%', '60%') + rad('canopy', ['#9be07a', '#3f9a45', '#1a4a1e']),
  );

// ───────────────────────── いかずち：ヒヨコ・雷鳥 ─────────────────────────
const piricchi: Recipe = () =>
  svg(
    `${shadow(50)}
    ${bolt(100, 46, 1.6, 0)}${mir(bolt(80, 52, 1.2, -24))}
    ${mir(path('M58 108 C40 104 28 112 24 126 L34 122 L30 134 L42 128 L40 140 C48 134 54 130 60 132Z', 'url(#pw)'))}
    ${mir(`${path('M86 160 L82 180 M82 180 L74 184 M82 180 L82 186 M82 180 L90 184', 'none', 2.5, 'stroke="#d0801a"')}`)}
    ${P('M100 58 C72 58 52 82 52 112 C52 142 72 164 100 164', 'url(#pb)')}
    ${P('M100 112 C88 112 78 122 78 138 C80 152 90 160 100 160', '#fff6c8', 1.2)}
    ${furRing(100, 110, 44, 50, 44, 6, '#ffe46a', 3)}
    ${mir(eye(84, 98, 9.5, '#3aa0ff'))}
    ${P('M100 104 L90 112 L100 122', 'url(#beak)', 1.5)}
    ${mir(path('M66 116 Q72 112 78 118 Q72 120 66 120Z', '#ff8a4a', 0, 'opacity=".5"'))}
    ${[[34, 70, 20], [168, 76, -30], [160, 150, 15], [36, 150, -10]].map(([x, y, r]) => bolt(x, y, 0.7, r)).join('')}`,
    rad('pb', ['#fff3a0', '#f2c82c', '#a8780c']) + rad('pw', ['#fff3a0', '#e8b81c', '#8a5a0a']) + lin('beak', ['#ffc04a', '#e0701a'], 0, 0, 0, 1),
  );

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

const fuwamo: Recipe = () =>
  svg(
    `${shadow(48, 180)}
    ${fluff('url(#fw)', '#fffaf0', '#d8ccb8', 2)}
    <circle cx="100" cy="114" r="30" fill="url(#fwc)" opacity=".7"/>
    ${mir(eye(86, 108, 8, '#8a6a4a'))}
    <path d="M94 126 Q100 130 106 126" fill="none" ${sw(1.4)}/>
    ${mir(`<ellipse cx="84" cy="168" rx="9" ry="6" fill="#e8dcc8" ${sw(1.5)}/>`)}
    <circle cx="100" cy="114" r="4" fill="#fff6b0" opacity=".9"/>`,
    rad('fw', ['#ffffff', '#efe7d6', '#b8a890']) + rad('fwc', ['#ffffff', 'rgba(255,255,255,0)'], '50%', '50%', '50%'),
  );

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
const koishimo: Recipe = () =>
  svg(
    `${shadow(58)}
    ${[[62, 74, 16], [86, 60, 18], [114, 60, 18], [138, 74, 16], [100, 48, 14]].map(([x, y, r], i) => star(x, y, 3 + (i % 2), r, r * 0.7, i * 23, 'url(#rock)', 1.6)).join('')}
    ${P('M100 64 C74 64 54 86 52 116 C50 146 68 172 100 176', 'url(#ko)')}
    ${furRing(100, 120, 44, 50, 50, 5, '#8a6440', 4)}
    ${P('M100 108 C88 108 80 120 80 136 C82 154 90 166 100 168', '#c8a07a', 1.2)}
    ${mir(`${path('M62 132 C44 136 34 148 34 162 C44 166 56 164 66 156Z', '#f2c0b0', 1.8)}${[38, 46, 54, 62].map((x, i) => `<path d="M${x} ${162 - i * 2} L${x - 4} ${176 - i} L${x + 4} ${164 - i * 2}Z" fill="#fff8f0" ${sw(1.2)}/>`).join('')}`)}
    ${mir(`<ellipse cx="80" cy="176" rx="12" ry="6" fill="#f2c0b0" ${sw(1.5)}/>`)}
    ${mir(eye(86, 104, 6.5, '#2a1a10'))}
    <path d="M92 114 Q100 108 108 114 L104 124 Q100 128 96 124Z" fill="#ff8fa3" ${sw(1.5)}/>
    <path d="M100 128 L100 132 M94 134 Q100 137 106 134" fill="none" ${sw(1.4)}/>`,
    rad('ko', ['#b8946a', '#7a5636', '#3a2414']),
  );

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

const kodamazaru: Recipe = () =>
  svg(
    `${shadow(62)}
    ${path('M124 160 C160 170 182 146 170 116 C176 140 160 150 136 148Z', 'url(#kz)')}
    ${mir(`${path('M70 100 C48 104 38 128 40 156 C40 166 44 176 50 180 L64 178 C58 160 58 140 66 124Z', 'url(#kz)')}${claws(56, 180, 0.7, '#3a2a20')}`)}
    ${mir(`${path('M78 146 C72 160 70 172 70 182 L92 184 C92 172 94 160 96 150Z', 'url(#kz)')}`)}
    ${P('M100 86 C80 86 66 102 64 124 C64 144 74 156 100 160', 'url(#kz)')}
    ${P('M100 98 C88 98 80 108 80 122 C80 138 88 148 100 150', '#d8c4a8', 1.2)}
    ${star(100, 122, 6, 14, 8, 0, 'url(#rock)', 1.5)}
    <circle cx="100" cy="122" r="7" fill="url(#gem)" ${sw(1.2)}/>
    ${mir(`<circle cx="64" cy="54" r="12" fill="url(#kz)" ${sw(2)}/><circle cx="64" cy="54" r="6" fill="#c8a080"/>`)}
    ${P('M100 28 C80 28 66 40 66 58 C66 74 78 86 100 88', 'url(#kz)')}
    ${P('M100 46 C88 46 78 52 78 62 C78 74 88 82 100 82', '#e8d0b0', 1.5)}
    ${furRing(100, 44, 22, 12, 24, 6, '#5a4632', 6)}
    ${mir(eye(88, 58, 7.5, '#ffb43a'))}
    <path d="M96 70 L100 66 L104 70" fill="none" ${sw(1.5)}/>
    <path d="M90 76 Q100 80 110 76" fill="none" ${sw(1.6)}/>${mir(path('M92 76 L94 81 L96 77Z', '#fff', 1))}`,
    rad('kz', ['#a8907a', '#6e5844', '#352820']) + rad('gem', ['#ffffff', '#7affd0', '#1a9a7a']),
  );

// ───────────────────────── はやて：鳥の系統 ─────────────────────────
const kazamidori: Recipe = () =>
  svg(
    `${shadow(50)}
    ${mir(path('M90 136 L70 186 L88 172 L100 190Z', 'url(#zt)', 1.8))}
    ${mir(path('M72 96 C54 90 38 98 30 114 L42 112 L34 126 L48 120 L44 134 C56 128 66 122 76 124Z', 'url(#zw2)'))}
    ${mir(`${path('M90 150 L86 170', 'none', 3, 'stroke="#c07a1a"')}${claws(86, 170, 0.6, '#2a2030')}`)}
    ${P('M100 74 C84 74 72 88 72 108 C72 130 84 148 100 152', 'url(#zb)')}
    ${P('M100 98 C92 98 86 108 86 120 C86 134 92 144 100 148', '#f0fbff', 1.2)}
    ${path('M100 46 L96 18 L120 12 L112 22 L132 26 L104 32 L102 46Z', 'url(#gold)', 1.6)}
    ${path('M96 18 L84 26 L96 30Z', 'url(#gold)', 1.4)}
    ${P('M100 40 C86 40 76 52 76 66 C76 78 86 86 100 88', 'url(#zb)')}
    ${mir(eye(88, 62, 8, '#ff7a2a'))}
    ${P('M100 68 L92 72 L97 82 L100 86', 'url(#beak2)', 1.5)}`,
    rad('zb', ['#c8f2fa', '#7bc8d6', '#2a6a80']) + lin('zw2', ['#e8fbff', '#7bc8d6', '#2a5a70'], 1, 0, 0, 0) + lin('zt', ['#5aa8c0', '#1a3a50']) + lin('beak2', ['#ffcf5a', '#c06a12']),
  );

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

const yoiyami: Recipe = () =>
  svg(
    `${shadow(52)}
    ${mir(path('M92 96 C60 40 14 46 8 92 C4 126 50 132 90 116Z', 'url(#yw)'))}
    ${mir(path('M92 118 C64 124 34 140 38 166 C44 184 76 168 94 132Z', 'url(#yw2)'))}
    ${mir(`${lantern(46, 86, 12)}${lantern(60, 154, 8)}<path d="M20 70 Q50 96 84 104" stroke="#2a1a40" stroke-width="1.5" fill="none" opacity=".7"/>`)}
    ${P('M100 64 C90 64 86 80 86 100 C86 130 92 156 100 166', 'url(#yb)')}
    ${[110, 124, 138, 150].map((y) => `<path d="M88 ${y} Q100 ${y + 4} 112 ${y}" stroke="#2a1a40" stroke-width="1.4" fill="none"/>`).join('')}
    ${furRing(100, 82, 12, 12, 26, 6, '#b89ad8', 9)}
    ${mir(path('M94 58 C84 38 74 22 60 14 C66 30 72 44 86 60Z', '#5a3f8a', 1.4))}
    ${mir(`<path d="M80 40 L72 42 M76 32 L68 34 M70 24 L62 26" stroke="#5a3f8a" stroke-width="1.5"/>`)}
    ${P('M100 54 C90 54 84 62 84 72 C84 82 92 88 100 88', 'url(#yb)')}
    ${mir(eye(90, 70, 7, '#ffd84a', true))}`,
    rad('yb', ['#a88ad0', '#6a4a9a', '#2a1a48']) + rad('yw', ['#b8a0e0', '#7b5ea8', '#2e1e50']) + rad('yw2', ['#9a80c8', '#5a3f8a', '#22143e']) + rad('lan', ['#fffbd0', '#ffb43a', '#d0600a']),
  );

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
  kodamazaru,
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
