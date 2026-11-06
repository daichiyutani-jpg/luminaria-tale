/**
 * 完全攻略ガイド（guide.html）。
 * 数字・出現表・トレーナー・図鑑・技・道具は すべてゲームのデータから その場で作るので、
 * ゲームを直せば ガイドも自動で同じ内容になる。文章の説明だけ ここに手で書いている。
 */
import './guide.css';
import type { Element, EvolutionCondition, MoveDef, SpeciesDef, StatKey } from '../core/types';
import { monsterImageUrl } from '../art/monsterArt';
import { effectiveness, ELEMENT_ORDER, ELEMENTS } from '../data/elements';
import { ITEM_ORDER, ITEMS } from '../data/items';
import { MAPS, type MapDef } from '../data/maps';
import { MOVES } from '../data/moves';
import { QUEST_ORDER, QUESTS } from '../data/quests';
import { SCRIPTS, type Cmd } from '../data/scripts';
import { SHOPS } from '../data/shops';
import { SPECIES, SPECIES_LIST, STARTERS } from '../data/species';
import { TRAINERS, type TrainerDef } from '../data/trainers';
import { GYMS, ISLE_BOSS_LEVEL, TOKOYO2_LEVEL } from '../data/world';
import { PARTY_MAX } from '../logic/game';
import { MAX_LEVEL } from '../logic/stats';

declare const __APP_VERSION__: string;

// ───────────── 小さな道具 ─────────────
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
const chip = (e: Element) => `<span class="chip" style="background:${ELEMENTS[e].color}">${ELEMENTS[e].name}</span>`;
const sp = (id: string) => SPECIES[id];
const spLink = (id: string, lv?: number | string) => {
  const s = sp(id);
  if (!s) return esc(id);
  return `<a class="mon" href="#dex-${s.id}"><img src="${monsterImageUrl(s.art)}" alt="" loading="lazy">${esc(s.name)}${lv !== undefined ? `<small>Lv${lv}</small>` : ''}</a>`;
};
const itemName = (id: string) => ITEMS[id]?.name ?? id;
const itemList = (items: [string, number][]) => items.map(([id, n]) => `${esc(itemName(id))}×${n}`).join('、');
const STAT_NAME: Record<StatKey, string> = { hp: 'HP', atk: '攻撃', def: '防御', spa: '特攻', spd: '特防', spe: '素早' };
const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];
const ROLE_NAME: Record<string, string> = { attacker: '攻撃型', tank: '耐久型', special: '特攻型', support: '補助型', speed: 'スピード型', balanced: 'バランス型' };
const RARITY_NAME: Record<string, string> = { common: 'よく出る', uncommon: 'ふつう', rare: 'めずらしい', boss: 'ボス', legend: '伝説' };
const STATUS_NAME: Record<string, string> = { burn: 'やけど', poison: 'どく', paralyze: 'まひ', sleep: 'ねむり', mist: 'かすみ' };
const CAT_NAME = { physical: '物理', special: '特殊', status: '変化' } as const;

/** スクリプトの中のコマンドを ぜんぶ たどる */
function walk(cmds: Cmd[], f: (c: Cmd) => void): void {
  for (const c of cmds) {
    f(c);
    for (const k of ['then', 'else', 'win', 'lose', 'caught', 'run'] as const) {
      const sub = (c as Record<string, unknown>)[k];
      if (Array.isArray(sub)) walk(sub as Cmd[], f);
    }
    if ('choice' in c) for (const o of c.choice ? c.options : []) walk(o.then, f);
  }
}

// ───────────── 旅の順番（マップの並び） ─────────────
/** 北の出口（y=0 の 9列目）の行き先 */
const northOf = (m: MapDef) => m.warps.find((w) => w.y === 0 && w.x === 9)?.to.mapId;
const routeInto = (townId: string) => Object.values(MAPS).find((m) => (m.kind === 'field' || m.kind === 'dungeon') && northOf(m) === townId);
const gymMapOf = (n: number, townId: string) => MAPS[n === 1 ? 'village_gym' : `${townId}_gym`];

interface Stage {
  title: string;
  maps: MapDef[];
  gym?: (typeof GYMS)[number];
  text: string;
}

