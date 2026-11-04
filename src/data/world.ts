/**
 * 2つ目の町から先の世界：10の町・道・ジム・黒霞の洞窟。
 * 町と道は同じ型から作り、名前・色・野生の灯獣・トレーナーだけを町ごとに変える。
 *
 * 流れ（2026-11-05 本人決定）
 *  ひだまり村[ジム1] → そよかぜ草原 → ほたる森（ホタルノオウ）→ こもれび街道 → こもれび町[ジム2] → … → ルミナリア都[ジム10]
 *  → 10個の灯章がそろうと、都の北の黒霞が晴れて「黒霞の洞窟」へ → 最奥のトコヨノヤミ（Lv70）
 *  → ボスを倒した後は、各ジムのリーダーが本気のチーム（Lv72〜90）で再戦してくれる（2周目）
 *  伝説のチョンボ（Lv45）は、あけぼの神殿町（ジム8・手持ちがLv50前後になるころ）のすぐ北、たそがれ街道の古い松に出る。
 */
import type { Element, Facing } from '../core/types';
import type { EncounterEntry, MapDef, NpcDef, ObjectDef } from './maps';
import type { Cmd } from './scripts';
import type { TrainerDef } from './trainers';

type Palette = MapDef['palette'];
type Look = NpcDef['look'];

export interface GymDef {
  n: number;
  townId: string;
  townName: string;
  element: Element | 'mixed';
  leader: string;
  badge: string;
  /** 1周目のリーダーの最高レベル */
  ace: number;
  /** 2周目（ボスを倒した後）のリーダーの最高レベル */
  rematchAce: number;
  reward: [string, number][];
  rematchReward: [string, number][];
}

export const WORLD_MAPS: MapDef[] = [];
export const WORLD_TRAINERS: TrainerDef[] = [];
export const WORLD_SCRIPTS: Record<string, Cmd[]> = {};
export const GYMS: GymDef[] = [];

const ELEMENT_NAME: Record<Element | 'mixed', string> = {
  neutral: 'ふつう', blaze: 'ほむら', tide: 'しお', sprout: 'めぶき', volt: 'いかずち', stone: 'いわお', gale: 'はやて', shine: 'ひかり', shade: 'かげ', mixed: 'すべての属性',
};

const GYM_PALETTE: Record<Element | 'mixed', Palette> = {
  neutral: { ground: '#e6dcc8', path: '#d6c8ae', grass: '#d6c8ae', tree: '#8a7a64', accent: '#f6d47a' },
  sprout: { ground: '#cfe6b8', path: '#b8d49e', grass: '#b8d49e', tree: '#4a7a3a', accent: '#9ae07a' },
  tide: { ground: '#c8e2f4', path: '#a8cce8', grass: '#a8cce8', tree: '#3a6a9a', accent: '#7fd1e8' },
  blaze: { ground: '#f2d0b0', path: '#e6b48a', grass: '#e6b48a', tree: '#9a4a2a', accent: '#ff9a4a' },
  volt: { ground: '#f4ecb8', path: '#e6da8a', grass: '#e6da8a', tree: '#6a6a3a', accent: '#ffe03a' },
  stone: { ground: '#d8ccb8', path: '#c4b498', grass: '#c4b498', tree: '#6e5a44', accent: '#c8a87a' },
  gale: { ground: '#d8f0ec', path: '#bce0da', grass: '#bce0da', tree: '#3a8a7a', accent: '#a8f0e0' },
  shine: { ground: '#fbf4dc', path: '#f0e4b8', grass: '#f0e4b8', tree: '#b8943a', accent: '#fff2a0' },
  shade: { ground: '#5a5070', path: '#4a4060', grass: '#4a4060', tree: '#2a2038', accent: '#b08ae0' },
  mixed: { ground: '#e8e0f4', path: '#d4c8e8', grass: '#d4c8e8', tree: '#6a5a9a', accent: '#ffd27a' },
};

const person = (body: string, hair: string): Look => ({ body, hair, kind: 'person' });
const grunt: Look = { body: '#2b2740', hair: '#5a4a8a', kind: 'grunt' };

/** 文字の地図から、幅がそろっているか確かめて MapDef を作る */
function checkTiles(id: string, tiles: string[]): string[] {
  const w = tiles[0].length;
  tiles.forEach((row, i) => {
    if (row.length !== w) throw new Error(`map ${id}: row ${i} width ${row.length} != ${w}`);
  });
  return tiles;
}

/** 決まった順に同じ値を返す乱数（地図の飾りの配置用） */
function seeded(seed: number): () => number {
  let a = seed * 9301 + 49297;
  return () => {
    a = (a * 9301 + 49297) % 233280;
    return a / 233280;
  };
}

// ───────────────────────── 道（町と町のあいだ） ─────────────────────────
interface RouteSpec {
  id: string;
  name: string;
  seed: number;
  palette: Palette;
  min: number;
  max: number;
  table: [string, number][];
  trainers: { id: string; name: string; title: string; look: Look; party: [string, number][]; intro: string; defeat: string; after: string }[];
  chest: [string, number];
  hidden: [string, number];
  /** 南（来た方）と北（行く先）の行き先 */
  south: { mapId: string; x: number; y: number };
  north: { mapId: string; x: number; y: number };
  extraNpcs?: NpcDef[];
  extraObjects?: ObjectDef[];
  sign: string;
  bgm?: MapDef['bgm'];
  kind?: MapDef['kind'];
  /** 草むらの代わりに使う壁（洞窟は岩） */
  wall?: string;
  /** 手前で空けておくマス（伝説の灯獣の場所など） */
  keepClear?: [number, number][];
}

const RW = 20;
const RH = 30;

