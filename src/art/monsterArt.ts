/**
 * 【仮イラスト】モンスターの絵をコードで描く（SVG）。
 * 最終版のアニメ調イラストができたら、species.art と同じ名前の画像に差し替える前提。
 * ここでの絵は「シルエットと色で見分けられること」を優先した開発用の仮素材。
 */

type Recipe = () => string;

const OUT = '#2b2233';

function eyes(cx: number, cy: number, gap: number, r = 11, iris = '#2b2233', look = 0): string {
  const one = (x: number) => `
    <ellipse cx="${x}" cy="${cy}" rx="${r}" ry="${r * 1.18}" fill="#fff" stroke="${OUT}" stroke-width="3"/>
    <ellipse cx="${x + look}" cy="${cy + 2}" rx="${r * 0.66}" ry="${r * 0.86}" fill="${iris}"/>
    <ellipse cx="${x + look}" cy="${cy + 4}" rx="${r * 0.36}" ry="${r * 0.46}" fill="#000" opacity=".55"/>
    <circle cx="${x + look - r * 0.28}" cy="${cy - r * 0.3}" r="${r * 0.3}" fill="#fff"/>
    <circle cx="${x + look + r * 0.25}" cy="${cy + r * 0.38}" r="${r * 0.13}" fill="#fff"/>`;
  return one(cx - gap / 2) + one(cx + gap / 2);
}
const cheeks = (cx: number, cy: number, gap: number, c = '#ff8fa3') =>
  `<ellipse cx="${cx - gap / 2}" cy="${cy}" rx="8" ry="4.5" fill="${c}" opacity=".55"/><ellipse cx="${cx + gap / 2}" cy="${cy}" rx="8" ry="4.5" fill="${c}" opacity=".55"/>`;
const smile = (cx: number, cy: number, w = 10) => `<path d="M${cx - w} ${cy} Q${cx} ${cy + w * 0.8} ${cx + w} ${cy}" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`;
const fang = (cx: number, cy: number) => `<path d="M${cx - 9} ${cy} Q${cx} ${cy + 7} ${cx + 9} ${cy}" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/><path d="M${cx + 3} ${cy + 2} l3 6 l3 -5" fill="#fff" stroke="${OUT}" stroke-width="1.5"/>`;
const grad = (id: string, a: string, b: string) =>
  `<radialGradient id="${id}" cx="40%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
const shadow = (cx = 100, cy = 182, rx = 52) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="9" fill="#000" opacity=".16"/>`;
const flame = (x: number, y: number, s: number, c1 = '#ffd166', c2 = '#ef6a3a') =>
  `<path d="M${x} ${y} C${x - 10 * s} ${y - 14 * s} ${x - 2 * s} ${y - 24 * s} ${x + 2 * s} ${y - 34 * s} C${x + 6 * s} ${y - 22 * s} ${x + 14 * s} ${y - 16 * s} ${x} ${y} Z" fill="${c2}" stroke="${OUT}" stroke-width="2.5"/><path d="M${x + 1} ${y - 3 * s} C${x - 4 * s} ${y - 10 * s} ${x} ${y - 16 * s} ${x + 2 * s} ${y - 22 * s} C${x + 5 * s} ${y - 14 * s} ${x + 7 * s} ${y - 9 * s} ${x + 1} ${y - 3 * s} Z" fill="${c1}"/>`;

/**
 * 仕上げのフィルター：形から凹凸を作り、左上からの光で陰影・つや・肌理（きめ）をつける。
 * 一枚ずつ描き直さなくても、図形の絵が立体的な塗りに見えるようにする。
 */