const stages: Stage[] = [];
{
  const g1 = GYMS.find((g) => g.n === 1)!;
  stages.push({
    title: '序章　ひだまり村から 旅立ち',
    maps: [MAPS.home, MAPS.lab, MAPS.village],
    text: `自分の家で目をさましたら、村の左上の研究所へ。ソラネ博士の前の台座から 相棒を1匹えらびます（あとで残りの2匹も手に入ります → <a href="#starters">最初の3匹</a>）。
研究所を出ようとすると ライバルのカイトが勝負を挑んできます。相手は こちらに有利な属性ですが、負けても話は進みます。
勝負のあと、博士から ともしび図鑑・ランタン・きずぐすりをもらえます。村の灯の家（回復・ボックス）と トトの道具屋も使えるようになります。`,
  });
  stages.push({
    title: '第1章　そよかぜ草原と ほたる森',
    maps: [MAPS.grassland, MAPS.firefly_forest],
    text: `村の北の出口から そよかぜ草原へ。草むらで灯獣を捕まえて、なかまを ${PARTY_MAX}匹まで そろえましょう。
草原の3人（ユウ・ミオ・ゲン）に勝つと サブクエスト「草原のうでじまん」達成。ノノに話すと 迷子のフワモ「モコ」探しが始まり、見つけると <b>あかつきの石</b> がもらえます。
ほたる森では 静夜団のしたっぱ2人を倒し、森の3本の灯籠柱（地図の <span class="mk L">L</span>）を調べて 灯をともすと 奥の黒霞が晴れます。
森の奥の泉で <b>ホタルノオウ</b> と対決。ひかり属性なので かげの技がよく効きます。めやすは 相棒Lv15・なかまLv13。勝つと「ほたるのはね」と、2匹目の最初の灯獣（Lv12）がもらえます。
ホタルノオウを倒すと 森の北の出口（番人がいた所）が通れるようになり、こもれび町へ進めます。
村のジム（ツムギ・ふつう）は いつでも挑戦できますが、めやすは ホタルノオウのあと。ふつうの技は いわお に いまひとつなので、いわお の灯獣を出すと 受けとめやすいです。`,
  });
  stages[1].gym = g1;
  stages[1].maps.push(gymMapOf(1, 'village'));
}
for (const g of GYMS.filter((x) => x.n >= 2)) {
  const route = routeInto(g.townId);
  const town = MAPS[g.townId];
  const maps = [route, town, gymMapOf(g.n, g.townId)].filter((m): m is MapDef => !!m);
  const weak = g.element === 'mixed' ? '' : ELEMENT_ORDER.filter((a) => effectiveness(a, [g.element as Element]) > 1);
  let text = `${route ? `${esc(route.name)}を 北へ進むと ${esc(g.townName)}。` : ''}町の灯の家で回復・買い物・ボックス・<b>灯の渡し舟</b>（一度行った町へすぐ行ける）が使えます。`;
  text += g.element === 'mixed'
    ? `\nジムリーダー ${esc(g.leader)} は いろいろな属性の 最終進化を使ってきます。属性の かたよらない ${PARTY_MAX}匹で挑みましょう。`
    : `\nジムリーダー ${esc(g.leader)} は ${chip(g.element as Element)} の使い手。${(weak as Element[]).map(chip).join('')} の技が よく効きます。`;
  if (g.n === 3) text += '\nナギサに初めて勝つと、3匹目の最初の灯獣（Lv20）がもらえます。';
  if (g.n === 8) text += '\nジム8のあと すぐ北の たそがれ街道に 伝説の灯獣 <b>チョンボ</b>（Lv45）がいます（→ <a href="#legend">伝説とボス</a>）。';
  if (g.n === 10) text += '\n灯章が10個そろうと、都の北の黒霞（地図の <span class="mk X">X</span>）が晴れて 黒霞の洞窟へ進めます。';
  stages.push({ title: `ジム${g.n}　${g.townName}`, maps, gym: g, text });
}
stages.push({
  title: '最終章　黒霞の洞窟',
  maps: [MAPS.kurogasumi_cave, MAPS.kurogasumi_depths].filter(Boolean),
  text: `洞窟の野生は Lv58〜64。静夜団の3人を倒しながら 最奥へ。最奥には 灯の泉（地図の <span class="mk P">P</span>）があるので、回復してから挑めます。
ヨルと話すと ラスボス <b>トコヨノヤミ（Lv70・かげ）</b> との戦い。ひかりの技が 2倍で効きます。かげの技は いまひとつ。
専用技「とこよのよる」は 威力120の大技なので、HPが半分を切ったら 早めに回復を。まんたんのくすり と げんきのかけら を多めに持っていきましょう。めやすは 主力 Lv68〜72。
倒すと エンディング。その後は <a href="#second">2周目</a> が始まります。`,
});