function makeRoute(r: RouteSpec): MapDef {
  const rnd = seeded(r.seed);
  const wall = r.wall ?? 'T';
  const g: string[][] = Array.from({ length: RH }, (_, y) => Array.from({ length: RW }, (_, x) => (x === 0 || x === RW - 1 || y === 0 || y === RH - 1 ? wall : '.')));
  const pick = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
  const side = () => (rnd() < 0.5 ? pick(1, 6) : pick(13, 18));
  const set = (x: number, y: number, c: string) => {
    if (x > 0 && x < RW - 1 && y > 0 && y < RH - 1) g[y][x] = c;
  };
  // 草むら
  for (let k = 0; k < 7; k++) {
    const left = k % 2 === 0;
    const w = pick(3, 5);
    const h = pick(2, 4);
    const x0 = left ? pick(1, 7 - w) : pick(12, 18 - w + 1);
    const y0 = pick(2, RH - 6);
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, '"');
  }
  // 道をまたぐ草むら（ここは必ず通る）
  const band = pick(12, 16);
  for (let y = band; y < band + 2; y++) for (let x = 3; x <= 16; x++) set(x, y, '"');
  // 木・岩・花・池
  for (let k = 0; k < 6; k++) {
    const x = side();
    const y = pick(2, RH - 4);
    set(x, y, wall);
    if (rnd() < 0.6) set(x + (x < 9 ? 1 : -1), y, wall);
    if (rnd() < 0.5) set(x, y + 1, wall);
  }
  for (let k = 0; k < 4; k++) set(side(), pick(2, RH - 3), wall === 'R' ? 'R' : 'R');
  if (wall === 'T') {
    for (let k = 0; k < 7; k++) set(side(), pick(2, RH - 3), 'f');
    if (rnd() < 0.6) {
      const x0 = rnd() < 0.5 ? 2 : 14;
      const y0 = pick(3, RH - 8);
      for (let y = y0; y < y0 + 3; y++) for (let x = x0; x < x0 + 4; x++) set(x, y, '~');
    }
  }
  // 真ん中の道
  for (let y = 0; y < RH; y++) {
    if (y >= band && y < band + 2) continue;
    g[y][9] = ',';
    g[y][10] = ',';
  }
  // トレーナーの立ち位置と視線
  const tPos: [number, number, Facing][] = [
    [7, 8, 'right'],
    [12, 21, 'left'],
    [7, 25, 'right'],
  ];
  r.trainers.forEach((_, i) => {
    const [x, y] = tPos[i];
    for (let k = Math.min(x, 9); k <= Math.max(x, 10); k++) if (g[y][k] !== ',') g[y][k] = '.';
  });
  // 入口の近くはひらけた場所にする
  for (const y of [1, 2, RH - 2, RH - 3]) for (let x = 7; x <= 12; x++) if (g[y][x] !== ',') g[y][x] = '.';
  for (const [x, y] of r.keepClear ?? []) {
    set(x, y, '.');
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== ',') set(x + dx, y + dy, '.');
  }
  // 看板・宝箱・隠しアイテムは、入口から歩いて行ける場所にだけ置く
  g[RH - 3][8] = 'S';
  const walk = (c: string) => '.,"f'.includes(c);
  const reach = new Set<string>();
  const queue: [number, number][] = [[9, RH - 2]];
  while (queue.length) {
    const [x, y] = queue.pop()!;
    const k = `${x},${y}`;
    if (reach.has(k) || !walk(g[y]?.[x] ?? 'T')) continue;
    reach.add(k);
    queue.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
  const spots = [...reach].map((k) => k.split(',').map(Number) as [number, number]).filter(([x, y]) => (x < 7 || x > 12) && y > 2 && y < RH - 4 && !(r.keepClear ?? []).some(([cx, cy]) => Math.abs(cx - x) + Math.abs(cy - y) <= 1));
  const pickSpot = (): [number, number] => spots.splice(Math.floor(rnd() * spots.length), 1)[0];
  // 宝箱は、まわりの2マス以上が歩ける場所に置く（行き止まりをふさがない）
  let chestX = 1;
  let chestY = 5;
  for (let tries = 0; tries < 50; tries++) {
    const [x, y] = pickSpot();
    const open = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => reach.has(`${x + dx},${y + dy}`)).length;
    if (open <= 2) {
      chestX = x;
      chestY = y;
      break;
    }
  }
  g[chestY][chestX] = 'C';
  const [hidX, hidY] = pickSpot();
  // 出入口
  g[0][9] = ',';
  g[0][10] = ',';
  g[RH - 1][9] = ',';
  g[RH - 1][10] = ',';
  const tiles = checkTiles(r.id, g.map((row) => row.join('')));

  const npcs: NpcDef[] = r.trainers.map((t, i) => {
    const [x, y, facing] = tPos[i];
    WORLD_TRAINERS.push({ id: t.id, name: t.name, title: t.title, party: t.party.map(([speciesId, level]) => ({ speciesId, level })), reward: Math.max(...t.party.map((p) => p[1])) * 60, intro: t.intro, defeat: t.defeat, smart: Math.min(0.7, 0.45 + 0.05 * r.seed) });
    WORLD_SCRIPTS[`${t.id}_after`] = [{ who: t.name, say: t.after }];
    return { id: `npc_${t.id}`, name: `${t.title}の${t.name}`, x, y, facing, look: t.look, trainerId: t.id, sight: 3, talk: [{ if: { defeated: t.id }, script: `${t.id}_after` }, { script: 'trainer_generic' }] };
  });
  const span = r.max - r.min;
  return {
    id: r.id,
    name: r.name,
    kind: r.kind ?? 'field',
    bgm: r.bgm ?? 'field',
    palette: r.palette,
    tiles,
    warps: [
      { x: 9, y: RH - 1, to: { mapId: r.south.mapId, x: r.south.x, y: r.south.y, facing: 'down' } },
      { x: 10, y: RH - 1, to: { mapId: r.south.mapId, x: r.south.x + 1, y: r.south.y, facing: 'down' } },
      { x: 9, y: 0, to: { mapId: r.north.mapId, x: r.north.x, y: r.north.y, facing: 'up' } },
      { x: 10, y: 0, to: { mapId: r.north.mapId, x: r.north.x + 1, y: r.north.y, facing: 'up' } },
    ],
    encounters: {
      rate: 11,
      table: r.table.map(([speciesId, weight], i): EncounterEntry => ({ speciesId, weight, minLevel: r.min + (i % 2), maxLevel: Math.min(r.max, r.min + span - ((i + 1) % 2)) })),
    },
    npcs: [...npcs, ...(r.extraNpcs ?? [])],
    objects: [
      { id: `sign_${r.id}`, x: 8, y: RH - 3, kind: 'sign', text: r.sign },
      { id: `chest_${r.id}`, x: chestX, y: chestY, kind: 'chest', item: r.chest },
      { id: `hidden_${r.id}`, x: hidX, y: hidY, kind: 'hidden', item: r.hidden },
      ...(r.extraObjects ?? []),
    ],
  };
}

// ───────────────────────── 町 ─────────────────────────
interface TownSpec {
  n: number;
  id: string;
  name: string;
  palette: Palette;
  element: Element | 'mixed';
  leader: string;
  leaderLook: Look;
  leaderTitle: string;
  badge: string;
  team: [string, number][];
  rematch: [string, number][];
  gymTrainers: { name: string; title: string; look: Look; party: [string, number][] }[];
  reward: [string, number][];
  rematchReward: [string, number][];
  intro: string;
  defeat: string;
  townsfolk: { name: string; look: Look; lines: string[] }[];
  south: { mapId: string; x: number; y: number };
  north?: { mapId: string; x: number; y: number };
  /** 北の出口を黒霞でふさぐ（灯章が10個そろうまで） */
  sealedNorth?: boolean;
}

/** 町の地図（幅20・高さ16）。左上が灯の家、右上がジム */
const TOWN_TILES = [
  'TTTTTTTTT,,TTTTTTTTT',
  'T........,,........T',
  'T.=====..,,..=====.T',
  'T.=====..,,..=====.T',
  'T.##D##..,,..##D##.T',
  'T........,,........T',
  'T..f.....,,....S...T',
  'T,,,,,,,,,,,,,,,,,,T',
  'T........,,........T',
  'T.====...,,...====.T',
  'T.####...,,...####.T',
  'T........,,........T',
  'T..f.....,,.....f..T',
  'T........,,........T',
  'T........,,........T',
  'TTTTTTTTT,,TTTTTTTTT',
];

function centerMap(townId: string, townName: string, door: { x: number; y: number }, shop: string): MapDef {
  return {
    id: `${townId}_center`,
    name: `${townName}の 灯の家`,
    kind: 'indoor',
    bgm: 'indoor',
    palette: { ground: '#f0dcc0', path: '#e0c7a5', grass: '#e0c7a5', tree: '#a5734a', accent: '#ffcf6b' },
    tiles: checkTiles(`${townId}_center`, ['WWWWWWWWWW', 'W_P____K_W', 'W________W', 'W________W', 'W________W', 'W________W', 'W________W', 'WWWWDWWWWW']),
    warps: [{ x: 4, y: 7, to: { mapId: townId, x: door.x, y: door.y + 1, facing: 'down' } }],
    npcs: [
      { id: `${townId}_healer`, name: '灯守', x: 2, y: 2, facing: 'down', look: person('#f0a2b5', '#7a3b5a'), talk: [{ script: 'healer' }] },
      { id: `${townId}_shop`, name: '道具屋', x: 6, y: 2, facing: 'down', look: person('#6b8fd1', '#2a2a2a'), talk: [{ script: shop }] },
      { id: `${townId}_ferry`, name: '灯の渡し守', x: 7, y: 5, facing: 'left', look: person('#3a6a8a', '#d8d8d8'), talk: [{ script: 'ferry' }] },
    ],
    objects: [
      { id: `${townId}_spring`, x: 2, y: 1, kind: 'heal', text: '灯の泉に手をかざすと、なかまの灯が あたたかく ともった。' },
      { id: `${townId}_box`, x: 7, y: 1, kind: 'box' },
    ],
  };
}