const RENDER_FILTER = `<filter id="rl" filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="200" color-interpolation-filters="sRGB">
  <feGaussianBlur in="SourceAlpha" stdDeviation="7" result="ba"/>
  <feColorMatrix in="SourceGraphic" type="luminanceToAlpha" result="lum"/>
  <feGaussianBlur in="lum" stdDeviation="2" result="bl"/>
  <feComposite in="ba" in2="bl" operator="arithmetic" k2=".8" k3=".45" result="h"/>
  <feDiffuseLighting in="h" surfaceScale="7" diffuseConstant="1" lighting-color="#fff" result="dif"><feDistantLight azimuth="225" elevation="48"/></feDiffuseLighting>
  <feSpecularLighting in="h" surfaceScale="7" specularConstant=".32" specularExponent="16" lighting-color="#fff6e0" result="spec"><feDistantLight azimuth="225" elevation="58"/></feSpecularLighting>
  <feTurbulence type="fractalNoise" baseFrequency=".55 1.6" numOctaves="3" seed="7" result="n"/>
  <feColorMatrix in="n" type="matrix" values=".33 .33 .33 0 0  .33 .33 .33 0 0  .33 .33 .33 0 0  0 0 0 0 1" result="ng"/>
  <feComposite in="SourceGraphic" in2="ng" operator="arithmetic" k1=".42" k2=".8" result="tex"/>
  <feComposite in="tex" in2="dif" operator="arithmetic" k1="1.32" result="lit"/>
  <feComposite in="spec" in2="SourceAlpha" operator="in" result="spec2"/>
  <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="ib"/>
  <feComposite in="SourceAlpha" in2="ib" operator="arithmetic" k2="1" k3="-1" result="edge"/>
  <feFlood flood-color="#1a1024" flood-opacity=".45"/>
  <feComposite in2="edge" operator="in" result="ao"/>
  <feMerge><feMergeNode in="lit"/><feMergeNode in="ao"/><feMergeNode in="spec2"/></feMerge>
  <feComposite in2="SourceAlpha" operator="in"/>
</filter>`;