// ───────────── さいはて諸島（クリア後の追加エリア） ─────────────
stages.push({
  title: '後日談　2回目のトコヨノヤミ',
  maps: [],
  text: `2周目で <b>きらめく灯章を10個</b> そろえると、黒霞の洞窟の最奥に トコヨノヤミが ふたたび現れます（<b>Lv${TOKOYO2_LEVEL}</b>）。1回目と同じく ひかりの技が2倍。
倒すと 灯の渡し舟で <b>さいはて諸島</b>（しろなみ港）へ 行けるようになります。島には 本島にいない灯獣が49種いて、野生も トレーナーも 本島より ずっと強いです（野生 Lv80〜96）。`,
});
const ISLE_STAGE: [string, string, string | null, string][] = [
  ['shiranami_port', 'しろなみ港', 'sasanami_coast', '島の入口。灯の家の「さいはての道具屋」で まんたんのくすり・げんきのかけら が買えます。<b>ローション（100,000ルクス）</b> もここで売っています（チョンボに使うと ボッキーに進化）。'],
  ['kokemusu_village', 'こけむす里', 'inishie_jukai', 'いにしえ樹海は 木々の深い森の道。'],
  ['tsurara_village', 'つらら村', 'koorikaze_pass', 'こおりかぜ峠は 寒い山道。'],
  ['hoshifuru_hill', 'ほしふる丘', 'nagareboshi_field', 'ながれぼし野は 島の道でいちばん強い野生（Lv89〜93）。'],
  ['hate_capital', 'さいはての都', null, '島の最北。北の出口から さいはての灯台へ。'],
];
for (const [townId, townName, routeId, note] of ISLE_STAGE) {
  stages.push({
    title: `さいはて諸島　${townName}`,
    maps: [MAPS[townId], routeId ? MAPS[routeId] : undefined].filter((m): m is MapDef => !!m),
    text: `${note}\n島の町には ジムは ありません。灯の家・道具屋・渡し舟は使えます。`,
  });
}
stages.push({
  title: '最終決戦　さいはての灯台',
  maps: [MAPS.saihate_lighthouse, MAPS.saihate_top].filter(Boolean),
  text: `灯台の中の野生は Lv92〜96。灯守たち、そして最後にライバルの <b>カイト（Lv98〜99）</b> が待っています。
灯台の頂上で <b>ハテノヌシ（Lv${ISLE_BOSS_LEVEL}・ひかり／かげ）</b> と対決。捕まえられません。専用技「はてのひかり」は威力130。主力を Lv95〜100 まで育て、回復の道具を たっぷり持って挑みましょう。
倒すと 本当のエンディング「さいはての 灯」。`,
});

// ───────────── 地図（1マス=1色） ─────────────
const TILE_COLOR: Record<string, string> = {
  '.': 'ground', ',': 'path', '"': 'grass', f: 'ground', T: 'tree', h: 'tree', '~': '#4a8fd8', '=': '#b0584a', '#': '#d8c8a8', D: '#6a4a2a',
  F: '#a08060', R: '#8a7a6a', S: '#c8a050', C: '#e0a020', L: '#ffe070', X: '#3a2a4a', P: '#7ad8f0', K: '#90a0c0', O: '#c0b0e0', _: '#e8dcc0', W: '#6a5a4a', B: '#b08a5a',
};
function mapSvg(m: MapDef): string {
  const W = Math.max(...m.tiles.map((r) => r.length));
  const H = m.tiles.length;
  const k = 10;
  const pal = m.palette;
  const col = (ch: string) => {
    const c = TILE_COLOR[ch] ?? '#ccc';
    return c === 'ground' ? pal.ground : c === 'path' ? pal.path : c === 'grass' ? pal.grass : c === 'tree' ? pal.tree : c;
  };
  let s = `<svg class="map" shape-rendering="crispEdges" viewBox="0 0 ${W * k} ${H * k}" width="${W * k}" height="${H * k}" role="img" aria-label="${esc(m.name)}の地図">`;
  m.tiles.forEach((row, y) => [...row].forEach((ch, x) => (s += `<rect x="${x * k}" y="${y * k}" width="${k}" height="${k}" fill="${col(ch)}"/>`)));
  m.tiles.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '"') s += `<path d="M${x * k + 2} ${y * k + 8}l2-5 2 5 2-5 2 5" stroke="#2f6a2a" fill="none" stroke-width="1"/>`;
  }));
  const dot = (x: number, y: number, c: string, t: string) => (s += `<circle cx="${x * k + 5}" cy="${y * k + 5}" r="4.4" fill="${c}" stroke="#111" stroke-width="1"/><text x="${x * k + 5}" y="${y * k + 8}" font-size="7" text-anchor="middle" fill="#111" font-weight="700">${t}</text>`);
  for (const o of m.objects) {
    if (o.kind === 'chest') dot(o.x, o.y, '#ffb020', '宝');
    else if (o.kind === 'hidden') dot(o.x, o.y, '#ff7ad0', '隠');
    else if (o.kind === 'lantern') dot(o.x, o.y, '#ffe070', 'L');
  }
  for (const n of m.npcs) {
    if (n.trainerId) dot(n.x, n.y, TRAINERS[n.trainerId]?.bgm === 'boss' ? '#ff5a5a' : '#ff9a6a', '戦');
    else if (n.look.kind === 'boss') dot(n.x, n.y, '#c04aff', '!');
  }
  return `${s}</svg>`;
}