/** ジムの中（幅11・高さ14）。入口から奥のリーダーまで、途中にトレーナーが2人 */
function gymMap(t: { n: number; townId: string; townName: string; element: Element | 'mixed'; leader: string; leaderLook: Look; door: { x: number; y: number }; trainers: TownSpec['gymTrainers'] }): MapDef {
  const id = `${t.townId}_gym`;
  const npcs: NpcDef[] = [
    { id: `gym${t.n}_leader`, name: `ジムリーダーの${t.leader}`, x: 5, y: 2, facing: 'down', look: t.leaderLook, talk: [{ script: `gym${t.n}` }] },
  ];
  const pos: [number, number, Facing][] = [
    [8, 9, 'left'],
    [2, 5, 'right'],
  ];
  t.trainers.forEach((tr, i) => {
    const tid = `gym${t.n}_t${i + 1}`;
    const [x, y, facing] = pos[i];
    WORLD_TRAINERS.push({ id: tid, name: tr.name, title: tr.title, party: tr.party.map(([speciesId, level]) => ({ speciesId, level })), reward: Math.max(...tr.party.map((p) => p[1])) * 70, intro: `${t.leader}さんに 挑むなら、まず わたしを たおしてから！`, defeat: 'リーダーは もっと強いよ……！', smart: Math.min(0.75, 0.5 + 0.05 * t.n) });
    WORLD_SCRIPTS[`${tid}_after`] = [{ who: tr.name, say: `${t.leader}さんは ${ELEMENT_NAME[t.element]}の 使い手。弱点を つく灯獣を 連れていこう。` }];
    npcs.push({ id: `npc_${tid}`, name: `${tr.title}の${tr.name}`, x, y, facing, look: tr.look, trainerId: tid, sight: 3, talk: [{ if: { defeated: tid }, script: `${tid}_after` }, { script: 'trainer_generic' }] });
  });
  return {
    id,
    name: `${t.townName}ジム`,
    kind: 'indoor',
    bgm: 'indoor',
    palette: GYM_PALETTE[t.element],
    tiles: checkTiles(id, [
      'WWWWWWWWWWW',
      'W___O_O___W',
      'W_________W',
      'W_________W',
      'W__W___W__W',
      'W_________W',
      'W__W___W__W',
      'W_________W',
      'W_________W',
      'W__W___W__W',
      'W_________W',
      'W_________W',
      'W_________W',
      'WWWWWDWWWWW',
    ]),
    warps: [{ x: 5, y: 13, to: { mapId: t.townId, x: t.door.x, y: t.door.y + 1, facing: 'down' } }],
    npcs,
    objects: [{ id: `${id}_sign`, x: 4, y: 1, kind: 'sign', text: `${t.townName}ジム\nリーダー：${t.leader}\n${ELEMENT_NAME[t.element]}の 灯獣の 使い手` }],
  };
}

function gymScripts(t: { n: number; leader: string; intro: string; defeat: string; badge: string; next: string }): void {
  WORLD_SCRIPTS[`gym${t.n}`] = [{ gym: t.n }];
  WORLD_SCRIPTS[`gym${t.n}_hello`] = [{ who: t.leader, say: t.intro }];
  WORLD_SCRIPTS[`gym${t.n}_after`] = [{ who: t.leader, say: t.next }];
}

/** ジムのデータ（リーダー・灯章・報酬）を登録する */
function registerGym(t: TownSpec | (Omit<TownSpec, 'id' | 'name' | 'palette' | 'townsfolk' | 'south'> & { id: string; name: string }), next: string): void {
  WORLD_TRAINERS.push(
    { id: `gym${t.n}`, name: t.leader, title: t.leaderTitle, party: t.team.map(([speciesId, level]) => ({ speciesId, level })), reward: Math.max(...t.team.map((p) => p[1])) * 100, intro: t.intro, defeat: t.defeat, bgm: 'boss', smart: Math.min(0.85, 0.55 + 0.05 * t.n) },
    { id: `gym${t.n}_r`, name: t.leader, title: `${t.leaderTitle}（本気）`, party: t.rematch.map(([speciesId, level]) => ({ speciesId, level })), reward: Math.max(...t.rematch.map((p) => p[1])) * 120, intro: 'ここからは 本気の勝負だ。トコヨノヤミを 鎮めた 灯守の力、見せてもらう！', defeat: 'まいった。きみこそ ほんとうの 灯守だ。', bgm: 'boss', smart: 0.95 },
  );
  GYMS.push({
    n: t.n,
    townId: t.id,
    townName: t.name,
    element: t.element,
    leader: t.leader,
    badge: t.badge,
    ace: Math.max(...t.team.map((p) => p[1])),
    rematchAce: Math.max(...t.rematch.map((p) => p[1])),
    reward: t.reward,
    rematchReward: t.rematchReward,
  });
  gymScripts({ n: t.n, leader: t.leader, intro: t.intro, defeat: t.defeat, badge: t.badge, next });
}

function makeTown(t: TownSpec, next: string): MapDef[] {
  registerGym(t, next);
  const centerDoor = { x: 4, y: 4 };
  const gymDoor = { x: 15, y: 4 };
  const tiles = [...TOWN_TILES];
  if (t.sealedNorth) tiles[1] = 'T........XX........T';
  if (!t.north) tiles[0] = 'TTTTTTTTTTTTTTTTTTTT';
  const npcs: NpcDef[] = t.townsfolk.map((f, i) => {
    const sid = `${t.id}_folk${i}`;
    WORLD_SCRIPTS[sid] = f.lines.map((say) => ({ who: f.name, say }));
    const spots: [number, number, Facing][] = [
      [6, 8, 'right'],
      [13, 11, 'left'],
      [4, 13, 'up'],
    ];
    const [x, y, facing] = spots[i];
    return { id: sid, name: f.name, x, y, facing, look: f.look, talk: [{ script: sid }] };
  });
  WORLD_SCRIPTS[`visit_${t.id}`] = [{ setFlag: `visited_${t.id}` }];
  const town: MapDef = {
    id: t.id,
    name: t.name,
    kind: 'town',
    bgm: 'town',
    palette: t.palette,
    tiles: checkTiles(t.id, tiles),
    barrierFlag: t.sealedNorth ? 'all_badges' : undefined,
    warps: [
      { x: centerDoor.x, y: centerDoor.y, to: { mapId: `${t.id}_center`, x: 4, y: 6, facing: 'up' } },
      { x: gymDoor.x, y: gymDoor.y, to: { mapId: `${t.id}_gym`, x: 5, y: 12, facing: 'up' } },
      { x: 9, y: 15, to: { mapId: t.south.mapId, x: t.south.x, y: t.south.y, facing: 'down' } },
      { x: 10, y: 15, to: { mapId: t.south.mapId, x: t.south.x + 1, y: t.south.y, facing: 'down' } },
      ...(t.north
        ? [
            { x: 9, y: 0, to: { mapId: t.north.mapId, x: t.north.x, y: t.north.y, facing: 'up' as Facing } },
            { x: 10, y: 0, to: { mapId: t.north.mapId, x: t.north.x + 1, y: t.north.y, facing: 'up' as Facing } },
          ]
        : []),
    ],
    npcs,
    objects: [
      {
        id: `sign_${t.id}`,
        x: 15,
        y: 6,
        kind: 'sign',
        text: `${t.name}\n右上：${t.name}ジム（${ELEMENT_NAME[t.element]}）\n左上：灯の家（回復・買い物・渡し舟）${t.sealedNorth ? '\n北：黒霞の洞窟（灯章が10個そろうと 道がひらく）' : ''}`,
      },
    ],
    onEnter: [{ if: { notFlag: `visited_${t.id}` }, script: `visit_${t.id}` }],
  };
  return [town, centerMap(t.id, t.name, centerDoor, 'shop_town'), gymMap({ n: t.n, townId: t.id, townName: t.name, element: t.element, leader: t.leader, leaderLook: t.leaderLook, door: gymDoor, trainers: t.gymTrainers })];
}