const svg = (inner: string, defs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><defs>${RENDER_FILTER}${defs}</defs><g filter="url(#rl)"><g stroke-linejoin="round">${inner.replace(/stroke-width="3"/g, 'stroke-width="2"')}</g></g></svg>`;

export const MONSTER_ART: Record<string, Recipe> = {
  hinokoro: () =>
    svg(
      `${shadow()}
      <path d="M140 140 C175 130 182 95 165 72 C160 98 148 112 128 120 Z" fill="url(#b)" stroke="${OUT}" stroke-width="3"/>
      ${flame(166, 76, 1.1)}
      <ellipse cx="100" cy="140" rx="44" ry="36" fill="url(#b)" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="150" rx="24" ry="20" fill="#ffe8cf"/>
      <rect x="72" y="160" width="16" height="22" rx="8" fill="url(#b)" stroke="${OUT}" stroke-width="3"/>
      <rect x="112" y="160" width="16" height="22" rx="8" fill="url(#b)" stroke="${OUT}" stroke-width="3"/>
      <path d="M58 70 L48 22 L84 52 Z" fill="url(#b)" stroke="${OUT}" stroke-width="3"/><path d="M60 60 L54 34 L74 52Z" fill="#ffd1a8"/>
      <path d="M142 70 L152 22 L116 52 Z" fill="url(#b)" stroke="${OUT}" stroke-width="3"/><path d="M140 60 L146 34 L126 52Z" fill="#ffd1a8"/>
      <ellipse cx="100" cy="86" rx="48" ry="40" fill="url(#b)" stroke="${OUT}" stroke-width="3"/>
      <path d="M62 98 Q100 132 138 98 Q120 116 100 116 Q80 116 62 98Z" fill="#ffe8cf"/>
      ${eyes(100, 82, 40, 11, '#7a2d12')}${cheeks(100, 100, 66)}${fang(100, 104)}
      <path d="M92 50 q8 -14 16 0" fill="#ffd166" stroke="${OUT}" stroke-width="2"/>`,
      grad('b', '#ffa26b', '#e0562a'),
    ),
  kagurabi: () =>
    svg(
      `${shadow(100, 184, 60)}
      ${[0, 1, 2, 3, 4].map((i) => `<path d="M${118 + i * 4} 128 C${150 + i * 10} ${120 - i * 18} ${170 + i * 4} ${96 - i * 16} ${160 + i * 2} ${58 - i * 6} C${150} ${92 - i * 8} ${140} ${108 - i * 4} ${118 + i * 4} 128Z" fill="${i % 2 ? '#ffd166' : '#ef6a3a'}" stroke="${OUT}" stroke-width="2.5" opacity=".95"/>`).join('')}
      <path d="M64 120 C60 160 76 176 100 176 C126 176 140 160 134 120 Z" fill="url(#k)" stroke="${OUT}" stroke-width="3"/>
      <path d="M78 176 l-6 6 h20 z M122 176 l6 6 h-20z" fill="#fff4dc" stroke="${OUT}" stroke-width="2"/>
      <path d="M84 132 Q100 150 116 132 Q112 160 100 162 Q88 160 84 132Z" fill="#fff4dc"/>
      <path d="M60 64 L46 10 L86 46 Z" fill="url(#k)" stroke="${OUT}" stroke-width="3"/>
      <path d="M140 64 L154 10 L114 46 Z" fill="url(#k)" stroke="${OUT}" stroke-width="3"/>
      <path d="M58 78 C56 50 80 38 100 38 C122 38 146 50 142 78 C140 108 122 122 100 122 C78 122 60 108 58 78Z" fill="url(#k)" stroke="${OUT}" stroke-width="3"/>
      <path d="M66 96 Q100 128 134 96 Q120 118 100 118 Q80 118 66 96Z" fill="#fff4dc"/>
      <path d="M82 48 L100 30 L118 48 L100 58Z" fill="#f3d36b" stroke="${OUT}" stroke-width="2.5"/>
      <path d="M74 80 q12 -10 22 0 M104 80 q12 -10 22 0" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      <path d="M76 84 q-6 2 -10 -2 M124 84 q6 2 10 -2" stroke="#c0392b" stroke-width="3" fill="none"/>
      ${smile(100, 100, 7)}${flame(46, 140, 0.8)}${flame(150, 160, 0.6)}`,
      grad('k', '#ffb27a', '#d8461f'),
    ),
  shizukun: () =>
    svg(
      `${shadow()}
      <path d="M130 150 C166 156 178 140 170 124 C160 136 146 138 130 132Z" fill="url(#s)" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="142" rx="48" ry="32" fill="url(#s)" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="150" rx="30" ry="16" fill="#e6f6ff"/>
      <ellipse cx="66" cy="170" rx="14" ry="8" fill="url(#s)" stroke="${OUT}" stroke-width="3"/><ellipse cx="134" cy="170" rx="14" ry="8" fill="url(#s)" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="98" rx="50" ry="36" fill="url(#s)" stroke="${OUT}" stroke-width="3"/>
      <path d="M100 18 C86 40 76 50 76 62 C76 76 88 84 100 84 C112 84 124 76 124 62 C124 50 114 40 100 18Z" fill="#9fdcff" fill-opacity=".85" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="92" cy="56" rx="6" ry="10" fill="#fff" opacity=".8"/><circle cx="104" cy="66" r="6" fill="#ffffff" opacity=".9"/><circle cx="104" cy="66" r="3" fill="#7fe0ff"/>
      ${eyes(100, 100, 46, 10, '#123d6a')}${cheeks(100, 116, 70)}${smile(100, 116, 8)}
      <path d="M52 88 l-12 -6 l4 12 z M148 88 l12 -6 l-4 12 z" fill="#7fc3f0" stroke="${OUT}" stroke-width="2"/>`,
      grad('s', '#7fc8ff', '#2f7fc8'),
    ),
  minamodra: () =>
    svg(
      `${shadow(100, 184, 64)}
      <path d="M130 150 C170 160 190 130 176 100 C170 124 156 136 132 136Z" fill="url(#m)" stroke="${OUT}" stroke-width="3"/>
      <path d="M50 120 C40 160 70 180 100 180 C132 180 160 160 150 120 C140 96 60 96 50 120Z" fill="url(#m)" stroke="${OUT}" stroke-width="3"/>
      <path d="M72 140 Q100 170 128 140 Q120 170 100 172 Q80 170 72 140Z" fill="#e6f6ff"/>
      <path d="M60 110 L40 70 L74 92Z M140 110 L160 70 L126 92Z" fill="#a07a4e" stroke="${OUT}" stroke-width="3"/>
      <path d="M100 30 C70 30 56 52 58 76 C60 100 78 112 100 112 C122 112 140 100 142 76 C144 52 130 30 100 30Z" fill="url(#m)" stroke="${OUT}" stroke-width="3"/>
      <path d="M76 36 C70 16 84 8 92 26 M124 36 C130 16 116 8 108 26" fill="#9fdcff" stroke="${OUT}" stroke-width="3"/>
      <path d="M84 34 L100 14 L116 34" fill="#c49a6a" stroke="${OUT}" stroke-width="3"/>
      ${eyes(100, 74, 40, 10, '#0f2f55', 1)}
      <path d="M80 100 Q100 108 120 100" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="40" cy="60" r="6" fill="#bfe9ff" opacity=".8"/><circle cx="164" cy="48" r="4" fill="#bfe9ff" opacity=".8"/>`,
      grad('m', '#6fb8f2', '#215e9e'),
    ),
  mebukin: () =>
    svg(
      `${shadow()}
      ${[...Array(9)].map((_, i) => { const a = (-160 + i * 17.5) * Math.PI / 180; const x = 100 + Math.cos(a) * 62; const y = 118 + Math.sin(a) * 58; return `<path d="M${100 + Math.cos(a) * 30} ${118 + Math.sin(a) * 28} Q${x - 10} ${y} ${x} ${y} Q${x + 8} ${y + 8} ${100 + Math.cos(a) * 34 + 8} ${118 + Math.sin(a) * 30}" fill="${i % 2 ? '#7fd36a' : '#4cae4f'}" stroke="${OUT}" stroke-width="2.5"/>`; }).join('')}
      <ellipse cx="100" cy="128" rx="54" ry="46" fill="#7fd36a" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="140" rx="40" ry="34" fill="#f6e3c3" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="146" rx="7" ry="5" fill="#5a3a22"/>
      ${eyes(100, 128, 40, 9, '#2e5a1e')}${cheeks(100, 150, 62)}${smile(100, 156, 6)}
      <ellipse cx="74" cy="178" rx="12" ry="7" fill="#f6e3c3" stroke="${OUT}" stroke-width="3"/><ellipse cx="126" cy="178" rx="12" ry="7" fill="#f6e3c3" stroke="${OUT}" stroke-width="3"/>
      <path d="M100 72 C92 56 104 46 112 54 C106 58 104 64 100 72Z" fill="#a6e88c" stroke="${OUT}" stroke-width="2.5"/>`,
    ),
  morinonushi: () =>
    svg(
      `${shadow(100, 184, 66)}
      <path d="M44 120 C40 160 64 176 100 176 C136 176 160 160 156 120 Z" fill="url(#g)" stroke="${OUT}" stroke-width="3"/>
      <rect x="54" y="150" width="22" height="30" rx="8" fill="url(#g)" stroke="${OUT}" stroke-width="3"/><rect x="124" y="150" width="22" height="30" rx="8" fill="url(#g)" stroke="${OUT}" stroke-width="3"/>
      ${[...Array(12)].map((_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${100 + Math.cos(a) * 54}" cy="${86 + Math.sin(a) * 50}" r="20" fill="${i % 3 === 0 ? '#2f7a36' : '#3f9a45'}" stroke="${OUT}" stroke-width="2.5"/>`; }).join('')}
      ${[...Array(6)].map((_, i) => { const a = (i / 6) * Math.PI * 2 + 0.3; return `<circle cx="${100 + Math.cos(a) * 62}" cy="${86 + Math.sin(a) * 56}" r="5" fill="#ff8fb6" stroke="${OUT}" stroke-width="1.5"/>`; }).join('')}
      <ellipse cx="100" cy="88" rx="40" ry="36" fill="#d9b47a" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="104" rx="22" ry="14" fill="#f2dcb0"/>
      <path d="M94 98 h12 l-6 7z" fill="#5a3a22"/>
      <path d="M72 80 q10 -8 20 0 M108 80 q10 -8 20 0" fill="none" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="82" cy="84" r="5" fill="#2e5a1e"/><circle cx="118" cy="84" r="5" fill="#2e5a1e"/>
      <path d="M90 112 Q100 118 110 112" fill="none" stroke="${OUT}" stroke-width="3"/>
      <path d="M74 50 l-6 -20 l14 14 M126 50 l6 -20 l-14 14" fill="#8a6a44" stroke="${OUT}" stroke-width="3"/>`,
      grad('g', '#7ccf63', '#2f7a36'),
    ),
  piricchi: () =>
    svg(
      `${shadow(100, 182, 40)}
      <path d="M86 170 l-6 12 m6 -12 l2 12 m-2 -12 l8 10 M114 170 l6 12 m-6 -12 l-2 12 m2 -12 l-8 10" stroke="#e08a1e" stroke-width="4" stroke-linecap="round"/>
      <circle cx="100" cy="118" r="56" fill="url(#p)" stroke="${OUT}" stroke-width="3"/>
      <path d="M44 120 C30 110 32 94 46 98 C42 108 48 114 56 116Z M156 120 C170 110 168 94 154 98 C158 108 152 114 144 116Z" fill="#ffe27a" stroke="${OUT}" stroke-width="3"/>
      <path d="M92 64 L84 36 L100 52 L106 22 L112 60" fill="#ffe27a" stroke="${OUT}" stroke-width="3"/>
      ${eyes(100, 108, 44, 12, '#3a2a0a')}${cheeks(100, 132, 76, '#ff9a3a')}
      <path d="M90 128 L100 140 L110 128 Z" fill="#ff9a3a" stroke="${OUT}" stroke-width="2.5"/>
      <path d="M150 60 l10 -8 l-4 10 l10 -2" fill="none" stroke="#e8c12c" stroke-width="3"/><path d="M40 70 l-8 -8 l2 10 l-10 -4" fill="none" stroke="#e8c12c" stroke-width="3"/>`,
      grad('p', '#fff08a', '#e8b92c'),
    ),
  raimeicho: () =>
    svg(
      `${shadow(100, 186, 60)}
      <path d="M96 120 C40 90 10 100 6 60 C30 76 50 70 70 80 C56 60 58 40 70 30 C78 56 92 70 100 90Z" fill="url(#r)" stroke="${OUT}" stroke-width="3"/>
      <path d="M104 120 C160 90 190 100 194 60 C170 76 150 70 130 80 C144 60 142 40 130 30 C122 56 108 70 100 90Z" fill="url(#r)" stroke="${OUT}" stroke-width="3"/>
      <path d="M86 170 L70 196 L92 178 L100 198 L108 178 L130 196 L114 170Z" fill="#3d4f8a" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="132" rx="38" ry="46" fill="url(#r)" stroke="${OUT}" stroke-width="3"/>
      <path d="M100 100 l-10 22 h12 l-8 22 l22 -30 h-12 l8 -14z" fill="#fff08a" stroke="${OUT}" stroke-width="2"/>
      <circle cx="100" cy="72" r="32" fill="url(#r)" stroke="${OUT}" stroke-width="3"/>
      <path d="M82 44 L76 14 L94 38 L100 6 L106 38 L124 14 L118 44" fill="#fff08a" stroke="${OUT}" stroke-width="3"/>
      <path d="M78 70 l14 4 M122 70 l-14 4" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="86" cy="78" r="6" fill="#ffe27a" stroke="${OUT}" stroke-width="2"/><circle cx="114" cy="78" r="6" fill="#ffe27a" stroke="${OUT}" stroke-width="2"/>
      <path d="M92 88 L100 104 L108 88Z" fill="#ffb03a" stroke="${OUT}" stroke-width="2.5"/>`,
      grad('r', '#ffd84a', '#c78a12'),
    ),
  fuwamo: () =>
    svg(
      `${shadow(100, 182, 44)}
      ${[...Array(14)].map((_, i) => { const a = (i / 14) * Math.PI * 2; return `<circle cx="${100 + Math.cos(a) * 46}" cy="${108 + Math.sin(a) * 44}" r="22" fill="#fffaf0" stroke="${OUT}" stroke-width="2.5"/>`; }).join('')}
      <circle cx="100" cy="108" r="50" fill="#fffaf0"/>
      ${[...Array(6)].map((_, i) => `<path d="M${70 + i * 12} 54 q-4 -20 4 -30" stroke="#d9cdb4" stroke-width="2.5" fill="none"/><circle cx="${74 + i * 12}" cy="24" r="4" fill="#fffaf0" stroke="#bfb29a" stroke-width="1.5"/>`).join('')}
      ${eyes(100, 106, 36, 10, '#6b6259')}${cheeks(100, 124, 60)}
      <path d="M94 124 q6 6 12 0" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="100" cy="146" r="7" fill="#fff6c8" stroke="#e8d48a" stroke-width="2"/>`,
    ),
  hikariwata: () =>
    svg(
      `${shadow(100, 186, 50)}
      <circle cx="100" cy="100" r="86" fill="url(#h)" opacity=".55"/>
      ${[...Array(16)].map((_, i) => { const a = (i / 16) * Math.PI * 2; return `<ellipse cx="${100 + Math.cos(a) * 52}" cy="${106 + Math.sin(a) * 50}" rx="24" ry="20" fill="#fff6d0" stroke="${OUT}" stroke-width="2.5" transform="rotate(${(a * 180) / Math.PI} ${100 + Math.cos(a) * 52} ${106 + Math.sin(a) * 50})"/>`; }).join('')}
      <circle cx="100" cy="106" r="54" fill="#fff6d0"/>
      <path d="M60 60 C40 30 70 20 84 48 M140 60 C160 30 130 20 116 48" fill="#ffe9a0" stroke="${OUT}" stroke-width="3"/>
      <circle cx="100" cy="40" r="10" fill="#fff" stroke="#f3c94b" stroke-width="3"/>
      ${eyes(100, 102, 38, 10, '#b5802a')}${cheeks(100, 122, 62, '#ffb27a')}${smile(100, 122, 7)}
      <path d="M100 150 l4 8 l9 1 l-7 6 l2 9 l-8 -5 l-8 5 l2 -9 l-7 -6 l9 -1z" fill="#ffe27a" stroke="${OUT}" stroke-width="2"/>`,
      `<radialGradient id="h"><stop offset="0" stop-color="#fff6c8"/><stop offset="1" stop-color="#fff6c8" stop-opacity="0"/></radialGradient>`,
    ),
  kagewata: () =>
    svg(
      `${shadow(100, 186, 50)}
      ${[...Array(10)].map((_, i) => { const a = (i / 10) * Math.PI * 2; return `<path d="M${100 + Math.cos(a) * 40} ${108 + Math.sin(a) * 38} q${Math.cos(a) * 40} ${Math.sin(a) * 30 - 10} ${Math.cos(a + 0.3) * 56} ${Math.sin(a + 0.3) * 54}" stroke="#3d2a5c" stroke-width="12" stroke-linecap="round" fill="none" opacity=".9"/>`; }).join('')}
      <circle cx="100" cy="108" r="50" fill="url(#kw)" stroke="${OUT}" stroke-width="3"/>
      <path d="M58 76 L40 30 L80 62Z M142 76 L160 30 L120 62Z" fill="#4a3470" stroke="${OUT}" stroke-width="3"/>
      <path d="M74 98 q12 -10 22 2 L74 104Z M126 98 q-12 -10 -22 2 L126 104Z" fill="#ffe27a" stroke="${OUT}" stroke-width="2.5"/>
      <path d="M86 128 Q100 120 114 128" fill="none" stroke="#ffe27a" stroke-width="3"/>
      <circle cx="150" cy="150" r="6" fill="#9b7fe0" opacity=".7"/><circle cx="46" cy="140" r="4" fill="#9b7fe0" opacity=".7"/>`,
      grad('kw', '#7b5ea8', '#2b1d44'),
    ),
  kazewata: () =>
    svg(
      `${shadow(100, 188, 40)}
      <path d="M30 120 C40 60 160 60 170 110 C150 80 60 80 46 124Z" fill="#bff0e8" stroke="${OUT}" stroke-width="2.5" opacity=".85"/>
      <path d="M40 150 C60 110 150 110 166 140 C140 124 70 124 54 154Z" fill="#9fe6da" stroke="${OUT}" stroke-width="2.5" opacity=".85"/>
      <path d="M100 40 C70 40 56 70 64 100 C70 130 86 150 100 176 C114 150 130 130 136 100 C144 70 130 40 100 40Z" fill="url(#z)" stroke="${OUT}" stroke-width="3"/>
      <path d="M70 60 L50 34 L84 48Z M130 60 L150 34 L116 48Z" fill="#5cc7b8" stroke="${OUT}" stroke-width="3"/>
      <path d="M74 86 l20 4 M126 86 l-20 4" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      <ellipse cx="86" cy="96" rx="6" ry="7" fill="#0f4a44"/><ellipse cx="114" cy="96" rx="6" ry="7" fill="#0f4a44"/>
      <circle cx="84" cy="93" r="2" fill="#fff"/><circle cx="112" cy="93" r="2" fill="#fff"/>
      <path d="M92 116 L100 112 L108 116" fill="none" stroke="${OUT}" stroke-width="3" stroke-linecap="round"/>`,
      grad('z', '#e6fffa', '#5cc7b8'),
    ),
  koishimo: () =>
    svg(
      `${shadow(100, 182, 56)}
      <ellipse cx="100" cy="130" rx="60" ry="48" fill="#8a6a44" stroke="${OUT}" stroke-width="3"/>
      ${[[64, 96, 16], [96, 84, 18], [130, 98, 15], [80, 112, 12], [118, 116, 13], [142, 124, 10]].map(([x, y, r]) => `<path d="M${x - r} ${y} L${x - r * 0.4} ${y - r} L${x + r * 0.7} ${y - r * 0.8} L${x + r} ${y + r * 0.3} L${x + r * 0.2} ${y + r} L${x - r * 0.8} ${y + r * 0.7}Z" fill="#b7b0a6" stroke="${OUT}" stroke-width="2.5"/>`).join('')}
      <ellipse cx="100" cy="146" rx="40" ry="28" fill="#e9c8a0" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="146" rx="9" ry="7" fill="#ff8fa3" stroke="${OUT}" stroke-width="2"/>
      <path d="M82 134 q6 -4 10 0 M108 134 q6 -4 10 0" fill="none" stroke="${OUT}" stroke-width="3.5" stroke-linecap="round"/>
      <path d="M50 168 l-10 8 m14 -6 l-6 12 m12 -10 l0 12 M150 168 l10 8 m-14 -6 l6 12 m-12 -10 l0 12" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>`,
    ),
  gankutsu: () =>
    svg(
      `${shadow(100, 186, 70)}
      <path d="M28 150 C20 80 70 40 110 44 C160 48 184 96 174 150 Z" fill="#6f6a66" stroke="${OUT}" stroke-width="3"/>
      <path d="M40 120 L70 70 L104 60 L140 72 L164 112" fill="none" stroke="#4a4542" stroke-width="5"/>
      <path d="M60 96 L84 92 M118 84 L146 100" stroke="#a7d8ff" stroke-width="4" stroke-linecap="round"/>
      <path d="M50 150 C50 120 150 120 150 150 C150 176 50 176 50 150Z" fill="#c9a06a" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="144" rx="11" ry="8" fill="#ff8fa3" stroke="${OUT}" stroke-width="2"/>
      <path d="M76 134 l12 -4 M124 134 l-12 -4" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      ${[30, 160].map((x) => `<path d="M${x} 170 l-14 10 m18 -8 l-8 16 m16 -14 l2 16" stroke="${OUT}" stroke-width="6" stroke-linecap="round"/>`).join('')}`,
    ),
  kazamidori: () =>
    svg(
      `${shadow(100, 184, 40)}
      <path d="M88 168 l-4 16 M112 168 l4 16" stroke="#e08a1e" stroke-width="5" stroke-linecap="round"/>
      <path d="M60 120 C30 116 20 96 26 84 C44 96 56 98 70 104Z" fill="#9fdce8" stroke="${OUT}" stroke-width="3"/>
      <path d="M140 120 C170 116 180 96 174 84 C156 96 144 98 130 104Z" fill="#9fdce8" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="128" rx="40" ry="44" fill="url(#kz)" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="100" cy="140" rx="24" ry="26" fill="#f2fbff"/>
      <circle cx="100" cy="78" r="30" fill="url(#kz)" stroke="${OUT}" stroke-width="3"/>
      <path d="M100 48 L96 18 L112 10 L106 26 L122 24 L104 48Z" fill="#ef6a3a" stroke="${OUT}" stroke-width="2.5"/>
      <path d="M128 78 L156 72 L128 88Z" fill="#ffb03a" stroke="${OUT}" stroke-width="2.5"/>
      ${eyes(104, 76, 22, 7, '#123d6a', 2)}`,
      grad('kz', '#bff0f8', '#5aaec4'),
    ),
  yoiyami: () =>
    svg(
      `${shadow(100, 186, 50)}
      <path d="M96 100 C60 40 10 50 16 100 C20 130 60 132 96 116Z" fill="url(#y)" stroke="${OUT}" stroke-width="3"/>
      <path d="M104 100 C140 40 190 50 184 100 C180 130 140 132 104 116Z" fill="url(#y)" stroke="${OUT}" stroke-width="3"/>
      <path d="M94 116 C70 130 40 150 52 170 C70 176 90 150 96 126Z M106 116 C130 130 160 150 148 170 C130 176 110 150 104 126Z" fill="#5a3f86" stroke="${OUT}" stroke-width="3"/>
      <ellipse cx="52" cy="90" rx="14" ry="18" fill="#ffcf6b" stroke="${OUT}" stroke-width="2.5"/><path d="M42 82 h20 M42 98 h20" stroke="#c96b2a" stroke-width="2"/>
      <ellipse cx="148" cy="90" rx="14" ry="18" fill="#ffcf6b" stroke="${OUT}" stroke-width="2.5"/><path d="M138 82 h20 M138 98 h20" stroke="#c96b2a" stroke-width="2"/>
      <ellipse cx="100" cy="122" rx="16" ry="40" fill="#3d2a5c" stroke="${OUT}" stroke-width="3"/>
      <circle cx="100" cy="80" r="22" fill="#3d2a5c" stroke="${OUT}" stroke-width="3"/>
      <path d="M90 60 C80 40 70 36 64 40 M110 60 C120 40 130 36 136 40" fill="none" stroke="${OUT}" stroke-width="3"/><circle cx="64" cy="40" r="5" fill="#ffcf6b"/><circle cx="136" cy="40" r="5" fill="#ffcf6b"/>
      ${eyes(100, 80, 22, 8, '#ffcf6b')}`,
      grad('y', '#9b7fe0', '#4a3470'),
    ),
  hotarunoou: () =>
    svg(
      `${shadow(100, 190, 76)}
      <circle cx="100" cy="100" r="96" fill="url(#halo)"/>
      <path d="M92 100 C40 20 0 40 6 96 C10 136 60 140 92 120Z" fill="#e8ffb0" fill-opacity=".8" stroke="${OUT}" stroke-width="3"/>
      <path d="M108 100 C160 20 200 40 194 96 C190 136 140 140 108 120Z" fill="#e8ffb0" fill-opacity=".8" stroke="${OUT}" stroke-width="3"/>
      <path d="M40 80 Q60 90 84 100 M160 80 Q140 90 116 100" stroke="#a8c84a" stroke-width="3" fill="none"/>
      <ellipse cx="100" cy="140" rx="30" ry="46" fill="url(#hb)" stroke="${OUT}" stroke-width="3"/>
      <path d="M78 150 h44 M80 166 h40" stroke="#5a7a22" stroke-width="3"/>
      <ellipse cx="100" cy="176" rx="22" ry="12" fill="#fff9a0" stroke="${OUT}" stroke-width="3"/>
      <circle cx="100" cy="76" r="30" fill="url(#hb)" stroke="${OUT}" stroke-width="3"/>
      <path d="M84 50 C70 20 60 14 50 18 M116 50 C130 20 140 14 150 18" fill="none" stroke="${OUT}" stroke-width="3"/>
      <circle cx="50" cy="18" r="8" fill="#fff9a0" stroke="${OUT}" stroke-width="2"/><circle cx="150" cy="18" r="8" fill="#fff9a0" stroke="${OUT}" stroke-width="2"/>
      <path d="M80 74 l14 4 M120 74 l-14 4" stroke="${OUT}" stroke-width="4" stroke-linecap="round"/>
      <circle cx="88" cy="82" r="6" fill="#d9ff5a" stroke="${OUT}" stroke-width="2"/><circle cx="112" cy="82" r="6" fill="#d9ff5a" stroke="${OUT}" stroke-width="2"/>
      ${[[30, 150], [170, 150], [40, 40], [160, 40], [20, 110], [180, 110]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#fff9a0"/><circle cx="${x}" cy="${y}" r="10" fill="#fff9a0" opacity=".3"/>`).join('')}`,
      `<radialGradient id="halo"><stop offset="0" stop-color="#f5ffc0" stop-opacity=".7"/><stop offset="1" stop-color="#f5ffc0" stop-opacity="0"/></radialGradient>${grad('hb', '#d9f27a', '#6f9a2a')}`,
    ),
};

const cache = new Map<string, string>();

/** 画像のデータURL（img要素・Phaserのテクスチャ両方で使う） */
export function monsterImageUrl(artId: string): string {
  let url = cache.get(artId);
  if (!url) {
    const recipe = MONSTER_ART[artId];
    const text = recipe ? recipe() : svg(`<circle cx="100" cy="110" r="60" fill="#ccc" stroke="${OUT}" stroke-width="3"/><text x="100" y="124" font-size="48" text-anchor="middle">?</text>`);
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
    const text = (recipe ? recipe() : svg('')).replace('<g filter="url(#rl)">', '<g>').replace('<g stroke-linejoin="round">', '<g stroke-linejoin="round" filter="url(#sil)">').replace('<defs>', '<defs><filter id="sil"><feColorMatrix type="matrix" values="0 0 0 0 0.25  0 0 0 0 0.22  0 0 0 0 0.3  0 0 0 1 0"/></filter>');
    url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`;
    cache.set(key, url);
  }
  return url;
}