// ───────────── 各マップの説明 ─────────────
function encounterTable(m: MapDef): string {
  const t = m.encounters?.table;
  if (!t?.length) return '';
  const total = t.reduce((a, e) => a + e.weight, 0);
  return `<table class="t"><thead><tr><th>野生の灯獣</th><th>Lv</th><th>出やすさ</th></tr></thead><tbody>${[...t]
    .sort((a, b) => b.weight - a.weight)
    .map((e) => `<tr><td>${spLink(e.speciesId)} ${sp(e.speciesId)?.elements.map(chip).join('') ?? ''}</td><td>${e.minLevel}〜${e.maxLevel}</td><td>${Math.round((e.weight / total) * 100)}%</td></tr>`)
    .join('')}</tbody></table>`;
}
function partyLine(t: TrainerDef | undefined): string {
  if (!t) return '';
  return t.party.map((p) => spLink(p.speciesId === '__rival_starter' ? 'shizukun' : p.speciesId, p.level)).join(' ');
}
function trainerRows(m: MapDef): string {
  const rows = m.npcs.filter((n) => n.trainerId && !n.trainerId.match(/^gym\d+$/)).map((n) => {
    const t = TRAINERS[n.trainerId!];
    if (!t) return '';
    return `<tr><td>${esc(t.title)}の${esc(t.name)}</td><td>${partyLine(t)}</td><td>${t.reward}円</td></tr>`;
  });
  return rows.length ? `<table class="t"><thead><tr><th>トレーナー</th><th>灯獣</th><th>賞金</th></tr></thead><tbody>${rows.join('')}</tbody></table>` : '';
}
function itemRows(m: MapDef): string {
  const its = m.objects.filter((o) => (o.kind === 'chest' || o.kind === 'hidden') && o.item);
  if (!its.length) return '';
  return `<ul class="items">${its.map((o) => `<li><span class="mk ${o.kind === 'chest' ? 'C' : 'H'}">${o.kind === 'chest' ? '宝' : '隠'}</span>${esc(itemName(o.item![0]))}×${o.item![1]}<small>（${o.kind === 'chest' ? '宝箱' : '見えない道具。その場で A'}・横${o.x} 縦${o.y}）</small></li>`).join('')}</ul>`;
}
function gymBlock(g: (typeof GYMS)[number]): string {
  const t1 = TRAINERS[`gym${g.n}`];
  const t2 = TRAINERS[`gym${g.n}_r`];
  const gm = gymMapOf(g.n, g.townId);
  const sub = gm ? gm.npcs.filter((n) => n.trainerId && n.trainerId !== `gym${g.n}`).map((n) => TRAINERS[n.trainerId!]).filter(Boolean) : [];
  return `<div class="gym">
    <h4>ジムリーダー ${esc(g.leader)}　${g.element === 'mixed' ? '<span class="chip" style="background:#888">いろいろ</span>' : chip(g.element as Element)}</h4>
    <p class="party"><b>1周目</b>（最高Lv${g.ace}）${partyLine(t1)}</p>
    <p class="note">勝つと「${esc(g.badge)}」と ${itemList(g.reward)}、賞金 ${t1?.reward ?? 0}円</p>
    ${sub.length ? `<p class="note">ジムの中のトレーナー：${sub.map((t) => `${esc(t.title)}の${esc(t.name)} ${partyLine(t)}`).join(' ／ ')}</p>` : ''}
    <p class="party"><b>2周目</b>（最高Lv${g.rematchAce}）${partyLine(t2)}</p>
    <p class="note">初めて勝つと「きらめく灯章」と ${itemList(g.rematchReward)}。何度でも再戦できます</p>
  </div>`;
}
function mapBlock(m: MapDef): string {
  const skipMap = m.kind === 'indoor' && !m.id.endsWith('_gym') && m.id !== 'village_gym';
  const body = [encounterTable(m), trainerRows(m), itemRows(m)].join('');
  const legend = m.npcs.filter((n) => n.look.kind === 'boss' && !n.trainerId).map((n) => `<p class="note">★ ${esc(n.name)}（地図の <span class="mk B">!</span>）→ <a href="#legend">伝説とボス</a></p>`).join('');
  if (skipMap && !body) return '';
  return `<details class="mapbox" ${m.kind !== 'indoor' ? 'open' : ''}><summary>${esc(m.name)}${m.encounters ? `<small>野生 Lv${Math.min(...m.encounters.table.map((e) => e.minLevel))}〜${Math.max(...m.encounters.table.map((e) => e.maxLevel))}</small>` : ''}</summary>
    <div class="mapwrap">${mapSvg(m)}</div>${legend}${body}</details>`;
}

// ───────────── 図鑑 ─────────────
function condText(c: EvolutionCondition): string {
  switch (c.kind) {
    case 'level': return `Lv${c.level}`;
    case 'item': return `「${itemName(c.itemId)}」を使う${c.minLevel ? `（Lv${c.minLevel}以上）` : ''}`;
    case 'levelAtLocation': return `${MAPS[c.mapId]?.name ?? c.mapId}で Lv${c.level}以上`;
    case 'levelKnowsMove': return `「${MOVES[c.moveId]?.name ?? c.moveId}」を覚えて Lv${c.level}以上`;
    case 'quest': return `クエスト「${QUESTS[c.questId]?.name ?? c.questId}」のあと Lv${c.level}`;
  }
}
const preOf: Record<string, string> = {};
for (const s of SPECIES_LIST) for (const e of s.evolutions ?? []) preOf[e.to] = s.id;