// ───────────────────────── ここから世界のデータ ─────────────────────────
const P = {
  komorebi: { ground: '#a8d48a', path: '#e2cf9e', grass: '#5aa84e', tree: '#2f7a40', accent: '#f6e08a' },
  shio: { ground: '#d8e8c8', path: '#efe0b8', grass: '#6ab06a', tree: '#3a7a5a', accent: '#8ad0f0' },
  yuke: { ground: '#c8b89a', path: '#e0c8a0', grass: '#8aa060', tree: '#5a6a3a', accent: '#ff9a5a' },
  kami: { ground: '#d4d8a0', path: '#e8dca0', grass: '#9ab84a', tree: '#4a6a3a', accent: '#ffe04a' },
  ishi: { ground: '#c8c0b0', path: '#d8ccb4', grass: '#8a9a6a', tree: '#4a5a4a', accent: '#c8a87a' },
  soyo: { ground: '#bce4b0', path: '#e6dcb0', grass: '#6ac08a', tree: '#3a8a6a', accent: '#c8f8e8' },
  asa: { ground: '#e4ecd8', path: '#f0e8c8', grass: '#9ac88a', tree: '#6a8a6a', accent: '#fff4b0' },
  taso: { ground: '#a89aa8', path: '#c8b498', grass: '#6a6a8a', tree: '#3a3050', accent: '#e8a0c8' },
  hoshi: { ground: '#8a9ac0', path: '#c8c0d8', grass: '#5a7aa8', tree: '#2a3a6a', accent: '#f0f0a0' },
  cave: { ground: '#3a3348', path: '#4a4258', grass: '#2a2238', tree: '#1a1424', accent: '#9a6ae0' },
};

const TOWNS: (Omit<TownSpec, 'south' | 'north' | 'n'> & { route: Omit<RouteSpec, 'south' | 'north' | 'id'> & { id: string } })[] = [
  {
    id: 'komorebi_town', name: 'こもれび町', palette: { ground: '#b4dc94', path: '#e6d4a4', grass: '#5aa84e', tree: '#2f7a40', accent: '#f6e08a' },
    element: 'sprout', leader: 'モリヤ', leaderTitle: 'ジムリーダー', leaderLook: person('#4a8a3a', '#2a4a1a'), badge: 'こもれびの灯章',
    team: [['happamushi', 15], ['kokejika', 16], ['tsubomin', 16], ['morinonushi', 18]],
    rematch: [['midoriageha', 70], ['morijika', 71], ['hanakaguya', 72], ['jukaiou', 74]],
    gymTrainers: [{ name: 'サナエ', title: '庭師', look: person('#6aa84a', '#5a3a1a'), party: [['tsubomin', 14], ['happamushi', 14]] }, { name: 'ノボル', title: '木こり', look: person('#8a5a3a', '#2a1a0a'), party: [['kokejika', 15]] }],
    reward: [['super_potion', 3], ['bright_lantern', 3]], rematchReward: [['max_potion', 3], ['star_lantern', 1]],
    intro: '木もれ日の下で 育った灯獣は、しなやかで 強いよ。根っこの強さを 見せてあげる！', defeat: 'ふふ、根こそぎ やられちゃった。こもれびの灯章を どうぞ。',
    townsfolk: [
      { name: '花売りの子', look: person('#f0a0c0', '#c86a3a'), lines: ['ジムリーダーの モリヤさんは めぶきの 使い手。ほむらや はやての技が よく効くよ。'] },
      { name: '旅のおじさん', look: person('#8a7a5a', '#4a4a4a'), lines: ['この島には 10の町と 10のジムが あるんだ。灯章を ぜんぶ集めた 灯守は、北の 黒霞の洞窟に 入れるらしい。'] },
    ],
    route: {
      id: 'komorebi_road', name: 'こもれび街道', seed: 2, palette: P.komorebi, min: 12, max: 16, chest: ['super_potion', 2], hidden: ['bright_lantern', 2],
      table: [['mofurin', 20], ['piyoka', 18], ['chunta', 18], ['happamushi', 16], ['tsubomin', 14], ['munyu', 12], ['kokejika', 12]],
      sign: 'こもれび街道\n北：こもれび町\n南：ほたる森',
      trainers: [
        { id: 'r2_kazu', name: 'カズ', title: '虫とり少年', look: person('#e0b03a', '#3a2a1a'), party: [['happamushi', 13], ['happamushi', 14]], intro: '虫あみの 準備は ばっちり！ 勝負だ！', defeat: 'ぼくの ハッパムシが……！', after: 'ハッパムシは 進化すると きれいな チョウになるんだ。' },
        { id: 'r2_mina', name: 'ミナ', title: '旅芸人', look: person('#c86ad0', '#f0d0a0'), party: [['munyu', 14], ['chunta', 15]], intro: 'さあさあ お立ち会い！ わたしの灯獣の 芸を 見ていって！', defeat: 'お代は けっこう！ あなたの勝ち！', after: 'ムニュは もちもちで、なかなか たおれないのよ。' },
      ],
    },
  },
  {
    id: 'shiosai_port', name: 'しおさい港', palette: { ground: '#e0e8d0', path: '#f0e2bc', grass: '#6ab06a', tree: '#3a7a5a', accent: '#8ad0f0' },
    element: 'tide', leader: 'ナギサ', leaderTitle: 'ジムリーダー', leaderLook: person('#3a8ad0', '#1a3a6a'), badge: 'しおさいの灯章',
    team: [['pururu', 21], ['shiogame', 22], ['minamodra', 23], ['namikiba', 24]],
    rematch: [['pururine', 72], ['genbukai', 73], ['uzushiodra', 74], ['watatsumiba', 76]],
    gymTrainers: [{ name: 'カイ', title: '船乗り', look: person('#2a5a9a', '#1a1a1a'), party: [['pukuri', 20], ['unari', 20]] }, { name: 'ミサキ', title: '海女', look: person('#5ab0d0', '#2a1a1a'), party: [['pururu', 21]] }],
    reward: [['super_potion', 3], ['revive_shard', 2]], rematchReward: [['max_potion', 3], ['star_lantern', 1]],
    intro: '潮の満ち引きは だれにも 止められない。わたしの灯獣の 波に のまれないでね！', defeat: '波が 引いていく……。しおさいの灯章よ、受け取って。',
    townsfolk: [
      { name: '港の漁師', look: person('#4a6a8a', '#3a3a3a'), lines: ['ナギサさんの 灯獣は しお属性。いかずちや めぶきの技で 攻めるといい。'] },
      { name: '灯台守', look: person('#d0d0d0', '#8a8a8a'), lines: ['灯の家の 渡し守に たのめば、一度 行った町へ すぐに 行けるぞ。'] },
    ],
    route: {
      id: 'shiokaze_road', name: 'しおかぜ街道', seed: 3, palette: P.shio, min: 17, max: 21, chest: ['revive_shard', 1], hidden: ['super_potion', 2],
      table: [['pukuri', 22], ['pururu', 18], ['shiogame', 14], ['unari', 14], ['hoshiuo', 12], ['katatsumu', 20]],
      sign: 'しおかぜ街道\n北：しおさい港\n南：こもれび町',
      trainers: [
        { id: 'r3_taro', name: 'タロウ', title: '釣り人', look: person('#4f7a8f', '#444444'), party: [['pukuri', 18], ['unari', 19]], intro: '大物の 灯獣で 勝負だ！', defeat: 'にがした魚は 大きかった……。', after: 'プクリは 進化すると キバの するどい魚になる。' },
        { id: 'r3_sayo', name: 'サヨ', title: '海女', look: person('#5ab0d0', '#2a1a1a'), party: [['pururu', 19], ['shiogame', 20]], intro: '海の中で きたえた 灯獣よ！', defeat: 'ぷはっ、負けちゃった。', after: 'シオガメは 進化すると 甲らに 木が 生えるくらい 大きくなるの。' },
      ],
    },
  },
  {
    id: 'yunoka_spa', name: 'ゆのか温泉郷', palette: { ground: '#d8c8a8', path: '#ecd8b0', grass: '#8aa060', tree: '#5a6a3a', accent: '#ff9a5a' },
    element: 'blaze', leader: 'カエン', leaderTitle: 'ジムリーダー', leaderLook: person('#d04a1a', '#3a1a0a'), badge: 'ゆのかの灯章',
    team: [['hibanadori', 27], ['kakougan', 28], ['kagurabi', 29], ['enryu', 30]],
    rematch: [['homuradaka', 74], ['kazanou', 75], ['homuragitsune', 76], ['gouenryu', 78]],
    gymTrainers: [{ name: 'ホムラ', title: '湯守', look: person('#e07a3a', '#2a1a0a'), party: [['boyari', 26], ['okibi', 26]] }, { name: 'アツシ', title: '火の番', look: person('#a83a1a', '#1a0a0a'), party: [['kakougan', 27]] }],
    reward: [['super_potion', 4], ['sun_lantern', 1]], rematchReward: [['max_potion', 3], ['star_lantern', 1]],
    intro: '温泉の 湯けむりより 熱い勝負を しようぜ！ 燃えつきるなよ！', defeat: 'ふう、いい汗かいた！ ゆのかの灯章だ、持っていけ！',
    townsfolk: [
      { name: '温泉宿のおかみ', look: person('#c86a8a', '#2a1a1a'), lines: ['カエンさんは ほむら使い。しおや いわおの技で 火を消すのよ。'] },
      { name: '湯治客', look: person('#8a8a6a', '#dddddd'), lines: ['峠の上には ころころ転がる 岩の灯獣が いたねえ。'] },
    ],
    route: {
      id: 'yukemuri_pass', name: 'ゆけむり峠', seed: 4, palette: P.yuke, min: 22, max: 26, chest: ['sun_lantern', 1], hidden: ['revive_shard', 1],
      table: [['hibanadori', 20], ['kakougan', 18], ['boyari', 16], ['koroiwa', 16], ['koishimo', 14], ['okibi', 10]],
      sign: 'ゆけむり峠\n北：ゆのか温泉郷\n南：しおさい港',
      trainers: [
        { id: 'r4_goro', name: 'ゴロウ', title: '山男', look: person('#7a5a3a', '#2a2a2a'), party: [['koroiwa', 23], ['kakougan', 24]], intro: '峠を こえたければ おれを こえていけ！', defeat: 'まいった！ 道を ゆずろう。', after: 'コロイワは 進化すると 山のように 大きくなるぞ。' },
        { id: 'r4_hana', name: 'ハナ', title: '湯治客', look: person('#e0a0b0', '#4a2a1a'), party: [['hibanadori', 24], ['boyari', 25]], intro: '温泉の 前に ひと勝負 どう？', defeat: 'のぼせちゃった……。', after: 'ボヤリは 大きくなると 火山の 竜になるんですって。' },
      ],
    },
  },
  {
    id: 'inazuma_town', name: 'いなづま町', palette: { ground: '#dcdca8', path: '#ece0a8', grass: '#9ab84a', tree: '#4a6a3a', accent: '#ffe04a' },
    element: 'volt', leader: 'ライカ', leaderTitle: 'ジムリーダー', leaderLook: person('#e0c83a', '#2a2a5a'), badge: 'いなづまの灯章',
    team: [['shibireuo', 33], ['chirichiri', 34], ['biritateha', 34], ['raimeicho', 36]],
    rematch: [['raikougyo', 76], ['raijuu', 77], ['ikazuchiha', 78], ['raimeicho', 80]],
    gymTrainers: [{ name: 'ヒカリ', title: '電気技師', look: person('#e8d84a', '#4a4a4a'), party: [['biriko', 31], ['chirichiri', 32]] }, { name: 'ゴロ', title: '雷おやじ', look: person('#5a5a8a', '#dddddd'), party: [['raibou', 33]] }],
    reward: [['max_potion', 1], ['revive_shard', 2]], rematchReward: [['max_potion', 3], ['star_lantern', 1]],
    intro: 'わたしの 雷は 光より 速いよ！ しびれる 勝負に しよう！', defeat: 'びりびり……負けたけど 楽しかった！ いなづまの灯章よ！',
    townsfolk: [
      { name: '発電所の人', look: person('#8a8a9a', '#3a3a3a'), lines: ['ライカさんは いかずち使い。いわおの技は 電気を 通さないから 強いよ。'] },
      { name: 'しびれた少年', look: person('#e0b03a', '#6b3b1b'), lines: ['平原で ビリコに さわったら、髪の毛が 立っちゃった！'] },
    ],
    route: {
      id: 'kaminari_plain', name: 'かみなり平原', seed: 5, palette: P.kami, min: 27, max: 31, chest: ['max_potion', 1], hidden: ['sun_lantern', 1],
      table: [['biriko', 20], ['chirichiri', 20], ['tonbon', 18], ['shibireuo', 14], ['piricchi', 12], ['kazamidori', 10], ['raibou', 6]],
      sign: 'かみなり平原\n北：いなづま町\n南：ゆのか温泉郷',
      trainers: [
        { id: 'r5_den', name: 'デン', title: '雷マニア', look: person('#5a5ad0', '#e0e0e0'), party: [['chirichiri', 28], ['biriko', 29], ['shibireuo', 29]], intro: '雷が 落ちる瞬間が たまらないんだ！', defeat: 'ショートしちゃった……。', after: 'ビリコは 二回 進化するよ。最後は 嵐を 呼ぶチョウさ。' },
        { id: 'r5_yuki', name: 'ユキ', title: '学者', look: person('#f0f0f0', '#4a3a2a'), party: [['tonbon', 29], ['raibou', 30]], intro: '研究の じゃまを しないでくれる？ ……勝負なら 別よ。', defeat: '興味深い 結果ね。', after: 'ライボウは 進化しない めずらしい灯獣なの。' },
      ],
    },
  },
  {
    id: 'kurogane_town', name: 'くろがね鉱山町', palette: { ground: '#ccc4b4', path: '#dccfb6', grass: '#8a9a6a', tree: '#4a5a4a', accent: '#c8a87a' },
    element: 'stone', leader: 'ゴウ', leaderTitle: 'ジムリーダー', leaderLook: person('#7a6a5a', '#1a1a1a'), badge: 'くろがねの灯章',
    team: [['gantsumuri', 39], ['gansekio', 40], ['gankutsu', 40], ['gantodon', 42]],
    rematch: [['gantsumuri', 78], ['daiganou', 79], ['gankutsu', 80], ['ootsunodora', 82]],
    gymTrainers: [{ name: 'テツオ', title: '鉱夫', look: person('#6a5a4a', '#2a2a2a'), party: [['koroiwa', 37], ['katatsumu', 38]] }, { name: 'イワコ', title: '石工', look: person('#a89a8a', '#5a3a2a'), party: [['tsunodon', 39]] }],
    reward: [['max_potion', 2], ['star_lantern', 1]], rematchReward: [['max_potion', 3], ['star_lantern', 2]],
    intro: '岩は くだけても また 固まる。何度でも 立ちはだかるぞ！', defeat: 'おれの 岩を くだくとはな……くろがねの灯章、受け取れ！',
    townsfolk: [
      { name: '鉱山の親方', look: person('#8a6a4a', '#3a3a3a'), lines: ['ゴウは いわお使いだ。しお・めぶき・はやての技で 攻めな。'] },
      { name: '時計塔の番人', look: person('#c8b89a', '#5a5a5a'), lines: ['坂の上で、からくり人形の 灯獣を 見たって 話だよ。'] },
    ],
    route: {
      id: 'ishidatami_slope', name: 'いしだたみ坂', seed: 6, palette: P.ishi, min: 32, max: 36, chest: ['star_lantern', 1], hidden: ['max_potion', 1],
      table: [['tsunodon', 18], ['katabane', 20], ['gansekio', 12], ['gankutsu', 12], ['mofugard', 12], ['gantsumuri', 10], ['karakuriko', 6]],
      sign: 'いしだたみ坂\n北：くろがね鉱山町\n南：いなづま町',
      trainers: [
        { id: 'r6_tetsu', name: 'テツ', title: '鉱夫', look: person('#6a5a4a', '#2a2a2a'), party: [['gansekio', 33], ['tsunodon', 34]], intro: '鉱山で きたえた 力を 見せてやる！', defeat: 'ツルハシより 重い 一撃だったな。', after: 'ツノドンの 角は 進化するたびに 大きくなる。' },
        { id: 'r6_gin', name: 'ギン', title: 'からくり職人', look: person('#a87a4a', '#dddddd'), party: [['karakuriko', 34], ['katabane', 35]], intro: 'わしの 自慢の からくりを 見ていきなされ。', defeat: '歯車が 外れてしもうた。', after: 'カラクリコは 時計塔の 歯車の音で しゃべるんじゃ。' },
      ],
    },
  },
  {
    id: 'kazaguruma_village', name: 'かざぐるま村', palette: { ground: '#c4ecb8', path: '#ece2b8', grass: '#6ac08a', tree: '#3a8a6a', accent: '#c8f8e8' },
    element: 'gale', leader: 'フウカ', leaderTitle: 'ジムリーダー', leaderLook: person('#7ad0c0', '#f0f0f0'), badge: 'かざぐるまの灯章',
    team: [['hayatenbo', 45], ['kazekiri', 46], ['kamaitachi', 46], ['arashiwashi', 47], ['kazenomiko', 48]],
    rematch: [['hayatenbo', 80], ['tenkuuou', 81], ['kamaitachi', 82], ['arashiwashi', 82], ['kazenomiko', 84]],
    gymTrainers: [{ name: 'ツバサ', title: '鳥使い', look: person('#5a9ad0', '#2a2a2a'), party: [['kazekiri', 43], ['piyoka', 43]] }, { name: 'カオル', title: '風車守', look: person('#a8d8c8', '#6a4a2a'), party: [['kazenoko', 44], ['tonbon', 44]] }],
    reward: [['max_potion', 2], ['star_lantern', 1]], rematchReward: [['max_potion', 3], ['star_lantern', 2]],
    intro: '風は 目に見えない。でも、たしかに ここにある。わたしの風、受けとめられる？', defeat: '……いい風が 吹いたわ。かざぐるまの灯章を あげる。',
    townsfolk: [
      { name: '風車小屋の子', look: person('#e0c070', '#6b3b1b'), lines: ['フウカお姉ちゃんは はやて使い。いかずちや いわおの技が 苦手なんだって。'] },
      { name: '羊飼い', look: person('#f0e8d0', '#8a6a4a'), lines: ['南の 神殿町を こえた先、たそがれ街道の 古い松の根元には、千年に一度 目をさます 灯獣が いるらしいよ。'] },
    ],
    route: {
      id: 'soyogi_highland', name: 'そよぎ高原', seed: 7, palette: P.soyo, min: 37, max: 41, chest: ['star_lantern', 1], hidden: ['max_potion', 2],
      table: [['kazenoko', 18], ['tsukiusa', 18], ['powaru', 16], ['kazekiri', 14], ['hayatenbo', 12], ['arashiwashi', 8], ['fuwamo', 8], ['kamaitachi', 6]],
      sign: 'そよぎ高原\n北：かざぐるま村\n南：くろがね鉱山町',
      trainers: [
        { id: 'r7_sora', name: 'ソラ', title: '風読み', look: person('#8ac8e8', '#4a4a6a'), party: [['kazekiri', 38], ['hayatenbo', 39]], intro: '風が 勝負を 告げている！', defeat: '向かい風だったか……。', after: 'テンクウオウは 雲より 高く 飛ぶんだ。' },
        { id: 'r7_mei', name: 'メイ', title: '羊飼い', look: person('#f0e8d0', '#8a6a4a'), party: [['tsukiusa', 39], ['powaru', 39], ['fuwamo', 40]], intro: 'ふわふわ 仲間たちと 勝負しよう！', defeat: 'あらら、みんな 目を回しちゃった。', after: 'ポワルは 夜明け前に 露の上で 光ってるのよ。' },
      ],
    },
  },
  {
    id: 'akebono_temple', name: 'あけぼの神殿町', palette: { ground: '#ecf0dc', path: '#f4ead0', grass: '#9ac88a', tree: '#6a8a6a', accent: '#fff4b0' },
    element: 'shine', leader: 'アサヒ', leaderTitle: 'ジムリーダー', leaderLook: person('#f8e8a0', '#c8862a'), badge: 'あけぼのの灯章',
    team: [['gekkouusa', 51], ['mikotori', 52], ['hikariwata', 52], ['lumiel', 53], ['luminael', 54]],
    rematch: [['gekkouusa', 82], ['mikotori', 83], ['hikariwata', 84], ['hoshikujira', 84], ['luminael', 86]],
    gymTrainers: [{ name: 'セイ', title: '神官', look: person('#f0f0f0', '#c8a85a'), party: [['powaru', 49], ['tsukiusa', 50]] }, { name: 'ミコ', title: '巫女', look: person('#f04a4a', '#1a1a1a'), party: [['mikotori', 50], ['hanamiko', 50]] }],
    reward: [['max_potion', 3], ['star_lantern', 1]], rematchReward: [['max_potion', 3], ['star_lantern', 2]],
    intro: '夜明けの光は、どんな 暗やみも はらう。あなたの灯は どれほど 明るいかしら。', defeat: 'まぶしい灯ね……。あけぼのの灯章を さずけます。',
    townsfolk: [
      { name: '神殿の見習い', look: person('#f0e8c0', '#6a4a2a'), lines: ['アサヒさまは ひかり使い。かげの技で 攻めると いいですよ。'] },
      { name: 'おばあさん', look: person('#b5739a', '#dddddd'), lines: ['北の たそがれ街道に 古い松が あってねえ。千年に一度、マツタケのような 灯獣が 目をさますんだよ。強いから 気をつけて。'] },
    ],
    route: {
      id: 'asagiri_road', name: 'あさぎりの道', seed: 8, palette: P.asa, min: 42, max: 46, chest: ['star_lantern', 1], hidden: ['max_potion', 2],
      table: [['lumiel', 14], ['hanamiko', 14], ['kazenoko', 14], ['midoriageha', 14], ['morijika', 14], ['gekkouusa', 10], ['mikotori', 8], ['hikariwata', 6]],
      sign: 'あさぎりの道\n北：あけぼの神殿町\n南：かざぐるま村',
      trainers: [
        { id: 'r8_kana', name: 'カナ', title: '巡礼者', look: person('#e8e0c8', '#4a3a2a'), party: [['lumiel', 43], ['hanamiko', 44]], intro: '神殿へ 向かう 道すがら、ひと勝負 いかが？', defeat: 'よい 修行に なりました。', after: '朝霧の中だけで 歌う ミコトリを 見ましたか？' },
        { id: 'r8_ren', name: 'レン', title: '騎士', look: person('#8a9ab8', '#2a2a2a'), party: [['gekkouusa', 44], ['mofugard', 45]], intro: '騎士の名に かけて、勝負を 申しこむ！', defeat: 'みごとな 腕前だ。', after: 'モフガルドは 進化すると 金の鎧の 獅子になる。' },
      ],
    },
  },
  {
    id: 'yoiyami_valley', name: 'よいやみ谷', palette: { ground: '#8a8098', path: '#b4a490', grass: '#5a5a7a', tree: '#2a2440', accent: '#e8a0c8' },
    element: 'shade', leader: 'クロエ', leaderTitle: 'ジムリーダー', leaderLook: person('#3a2a5a', '#e0e0f0'), badge: 'よいやみの灯章',
    team: [['yurameki', 57], ['yomibachi', 58], ['kagewata', 58], ['yamitourou', 59], ['yominokiba', 60]],
    rematch: [['yurameki', 84], ['yomibachi', 85], ['kagewata', 86], ['yamitourou', 86], ['yominokiba', 88]],
    gymTrainers: [{ name: 'ヤミ', title: 'まじない師', look: person('#5a3a7a', '#1a1a1a'), party: [['yurari', 55], ['kageboushi', 55]] }, { name: 'ヨル', title: '影絵師', look: person('#2a2a3a', '#8a8aa8'), party: [['kuroko', 56], ['yorubachi', 56]] }],
    reward: [['max_potion', 3], ['star_lantern', 2]], rematchReward: [['max_potion', 3], ['star_lantern', 2]],
    intro: '影は 光が あるから 生まれるの。あなたの光が 強いほど、わたしの影も 濃くなるわ。', defeat: '……あなたの灯、影まで 照らしたわね。よいやみの灯章よ。',
    townsfolk: [
      { name: '谷の語り部', look: person('#6a5a7a', '#c8c8c8'), lines: ['クロエは かげ使い。ひかりの技に 弱いぞ。', '静夜団は 都の北の 洞窟で、なにかを 目ざめさせようと しているらしい。'] },
      { name: '静夜団をぬけた人', look: grunt, lines: ['ヨル様は 洞窟の奥で「トコヨノヤミ」を 目ざめさせるつもりだ。灯章を 10個そろえた 灯守しか 黒霞を こえられない……。'] },
    ],
    route: {
      id: 'tasogare_road', name: 'たそがれ街道', seed: 9, palette: P.taso, min: 47, max: 51, chest: ['star_lantern', 1], hidden: ['max_potion', 2],
      table: [['kuroko', 20], ['yorubachi', 18], ['yurari', 18], ['yamitourou', 10], ['enryu', 10], ['kagewata', 6], ['kageboushi', 6]],
      sign: 'たそがれ街道\n北：よいやみ谷\n南：あけぼの神殿町\n※西の 古い松には 近づかないこと',
      trainers: [
        { id: 'r9_lulu', name: 'ルル', title: '占い師', look: person('#a85ad0', '#2a1a2a'), party: [['yurari', 48], ['yamitourou', 49]], intro: 'あなたの 運命……勝負で 占ってあげる。', defeat: '占いは 外れたみたい。', after: '古い松の 灯獣は、かたくなって 攻撃を はね返すそうよ。' },
        { id: 'r9_grunt', name: 'したっぱ', title: '静夜団', look: grunt, party: [['kuroko', 49], ['yorubachi', 50]], intro: '灯章を 集めて どうする気だ！ ここで 消えてもらう！', defeat: 'くそっ、ヨル様に 報告だ！', after: '洞窟の 黒霞は、灯章 10個の光でしか 晴れないんだ……。' },
      ],
      keepClear: [[3, 24]],
      extraNpcs: [
        {
          id: 'legend_chonbo', name: 'チョンボ', x: 3, y: 24, facing: 'down',
          look: { body: '#a8743a', hair: '#e8dcc0', kind: 'boss', speciesId: 'chonbo' },
          showIf: { notFlag: 'chonbo_caught' },
          talk: [{ script: 'legend_chonbo' }],
        },
      ],
    },
  },
  {
    id: 'luminaria_capital', name: 'ルミナリア都', palette: { ground: '#e4e0f0', path: '#e8dcc0', grass: '#7aa88a', tree: '#3a5a6a', accent: '#ffd27a' },
    element: 'mixed', leader: 'ソウマ', leaderTitle: '灯守長', leaderLook: person('#4a3a8a', '#e8e8e8'), badge: 'ルミナリアの灯章',
    team: [['gardleon', 63], ['watatsumiba', 64], ['gouenryu', 64], ['ikazuchiha', 65], ['daiganou', 65], ['hanakaguya', 66]],
    rematch: [['gardleon', 86], ['watatsumiba', 87], ['gouenryu', 88], ['ikazuchiha', 88], ['ootsunodora', 89], ['luminael', 90]],
    gymTrainers: [{ name: 'アオイ', title: '灯守', look: person('#3a6ad0', '#2a2a2a'), party: [['namikiba', 61], ['enryu', 61]] }, { name: 'シオン', title: '灯守', look: person('#a83ad0', '#2a2a2a'), party: [['biritateha', 62], ['gansekio', 62]] }],
    reward: [['max_potion', 3], ['star_lantern', 2]], rematchReward: [['max_potion', 5], ['star_lantern', 3]],
    intro: '九つの属性すべてを 束ねる。それが 灯守長の 戦い方だ。きみの すべてを ぶつけてきなさい！', defeat: '見事だ……。ルミナリアの灯章を さずけよう。北の黒霞を はらえるのは、きみしか いない。',
    townsfolk: [
      { name: '都の兵士', look: person('#5a6a9a', '#2a2a2a'), lines: ['北の 洞窟は 黒霞に とざされている。灯章を 10個 そろえた 灯守だけが 通れるんだ。'] },
      { name: '博士の友人', look: person('#f2f2f2', '#4a6fa5'), lines: ['ソウマ灯守長は すべての属性を 使う。いろんな属性の なかまを そろえておくと いい。'] },
    ],
    route: {
      id: 'hoshizora_bridge', name: 'ほしぞらの橋', seed: 10, palette: P.hoshi, min: 52, max: 57, chest: ['star_lantern', 2], hidden: ['max_potion', 2],
      table: [['namikiba', 14], ['uzugame', 14], ['oounari', 12], ['hoshikujira', 10], ['raikougyo', 10], ['homuradaka', 10], ['gantsubasa', 10], ['shinkai', 8]],
      sign: 'ほしぞらの橋\n北：ルミナリア都\n南：よいやみ谷',
      trainers: [
        { id: 'r10_jin', name: 'ジン', title: '船乗り', look: person('#2a5a9a', '#1a1a1a'), party: [['namikiba', 53], ['oounari', 54], ['uzugame', 55]], intro: '七つの海を 渡った 灯獣たちだ！', defeat: '嵐に あったようだ……。', after: 'シンカイは 橋の下の 深い海峡に いるぞ。' },
        { id: 'r10_kuro', name: 'クロ', title: '静夜団の幹部', look: grunt, party: [['yoruga', 55], ['yomibachi', 56]], intro: '都には 行かせない！ ヨル様の 夜明けを じゃまするな！', defeat: 'これが……灯章の 力か……！', after: 'トコヨノヤミが 目ざめれば、島の灯は ぜんぶ 消える。それが ヨル様の 願いだ……。' },
      ],
    },
  },
];