/** どこで出会えるか（野生・もらう・伝説） */
const wildAt: Record<string, string[]> = {};
for (const m of Object.values(MAPS)) {
  for (const e of m.encounters?.table ?? []) (wildAt[e.speciesId] ??= []).push(`${m.name}（Lv${e.minLevel}〜${e.maxLevel}）`);
}
const specialAt: Record<string, string[]> = {};
for (const id of STARTERS) specialAt[id] = ['最初の3匹：研究所で1匹えらぶ／残りは ホタルノオウ撃破（Lv12）と ジム3 初勝利（Lv20）でもらえる'];
for (const [name, cmds] of Object.entries(SCRIPTS)) {
  walk(cmds, (c) => {
    if ('legend' in c) (specialAt[c.legend.speciesId] ??= []).push(`伝説：${Object.values(MAPS).find((m) => m.npcs.some((n) => n.talk.some((t) => t.script === name)))?.name ?? ''}で Lv${c.legend.level}（捕まえられる）`);
    if ('boss' in c) (specialAt[c.boss.speciesId] ??= []).push(`ボス：Lv${c.boss.level}（捕まえられない）`);
  });
}
function whereText(s: SpeciesDef): string {
  const list = [...(specialAt[s.id] ?? []), ...(wildAt[s.id] ?? [])];
  if (list.length) return list.map(esc).join('<br>');
  const pre = preOf[s.id];
  return pre ? `野生には いない。${esc(sp(pre).name)}から 進化` : '—';
}
function learnTable(s: SpeciesDef): string {
  return `<table class="t mini"><thead><tr><th>Lv</th><th>技</th><th>属性</th><th>威力</th><th>命中</th></tr></thead><tbody>${s.learnset
    .map(([lv, id]) => {
      const m = MOVES[id];
      if (!m) return '';
      return `<tr><td>${lv}</td><td><a href="#move-${m.id}">${esc(m.name)}</a></td><td>${chip(m.element)}</td><td>${m.power || '—'}</td><td>${m.accuracy > 100 ? '必中' : m.accuracy}</td></tr>`;
    })
    .join('')}</tbody></table>`;
}
function dexCard(s: SpeciesDef): string {
  const total = STAT_KEYS.reduce((a, k) => a + s.baseStats[k], 0);
  const pre = preOf[s.id];
  const evo = [
    pre ? `${spLink(pre)} から ${esc(condText(sp(pre).evolutions!.find((e) => e.to === s.id)!.condition))}` : '',
    ...(s.evolutions ?? []).map((e) => `→ ${spLink(e.to)}：${esc(condText(e.condition))}<small>（${esc(e.hint)}）</small>`),
  ].filter(Boolean);
  return `<article class="dex" id="dex-${s.id}" data-name="${esc(s.name)}" data-el="${s.elements.join(' ')}">
    <div class="dex-head"><img src="${monsterImageUrl(s.art)}" alt="${esc(s.name)}" loading="lazy">
      <div><div class="no">No.${String(s.dexNo).padStart(3, '0')}</div><h4>${esc(s.name)}</h4><div class="cat">${esc(s.category)}</div>
      <div>${s.elements.map(chip).join('')} <span class="tag">${ROLE_NAME[s.role] ?? s.role}</span> <span class="tag">${RARITY_NAME[s.rarity] ?? s.rarity}</span></div></div></div>
    <p class="desc">${esc(s.description)}</p>
    <div class="stats">${STAT_KEYS.map((k) => `<div><span>${STAT_NAME[k]}</span><i style="width:${Math.min(100, s.baseStats[k] / 1.6)}%"></i><b>${s.baseStats[k]}</b></div>`).join('')}<div class="sum">合計 <b>${total}</b>　捕まえやすさ <b>${s.catchRate || '捕獲不可'}</b></div></div>
    <p class="where"><b>出会える場所</b><br>${whereText(s)}</p>
    ${evo.length ? `<p class="evo"><b>進化</b><br>${evo.join('<br>')}</p>` : ''}
    <details><summary>覚える技（${s.learnset.length}）</summary>${learnTable(s)}</details>
  </article>`;
}

// ───────────── 技・道具・相性・クエスト ─────────────
function moveEffect(m: MoveDef): string {
  const e = m.effect;
  if (!e) return '';
  const out: string[] = [];
  if (e.status) out.push(`${STATUS_NAME[e.status]}${e.chance && e.chance < 100 ? `（${e.chance}%）` : ''}`);
  if (e.stages) out.push(Object.entries(e.stages).map(([k, v]) => `${e.stageTarget === 'self' || m.target === 'self' ? '自分の' : '相手の'}${STAT_NAME[k as StatKey] ?? '命中'}${v! > 0 ? '+' : ''}${v}`).join(' '));
  if (e.drain) out.push(`吸収${Math.round(e.drain * 100)}%`);
  if (e.heal) out.push(`回復${Math.round(e.heal * 100)}%`);
  if (e.priority) out.push('先制');
  if (e.highCrit) out.push('急所に当たりやすい');
  if (e.recoil) out.push(`反動${Math.round(e.recoil * 100)}%`);
  if (e.guard) out.push(`${e.guard}ターン 相手の技を受けない`);
  return out.join('・');
}
function movesSection(): string {
  const learners: Record<string, string[]> = {};
  for (const s of SPECIES_LIST) for (const [, id] of s.learnset) (learners[id] ??= []).includes(s.name) || learners[id].push(s.name);
  const list = Object.values(MOVES).filter((m) => learners[m.id]).sort((a, b) => ELEMENT_ORDER.indexOf(a.element) - ELEMENT_ORDER.indexOf(b.element) || a.power - b.power);
  return `<div class="tablewrap"><table class="t moves"><thead><tr><th>技</th><th>属性</th><th>分類</th><th>威力</th><th>命中</th><th>PP</th><th>効果・説明</th></tr></thead><tbody>${list
    .map((m) => `<tr id="move-${m.id}" data-el="${m.element}"><td><b>${esc(m.name)}</b></td><td>${chip(m.element)}</td><td>${CAT_NAME[m.category]}</td><td>${m.power || '—'}</td><td>${m.accuracy > 100 ? '必中' : m.accuracy}</td><td>${m.pp}</td><td>${esc(m.description)}${moveEffect(m) ? `<br><small>${esc(moveEffect(m))}</small>` : ''}<br><small class="muted">覚える：${esc(learners[m.id].slice(0, 8).join('、'))}${learners[m.id].length > 8 ? ` ほか${learners[m.id].length - 8}種` : ''}</small></td></tr>`)
    .join('')}</tbody></table></div>`;
}
function itemsSection(): string {
  const found: Record<string, string[]> = {};
  for (const m of Object.values(MAPS)) for (const o of m.objects) if (o.item) (found[o.item[0]] ??= []).push(m.name);
  for (const q of Object.values(QUESTS)) for (const [id] of q.reward.items ?? []) (found[id] ??= []).push(`クエスト「${q.name}」`);
  for (const g of GYMS) for (const [id] of [...g.reward, ...g.rematchReward]) (found[id] ??= []).includes(`ジム${g.n}`) || found[id].push(`ジム${g.n}`);
  const shopOf = (id: string) => Object.values(SHOPS).filter((s) => s.stock.some((x) => x.itemId === id)).map((s) => s.name);
  return `<div class="tablewrap"><table class="t"><thead><tr><th>道具</th><th>説明</th><th>値段</th><th>手に入る場所</th></tr></thead><tbody>${ITEM_ORDER.map((id) => {
    const it = ITEMS[id];
    const shops = shopOf(id);
    const where = [...new Set([...(shops.length ? [`お店（${shops.join('・')}）`] : []), ...(found[id] ?? [])])];
    return `<tr><td><b>${esc(it.name)}</b></td><td>${esc(it.description)}</td><td>${it.price ? `${it.price}円` : '非売品'}</td><td><small>${esc(where.slice(0, 6).join('、'))}${where.length > 6 ? ' ほか' : ''}</small></td></tr>`;
  }).join('')}</tbody></table></div>
  <p class="note">お店の品ぞろえは 話が進むと増えます（いいきずぐすり・あかりランタンは ライバル戦のあと、げんきのかけらは ホタルノオウのあと、まんたんのくすりは 灯章5個から）。</p>`;
}
function chartSection(): string {
  const cell = (a: Element, d: Element) => {
    const v = effectiveness(a, [d]);
    return `<td class="${v > 1 ? 'x2' : v < 1 ? 'x05' : ''}">${v > 1 ? '◎' : v < 1 ? '△' : ''}</td>`;
  };
  return `<div class="tablewrap"><table class="t chart"><thead><tr><th>技＼受ける側</th>${ELEMENT_ORDER.map((d) => `<th>${chip(d)}</th>`).join('')}</tr></thead><tbody>${ELEMENT_ORDER.map((a) => `<tr><th>${chip(a)}</th>${ELEMENT_ORDER.map((d) => cell(a, d)).join('')}</tr>`).join('')}</tbody></table></div>
  <p class="note">◎＝2倍　△＝0.5倍　空欄＝1倍。0倍（まったく効かない）は ありません。属性が2つある灯獣には 倍率を かけ合わせます（◎◎なら4倍）。自分と同じ属性の技は 1.25倍。</p>
  <ul class="els">${ELEMENT_ORDER.map((e) => `<li>${chip(e)} ${esc(ELEMENTS[e].role)}</li>`).join('')}</ul>`;
}
function questsSection(): string {
  return `<div class="tablewrap"><table class="t"><thead><tr><th>クエスト</th><th>内容</th><th>報酬</th></tr></thead><tbody>${QUEST_ORDER.map((id) => {
    const q = QUESTS[id];
    const r = [q.reward.money ? `${q.reward.money}円` : '', q.reward.items ? itemList(q.reward.items) : ''].filter(Boolean).join('、');
    return `<tr><td><span class="tag ${q.kind}">${q.kind === 'main' ? 'メイン' : 'サブ'}</span> <b>${esc(q.name)}</b>${q.reportTo ? `<br><small>報告：${esc(q.reportTo)}</small>` : ''}</td><td>${esc(q.description)}</td><td>${r}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

// ───────────── ページ組み立て ─────────────
const legendSpecies = SPECIES_LIST.filter((s) => s.rarity === 'legend' || s.rarity === 'boss');
const starterLines = STARTERS.map((id) => {
  const a = sp(id);
  const b = sp(a.evolutions![0].to);
  const c = sp(b.evolutions![0].to);
  return `<li>${spLink(a.id)} → ${spLink(b.id)} → ${spLink(c.id)}<br><small>${a.elements.map(chip).join('')} ${esc(a.evolutions![0].hint)}。進化は Lv${(a.evolutions![0].condition as { level: number }).level}・Lv${(b.evolutions![0].condition as { level: number }).level}</small></li>`;
}).join('');

const NAV: [string, string][] = [
  ['start', 'はじめに'], ['chart', '攻略チャート'], ['starters', '最初の3匹'], ['legend', '伝説とボス'], ['second', '2周目'],
  ['dex', `図鑑${SPECIES_LIST.length}種`], ['moves', '技'], ['items', '道具'], ['types', '相性表'], ['quests', 'クエスト'], ['link', 'つうしん'], ['tips', 'コツ'],
];

const root = document.getElementById('guide')!;
root.innerHTML = `
<header class="hero"><div class="hero-in">
  <p class="kicker">ルミナリア・テイル ～灯獣の島～</p>
  <h1>完全攻略ガイド</h1>
  <p>ゲームの版 ${esc(__APP_VERSION__)}。このページの数字・出現表・トレーナー・図鑑は、ゲームのデータから自動で作っています。<b>ネタバレだらけ</b>なので注意！</p>
  <a class="play" href="./">▶ ゲームをあそぶ</a>
</div></header>
<nav class="nav">${NAV.map(([id, t]) => `<a href="#${id}">${t}</a>`).join('')}</nav>
<main>
<section id="start"><h2>はじめに</h2>
  <ul class="basics">
    <li><b>目的</b>：10の町のジムで「灯章」を10個集め、黒霞の洞窟の最奥にいる <b>トコヨノヤミ（Lv70）</b> を倒して 島に夜明けを取りもどす。</li>
    <li><b>なかま</b>：連れて歩けるのは ${PARTY_MAX}匹まで。それ以上は ボックス（灯の家の保管機）へ。レベルの上限は ${MAX_LEVEL}。</li>
    <li><b>操作</b>：十字キーで移動（画面のタップでも移動できる）、A で話す・調べる、B でもどる、START でメニュー。</li>
    <li><b>回復</b>：各町の灯の家（灯の泉・灯守）と、自分の家のお母さん。全滅すると 最後に回復した場所へ戻ります。</li>
    <li><b>セーブ</b>：START →「レポート」。ジムに勝った時などは自動でも保存されます。</li>
  </ul>
</section>

<section id="chart"><h2>攻略チャート</h2>
  <p class="note">地図の印：<span class="mk C">宝</span>宝箱　<span class="mk H">隠</span>見えない道具（その場所で A）　<span class="mk T">戦</span>トレーナー　<span class="mk G">戦</span>ジムリーダー・ボス　<span class="mk B">!</span>伝説・ボス　<span class="mk L">L</span>灯籠柱　草のしるし＝草むら（野生が出る）</p>
  ${stages.map((st, i) => `<div class="stage" id="stage-${i}">
    <h3>${esc(st.title)}</h3>
    <p class="story">${st.text.split('\n').join('<br>')}</p>
    ${st.maps.map(mapBlock).join('')}
    ${st.gym ? gymBlock(st.gym) : ''}
  </div>`).join('')}
</section>

<section id="starters"><h2>最初の3匹</h2>
  <ul class="list">${starterLines}</ul>
  <p>3匹は <b>野生には出ません</b>。研究所で1匹えらび、残りの2匹は次の順でもらえます（えらばなかった2匹のうち、図鑑番号の若い方から）。</p>
  <ol><li>ほたる森の主 ホタルノオウを倒した時（Lv12）</li><li>ジム3 しおさい港の ナギサに 初めて勝った時（Lv20）</li></ol>
  <p class="note">ほむら は めぶき に、めぶき は しお に、しお は ほむら に強い三すくみ。ライバルのカイトは こちらに有利な1匹を選んできます。</p>
</section>

<section id="legend"><h2>伝説とボス</h2>
  <div class="cards">${legendSpecies.map(dexCard).join('')}</div>
  <ul class="list">
    <li><b>チョンボ</b>：あけぼの神殿町（ジム8）の北、たそがれ街道の古い松の前にいます。Lv45。捕まえにくいですが 捕まえられます。負けても 逃げても また戦えます。専用技「かたくなる」は 使ったターンから3ターン こちらの技を受けつけないので、その間は 回復や 能力アップの時間にしましょう。HPを赤まで削ってから たいようランタン・ほしのランタン を投げるのが おすすめ。</li>
    <li><b>ボッキー</b>：チョンボに <b>ローション</b>（さいはて諸島 しろなみ港の道具屋・100,000ルクス）を使うと進化します。専用技「<b>がまん</b>」は 1ターン目は動かずに力をため、2ターン目に 威力300 の攻撃をします（命中50%・2ターン目は交代できません）。</li>
    <li><b>ホタルノオウ</b>（第1章のボス）・<b>トコヨノヤミ</b>（ラスボス）・<b>ハテノヌシ</b>（さいはての灯台・Lv100）は 捕まえられません。</li>
  </ul>
</section>

<section id="second"><h2>2周目（クリア後）</h2>
  <p>トコヨノヤミを倒したあと、各ジムのリーダーに話すと <b>本気のチーム（Lv70〜90）</b> で再戦できます。初めて勝つと「きらめく灯章」と ほしのランタン などがもらえ、何度でも挑戦できます。きらめく灯章が10個そろうと 2回目のトコヨノヤミが現れ、倒すと <b>さいはて諸島</b> へ行けます（→ <a href="#chart">攻略チャート</a> の後半）。各ジムの2周目のチームは <a href="#chart">攻略チャート</a> の各ジムに書いてあります。</p>
  <div class="tablewrap"><table class="t"><thead><tr><th>ジム</th><th>町</th><th>リーダー</th><th>1周目 最高Lv</th><th>2周目 最高Lv</th></tr></thead><tbody>${GYMS.map((g) => `<tr><td>${g.n}</td><td>${esc(g.townName)}</td><td>${esc(g.leader)}</td><td>${g.ace}</td><td>${g.rematchAce}</td></tr>`).join('')}</tbody></table></div>
</section>

<section id="dex"><h2>図鑑（${SPECIES_LIST.length}種）</h2>
  <div class="filter"><input id="q" type="search" placeholder="名前でさがす（例：チョンボ）"><div class="elf"><button data-el="" class="on">すべて</button>${ELEMENT_ORDER.map((e) => `<button data-el="${e}" style="--c:${ELEMENTS[e].color}">${ELEMENTS[e].name}</button>`).join('')}</div></div>
  <div class="cards" id="dexlist">${SPECIES_LIST.map(dexCard).join('')}</div>
</section>

<section id="moves"><h2>技</h2>${movesSection()}</section>
<section id="items"><h2>道具</h2>${itemsSection()}</section>
<section id="types"><h2>属性の相性表</h2>${chartSection()}</section>
<section id="quests"><h2>クエスト</h2>${questsSection()}</section>

<section id="link"><h2>つうしん（QRコードで 友だちと遊ぶ）</h2>
  <p>START →「つうしん」。サーバーもアカウントも使いません。</p>
  <ul class="list">
    <li><b>直接たいせん</b>：へやを作る人が QR を見せ、相手が読んで「へんじのQR」を出し、作った人がそれを読むと つながります。<b>同じ Wi‑Fi</b> だと確実です。外でつなぐ時は「インターネットごしに つなぐ」にチェック（つながらない回線もあります）。</li>
    <li><b>こうかん</b>：同じつなぎ方で 1匹ずつ交換。両方が「こうかんする」を押すと成立します。パーティーの最後の1匹は出せません。</li>
    <li><b>QRチームたいせん</b>：友だちのチームのQRを読むと、そのチームと コンピューターが戦ってくれます。</li>
    <li>たいせんでは 経験値・お金・道具は変わりません（全回復した状態で戦います）。</li>
    <li>LINE の中で開くと カメラが使えないことがあります。Safari などで開き直すか、「しゃしんから よみとる」「コードを はりつける」を使ってください。</li>
  </ul>
</section>

<section id="tips"><h2>攻略のコツ</h2>
  <ul class="list">
    <li><b>相性がいちばん大事</b>。弱点を突けば2倍、自分と同じ属性の技はさらに1.25倍。ジムの前は 相手の属性に強い灯獣を育てておきましょう。</li>
    <li><b>捕まえ方</b>：HPを減らすほど、まひ・ねむりにするほど捕まえやすい。ランタンは ともしび → あかり → たいよう → ほしの順に強力。</li>
    <li><b>レベル上げ</b>：トレーナー戦は経験値1.4倍。自分より強い相手ほど多くもらえます。各道のトレーナーは 一度ずつしか戦えないので、そのあとは 草むらで。</li>
    <li><b>フワモは3通りに進化</b>：あかつきの石（モコ探しの報酬）でヒカリワタ、ほたる森で Lv16 以上でカゲワタ、「つむじかぜ」を覚えたまま Lv16 以上でカゼワタ。</li>
    <li><b>灯の渡し舟</b>：一度行った町なら すぐ移動できます。2周目の再戦めぐりに便利。</li>
    <li><b>お金</b>：トレーナーの賞金はジムリーダーが特に多め。いらない道具は お店で半額で売れます。</li>
  </ul>
</section>
</main>
<footer>ルミナリア・テイル 完全攻略ガイド ／ 灯獣の絵は ゲーム内と同じ仮の絵です</footer>`;

// 図鑑のしぼりこみ
const q = document.getElementById('q') as HTMLInputElement;
let el = '';
const apply = () => {
  const word = q.value.trim();
  document.querySelectorAll<HTMLElement>('#dexlist .dex').forEach((c) => {
    const ok = (!word || (c.dataset.name ?? '').includes(word)) && (!el || (c.dataset.el ?? '').split(' ').includes(el));
    c.style.display = ok ? '' : 'none';
  });
};
q.addEventListener('input', apply);
document.querySelectorAll<HTMLButtonElement>('.elf button').forEach((b) =>
  b.addEventListener('click', () => {
    el = b.dataset.el ?? '';
    document.querySelectorAll('.elf button').forEach((x) => x.classList.toggle('on', x === b));
    apply();
  }),
);