// 町と道をつなぐ。ひだまり村（ジム1）は maps.ts にある既存の村で、ほたる森の北から こもれび街道へ出る。
TOWNS.forEach((t, i) => {
  const n = i + 2;
  const prevTownId = i === 0 ? null : TOWNS[i - 1].id;
  const routeSouth = prevTownId ? { mapId: prevTownId, x: 9, y: 1 } : { mapId: 'firefly_forest', x: 9, y: 1 };
  WORLD_MAPS.push(makeRoute({ ...t.route, south: routeSouth, north: { mapId: t.id, x: 9, y: 14 } }));
  const next = TOWNS[i + 1];
  const nextLine = next ? `次は ${next.route.name}を ぬけた先の ${next.name}に 行ってみるといい。` : '灯章が 10個 そろったら、北の 黒霞の洞窟へ。島の灯を たのんだよ。';
  WORLD_MAPS.push(
    ...makeTown(
      {
        ...t,
        n,
        south: { mapId: t.route.id, x: 9, y: 1 },
        north: next ? { mapId: next.route.id, x: 9, y: 28 } : { mapId: 'kurogasumi_cave', x: 9, y: 28 },
        sealedNorth: !next,
      },
      nextLine,
    ),
  );
});

// ───────────────────────── ジム1：ひだまり村（建物は maps.ts の村にある） ─────────────────────────
export const VILLAGE_GYM_DOOR = { x: 13, y: 11 };
registerGym(
  {
    n: 1, id: 'village', name: 'ひだまり村', element: 'neutral', leader: 'ツムギ', leaderTitle: 'ジムリーダー', leaderLook: person('#e0a050', '#5a3a1a'), badge: 'ひだまりの灯章',
    team: [['mofurin', 9], ['chunta', 10], ['munyu', 12]],
    rematch: [['gardleon', 70], ['chundaisho', 70], ['munyugon', 71], ['karakuriko', 72]],
    gymTrainers: [{ name: 'コウタ', title: '見習い', look: person('#e0b050', '#3a2a1a'), party: [['mofurin', 7]] }, { name: 'ユイ', title: '見習い', look: person('#f0a0b0', '#3a2a1a'), party: [['chunta', 8]] }],
    reward: [['bright_lantern', 3], ['super_potion', 2]], rematchReward: [['max_potion', 3], ['star_lantern', 1]],
    intro: 'ようこそ、ひだまりジムへ！ ふつうの灯獣だって、育て方しだいで いちばん 強くなれるんだから！', defeat: 'ぽかぽか、いい勝負だったね！ これが ひだまりの灯章だよ。',
  },
  '次は 北の ほたる森を ぬけて、こもれび街道の先の こもれび町へ。',
);
WORLD_MAPS.push(
  gymMap({
    n: 1, townId: 'village', townName: 'ひだまり村', element: 'neutral', leader: 'ツムギ', leaderLook: person('#e0a050', '#5a3a1a'), door: VILLAGE_GYM_DOOR,
    trainers: [{ name: 'コウタ', title: '見習い', look: person('#e0b050', '#3a2a1a'), party: [['mofurin', 7]] }, { name: 'ユイ', title: '見習い', look: person('#f0a0b0', '#3a2a1a'), party: [['chunta', 8]] }],
  }),
);
WORLD_SCRIPTS.visit_village = [{ setFlag: 'visited_village' }];

// ───────────────────────── 黒霞の洞窟（ラスボス） ─────────────────────────
WORLD_MAPS.push(
  makeRoute({
    id: 'kurogasumi_cave', name: '黒霞の洞窟', seed: 11, palette: P.cave, min: 58, max: 64, kind: 'dungeon', bgm: 'forest', wall: 'R',
    chest: ['star_lantern', 2], hidden: ['max_potion', 3],
    table: [['yoruga', 18], ['yurameki', 14], ['yomibachi', 12], ['yamitourou', 12], ['gantodon', 10], ['daiganou', 10], ['kageboushi', 8], ['ootsunodora', 6]],
    sign: '黒霞の洞窟\nこの先、トコヨノヤミ の ねむる場所。\n引き返すなら 今のうち。',
    south: { mapId: 'luminaria_capital', x: 9, y: 1 },
    north: { mapId: 'kurogasumi_depths', x: 4, y: 8 },
    trainers: [
      { id: 'cave_g1', name: 'したっぱ', title: '静夜団', look: grunt, party: [['yoruga', 60], ['yurameki', 61]], intro: 'ここから先へは 行かせない！', defeat: 'ヨル様……！', after: '奥で ヨル様が 儀式を はじめている……。' },
      { id: 'cave_g2', name: 'したっぱ', title: '静夜団', look: grunt, party: [['yomibachi', 61], ['gantodon', 62]], intro: '夜こそ やすらぎ！ 灯なんて いらない！', defeat: 'まぶしい……！', after: '……ほんとうは、夜明けを 見てみたかったのかもな。' },
      { id: 'cave_g3', name: 'ナギ', title: '静夜団の幹部', look: grunt, party: [['yominokiba', 62], ['yamitourou', 62], ['daiganou', 63]], intro: 'ヨル様の じゃまは させない！', defeat: '灯章の 光……ここまで とは。', after: 'ヨル様は 最奥の 祭壇だ。止められるなら 止めてみろ。' },
    ],
  }),
);
WORLD_MAPS.push({
  id: 'kurogasumi_depths',
  name: '黒霞の洞窟 最奥',
  kind: 'dungeon',
  bgm: 'forest',
  palette: P.cave,
  tiles: checkTiles('kurogasumi_depths', ['RRRRRRRRR', 'RRR...RRR', 'RR.....RR', 'RR.....RR', 'R.......R', 'R.......R', 'R.......R', 'R.....P.R', 'R.......R', 'RRRR,RRRR']),
  warps: [{ x: 4, y: 9, to: { mapId: 'kurogasumi_cave', x: 9, y: 1, facing: 'down' } }],
  npcs: [
    { id: 'yoru', name: 'ヨル', x: 2, y: 4, facing: 'right', look: { body: '#1a1424', hair: '#c8c8e8', kind: 'grunt' }, showIf: { notFlag: 'final_boss_down' }, talk: [{ script: 'yoru_talk' }] },
    { id: 'final_boss', name: 'トコヨノヤミ', x: 4, y: 2, facing: 'down', look: { body: '#1a1424', hair: '#7a2ad0', kind: 'boss', speciesId: 'tokoyonoyami' }, showIf: { notFlag: 'final_boss_down' }, talk: [{ script: 'final_boss' }] },
    { id: 'yoru_after', name: 'ヨル', x: 2, y: 4, facing: 'right', look: { body: '#4a3a6a', hair: '#c8c8e8', kind: 'person' }, showIf: { flag: 'final_boss_down' }, talk: [{ script: 'yoru_after' }] },
  ],
  objects: [{ id: 'depths_spring', x: 6, y: 7, kind: 'heal', text: '洞窟の 奥に わずかに 残った 灯の泉。なかまの灯が ともった。' }],
});

Object.assign(WORLD_SCRIPTS, {
  yoru_talk: [
    { who: 'ヨル', say: '……ここまで来たのね、灯守。' },
    { who: 'ヨル', say: '灯が あるから 人は 奪いあう。だから すべての灯を 眠らせて、明けない夜で 島を つつむの。' },
    { who: 'ヨル', say: 'トコヨノヤミは もう 目ざめた。止められるものなら、止めてみなさい。' },
  ],
  final_boss: [
    { say: '黒い霞の 奥で、巨大な 影が ゆっくりと 首を もたげた……！' },
    { who: 'トコヨノヤミ', say: '……ヒカリ……ケス……。' },
    {
      boss: { speciesId: 'tokoyonoyami', level: 70 },
      win: [
        { setFlag: 'final_boss_down' },
        { say: 'トコヨノヤミの 黒霞が 晴れていく……。洞窟の すきまから、朝日が さしこんだ！' },
        { who: 'ヨル', say: '……夜明け。こんなに 明るいものだったのね。' },
        { ending: true },
      ],
    },
  ],
  yoru_after: [
    { who: 'ヨル', say: '灯は 奪いあうものじゃなく、分けあうもの……あなたを 見て わかった気がする。' },
    { who: 'ヨル', say: '各地の ジムリーダーが、あなたと 本気で 戦いたがっているそうよ。行ってあげなさい。' },
  ],
  ferry: [{ who: '灯の渡し守', say: '灯の舟で、一度 行った町へ 送ってあげよう。' }, { travel: true }],
  shop_town: [{ shop: 'town' }],
});

/** 町の灯の家の外（渡し舟で着く場所） */
export function townArrival(townId: string): { mapId: string; x: number; y: number } {
  if (townId === 'village') return { mapId: 'village', x: 13, y: 5 };
  return { mapId: townId, x: 4, y: 5 };
}

/** 渡し舟で行ける町（ジム番号の順） */
export const TRAVEL_TOWNS = [{ id: 'village', name: 'ひだまり村' }, ...TOWNS.map((t) => ({ id: t.id, name: t.name }))];
