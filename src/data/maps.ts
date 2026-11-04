/**
 * マップデータ。文字1つが1マス。
 *
 *  .  地面          ,  道           "  草むら（野生の灯獣が出る）   f  花
 *  T  木（通れない） h  隠し通路（木に見えるが通れる）               ~  水（通れない）
 *  =  屋根           #  壁            D  入口                         F  柵
 *  R  岩             S  看板（調べる） C  宝箱（調べる）               L  灯籠柱（調べる）
 *  X  黒霞の壁（フラグで消える）       P  灯の泉・ベッド（調べると回復）
 *  K  保管機（ボックス）               O  台座        _  床（屋内）    W  屋内の壁
 *  B  橋
 */
import type { Facing } from '../core/types';
import type { Condition } from './conditions';
import { WORLD_MAPS } from './world';

export type BgmId = 'title' | 'town' | 'field' | 'forest' | 'battle' | 'boss' | 'evolution' | 'victory' | 'indoor';

export interface Warp {
  x: number;
  y: number;
  to: { mapId: string; x: number; y: number; facing: Facing };
}

export interface EncounterEntry {
  speciesId: string;
  weight: number;
  minLevel: number;
  maxLevel: number;
}

export interface NpcDef {
  id: string;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  /** 見た目：体の色と、ひとこと特徴 */
  look: { body: string; hair: string; kind: 'person' | 'monster' | 'boss' | 'grunt'; speciesId?: string };
  /** 表示する条件 */
  showIf?: Condition;
  /** 会話（上から順に条件に合う最初のもの） */
  talk: { if?: Condition; script: string }[];
  /** トレーナー：視線に入ると勝負を挑んでくる */
  trainerId?: string;
  sight?: number;
}

export interface ObjectDef {
  id: string;
  x: number;
  y: number;
  kind: 'chest' | 'hidden' | 'sign' | 'lantern' | 'heal' | 'box' | 'pedestal';
  /** 宝箱・隠しアイテムの中身 */
  item?: [string, number];
  /** 看板の文章・灯籠のフラグなど */
  text?: string;
  flag?: string;
  script?: string;
}

export interface MapDef {
  id: string;
  name: string;
  kind: 'town' | 'field' | 'dungeon' | 'indoor';
  bgm: BgmId;
  tiles: string[];
  warps: Warp[];
  npcs: NpcDef[];
  objects: ObjectDef[];
  encounters?: { rate: number; table: EncounterEntry[] };
  /** フラグで消える黒霞の壁 */
  barrierFlag?: string;
  /** 色調（屋外の雰囲気） */
  palette: { ground: string; path: string; grass: string; tree: string; accent: string };
  /** 入った時に一度だけ動く台本 */
  onEnter?: { if?: Condition; script: string }[];
}

const village: MapDef = {
  id: 'village',
  name: 'ひだまり村',
  kind: 'town',
  bgm: 'town',
  palette: { ground: '#9fd37a', path: '#e3c995', grass: '#6fb85a', tree: '#3f8a4a', accent: '#f6d47a' },
  tiles: [
    'TTTTTTTT,,TTTTTTTT',
    'T......f,,.......T',
    'T.=====.,,.=====.T',
    'T.=====.,,.=====.T',
    'T.##D##.,,.##D##.T',
    'T.......,,.......T',
    'T..f....,,....f..T',
    'T,,,,,,,,,,,,,,,,T',
    'T.......,,.......T',
    'T.===...,,.=====.T',
    'T.===...,,.=====.T',
    'T.#D#...,,.##D##.T',
    'T.......,,.....S.T',
    'T..ff...,,..~~~~.T',
    'T.f.....,,..~~~~.T',
    'TTTTTTTTTTTTTTTTTT',
  ],
  warps: [
    { x: 4, y: 4, to: { mapId: 'lab', x: 4, y: 6, facing: 'up' } },
    { x: 13, y: 4, to: { mapId: 'center', x: 4, y: 6, facing: 'up' } },
    { x: 3, y: 11, to: { mapId: 'home', x: 3, y: 5, facing: 'up' } },
    { x: 13, y: 11, to: { mapId: 'village_gym', x: 5, y: 12, facing: 'up' } },
    { x: 8, y: 0, to: { mapId: 'grassland', x: 9, y: 28, facing: 'up' } },
    { x: 9, y: 0, to: { mapId: 'grassland', x: 10, y: 28, facing: 'up' } },
  ],
  npcs: [
    {
      id: 'gate_guard', name: '見張りのダン', x: 9, y: 1, facing: 'down',
      look: { body: '#5b7bb5', hair: '#3a2a1a', kind: 'person' },
      showIf: { notFlag: 'got_starter' },
      talk: [{ script: 'guard_block' }],
    },
    {
      id: 'gate_pet', name: 'ダンのコイシモ', x: 8, y: 1, facing: 'down',
      look: { body: '#a07a4e', hair: '#a07a4e', kind: 'monster', speciesId: 'koishimo' },
      showIf: { notFlag: 'got_starter' },
      talk: [{ script: 'guard_pet' }],
    },
    {
      id: 'villager_old', name: 'ものしりばあさん', x: 6, y: 8, facing: 'right',
      look: { body: '#b5739a', hair: '#dddddd', kind: 'person' },
      talk: [
        { if: { flag: 'boss1_down' }, script: 'old_after' },
        { script: 'old_lore' },
      ],
    },
    {
      id: 'villager_kid', name: 'げんきな子 ポポ', x: 14, y: 6, facing: 'left',
      look: { body: '#e3a33a', hair: '#6b3b1b', kind: 'person' },
      talk: [{ script: 'kid_tips' }],
    },
  ],
  objects: [
    { id: 'sign_village', x: 15, y: 12, kind: 'sign', text: 'ここは ひだまり村\n北：そよかぜ草原 → ほたる森\n右の建物：ひだまりジム（ふつう）\n「灯をたやさず、灯獣と ともに」' },
    { id: 'hidden_village_1', x: 16, y: 1, kind: 'hidden', item: ['potion', 2] },
  ],
  onEnter: [{ if: { notFlag: 'visited_village' }, script: 'visit_village' }],
};

const home: MapDef = {
  id: 'home',
  name: '自分の家',
  kind: 'indoor',
  bgm: 'indoor',
  palette: { ground: '#d9b98c', path: '#c8a477', grass: '#c8a477', tree: '#7a5537', accent: '#f6d47a' },
  tiles: [
    'WWWWWWWW',
    'W_P____W',
    'W______W',
    'W__OO__W',
    'W______W',
    'W______W',
    'WWWDWWWW',
  ],
  warps: [{ x: 3, y: 6, to: { mapId: 'village', x: 3, y: 12, facing: 'down' } }],
  npcs: [
    {
      id: 'mother', name: 'お母さん', x: 5, y: 3, facing: 'left',
      look: { body: '#d0716b', hair: '#5a3a22', kind: 'person' },
      talk: [
        { if: { flag: 'boss1_down' }, script: 'mother_after' },
        { if: { flag: 'got_starter' }, script: 'mother_heal' },
        { script: 'mother_intro' },
      ],
    },
  ],
  objects: [{ id: 'bed', x: 2, y: 1, kind: 'heal', text: 'ふかふかの ベッドで ひとやすみした。' }],
};

const lab: MapDef = {
  id: 'lab',
  name: 'ソラネ灯獣研究所',
  kind: 'indoor',
  bgm: 'indoor',
  palette: { ground: '#e6e2d3', path: '#d2cdb8', grass: '#d2cdb8', tree: '#8a8f99', accent: '#7fd1e8' },
  tiles: [
    'WWWWWWWWWW',
    'W_K____K_W',
    'W________W',
    'W__OOO___W',
    'W________W',
    'W________W',
    'W________W',
    'WWWWDWWWWW',
  ],
  warps: [{ x: 4, y: 7, to: { mapId: 'village', x: 4, y: 5, facing: 'down' } }],
  npcs: [
    {
      id: 'dr_sorane', name: 'ソラネ博士', x: 4, y: 2, facing: 'down',
      look: { body: '#f2f2f2', hair: '#4a6fa5', kind: 'person' },
      talk: [
        { if: { flag: 'boss1_down' }, script: 'dr_chapter_end' },
        { if: { flag: 'rival1_done' }, script: 'dr_go_forest' },
        { if: { flag: 'got_starter' }, script: 'dr_after_starter' },
        { script: 'dr_intro' },
      ],
    },
    {
      id: 'rival_kaito', name: 'カイト', x: 7, y: 4, facing: 'left',
      look: { body: '#3d8f6a', hair: '#1d1d2a', kind: 'person' },
      showIf: { notFlag: 'rival1_done' },
      talk: [
        { if: { flag: 'got_starter' }, script: 'rival_battle1' },
        { script: 'rival_wait' },
      ],
    },
    {
      id: 'assistant', name: '助手のリンネ', x: 2, y: 5, facing: 'right',
      look: { body: '#8fb36b', hair: '#b0643a', kind: 'person' },
      talk: [{ script: 'assistant_fuwamo' }],
    },
  ],
  objects: [
    { id: 'lab_box_l', x: 2, y: 1, kind: 'box' },
    { id: 'lab_box_r', x: 7, y: 1, kind: 'box' },
    { id: 'pedestal_1', x: 3, y: 3, kind: 'pedestal', script: 'pedestal' },
    { id: 'pedestal_2', x: 4, y: 3, kind: 'pedestal', script: 'pedestal' },
    { id: 'pedestal_3', x: 5, y: 3, kind: 'pedestal', script: 'pedestal' },
  ],
};

const center: MapDef = {
  id: 'center',
  name: '灯の家（回復・ショップ）',
  kind: 'indoor',
  bgm: 'indoor',
  palette: { ground: '#f0dcc0', path: '#e0c7a5', grass: '#e0c7a5', tree: '#a5734a', accent: '#ffcf6b' },
  tiles: [
    'WWWWWWWWWW',
    'W_P____K_W',
    'W________W',
    'W________W',
    'W________W',
    'W________W',
    'W________W',
    'WWWWDWWWWW',
  ],
  warps: [{ x: 4, y: 7, to: { mapId: 'village', x: 13, y: 5, facing: 'down' } }],
  npcs: [
    {
      id: 'healer', name: '灯守のミズホ', x: 2, y: 2, facing: 'down',
      look: { body: '#f0a2b5', hair: '#7a3b5a', kind: 'person' },
      talk: [{ script: 'healer' }],
    },
    {
      id: 'shopkeeper', name: '道具屋のトト', x: 6, y: 2, facing: 'down',
      look: { body: '#6b8fd1', hair: '#2a2a2a', kind: 'person' },
      talk: [{ script: 'shop_village' }],
    },
    {
      id: 'researcher_luka', name: '研究員ルカ', x: 7, y: 5, facing: 'left',
      look: { body: '#c9c9c9', hair: '#2e5a3a', kind: 'person' },
      talk: [
        { if: { questState: ['sub_yoiyami', 'done'] }, script: 'luka_done' },
        { if: { flag: 'luka_asked' }, script: 'luka_waiting' },
        { script: 'luka_ask' },
      ],
    },
  ],
  objects: [
    { id: 'center_spring', x: 2, y: 1, kind: 'heal', text: '灯の泉に手をかざすと、なかまの灯が あたたかく ともった。' },
    { id: 'center_box', x: 7, y: 1, kind: 'box' },
  ],
};

const grassland: MapDef = {
  id: 'grassland',
  name: 'そよかぜ草原',
  kind: 'field',
  bgm: 'field',
  palette: { ground: '#a8d982', path: '#e6cf9c', grass: '#5fae4e', tree: '#3c8546', accent: '#ffe28a' },
  tiles: [
    'TTTTTTTTT,,TTTTTTTTT',
    'T"""....,,,,...."""T',
    'T"""....,,......"""T',
    'T..R....,,....R....T',
    'T.......,,.........T',
    'T~~~~...BB...""""..T',
    'T~~~~...,,...""""..T',
    'T.......,,...""""..T',
    'T..""""",,.........T',
    'T..""""",,......C..T',
    'T..""""",,.........T',
    'T.......,,,,,,,....T',
    'T.R..........,,....T',
    'T....""""....,,.R..T',
    'T....""""....,,....T',
    'T....""""....,,....T',
    'T............,,....T',
    'T..S.....,,,,,,....T',
    'T........,,........T',
    'T.""""...,,..""""".T',
    'T.""""...,,..""""".T',
    'T.""""...,,..""""".T',
    'T........,,........T',
    'T..f.....,,.....f..T',
    'T.....R..,,..R.....T',
    'T........,,........T',
    'T..f.....,,.....f..T',
    'T........,,........T',
    'T........,,........T',
    'TTTTTTTTT,,TTTTTTTTT',
  ],
  warps: [
    { x: 9, y: 29, to: { mapId: 'village', x: 8, y: 1, facing: 'down' } },
    { x: 10, y: 29, to: { mapId: 'village', x: 9, y: 1, facing: 'down' } },
    { x: 9, y: 0, to: { mapId: 'firefly_forest', x: 9, y: 26, facing: 'up' } },
    { x: 10, y: 0, to: { mapId: 'firefly_forest', x: 10, y: 26, facing: 'up' } },
  ],
  encounters: {
    rate: 11,
    table: [
      { speciesId: 'piricchi', weight: 32, minLevel: 3, maxLevel: 6 },
      { speciesId: 'kazamidori', weight: 28, minLevel: 3, maxLevel: 6 },
      { speciesId: 'koishimo', weight: 20, minLevel: 4, maxLevel: 7 },
      { speciesId: 'fuwamo', weight: 16, minLevel: 4, maxLevel: 6 },
      { speciesId: 'hinokoro', weight: 4, minLevel: 5, maxLevel: 7 },
    ],
  },
  npcs: [
    {
      id: 'trainer_yu', name: '見習い灯守のユウ', x: 6, y: 22, facing: 'right',
      look: { body: '#e07b39', hair: '#2a1a0a', kind: 'person' },
      trainerId: 'yu', sight: 3,
      talk: [{ if: { defeated: 'yu' }, script: 'yu_after' }, { script: 'trainer_generic' }],
    },
    {
      id: 'trainer_mio', name: '花屋のミオ', x: 17, y: 16, facing: 'left',
      look: { body: '#ef8fb1', hair: '#d9a14a', kind: 'person' },
      trainerId: 'mio', sight: 3,
      talk: [{ if: { defeated: 'mio' }, script: 'mio_after' }, { script: 'trainer_generic' }],
    },
    {
      id: 'trainer_gen', name: '釣り人のゲン', x: 5, y: 4, facing: 'down',
      look: { body: '#4f7a8f', hair: '#444444', kind: 'person' },
      trainerId: 'gen', sight: 3,
      talk: [{ if: { defeated: 'gen' }, script: 'gen_after' }, { script: 'trainer_generic' }],
    },
    {
      id: 'nono', name: 'ノノ', x: 11, y: 12, facing: 'down',
      look: { body: '#9b7fe0', hair: '#f0e0c0', kind: 'person' },
      talk: [
        { if: { questState: ['sub_lost_fuwamo', 'claimed'] }, script: 'nono_thanks' },
        { if: { flag: 'moco_found' }, script: 'nono_reunion' },
        { if: { flag: 'nono_asked' }, script: 'nono_waiting' },
        { script: 'nono_ask' },
      ],
    },
    {
      id: 'moco', name: 'フワモのモコ', x: 18, y: 1, facing: 'down',
      look: { body: '#efe7d6', hair: '#efe7d6', kind: 'monster', speciesId: 'fuwamo' },
      showIf: { all: [{ flag: 'nono_asked' }, { notFlag: 'moco_found' }] },
      talk: [{ script: 'moco_found' }],
    },
  ],
  objects: [
    { id: 'sign_grass', x: 3, y: 17, kind: 'sign', text: 'そよかぜ草原\n草むらには 灯獣が ひそんでいる。\n北に進むと ほたる森。' },
    { id: 'chest_grass_1', x: 16, y: 9, kind: 'chest', item: ['lantern', 3] },
    { id: 'hidden_grass_1', x: 1, y: 12, kind: 'hidden', item: ['super_potion', 1] },
    { id: 'hidden_grass_2', x: 18, y: 25, kind: 'hidden', item: ['bright_lantern', 1] },
  ],
};

const forest: MapDef = {
  id: 'firefly_forest',
  name: 'ほたる森',
  kind: 'dungeon',
  bgm: 'forest',
  barrierFlag: 'mist_cleared',
  palette: { ground: '#5f8f5a', path: '#8f9a6a', grass: '#3f7a44', tree: '#244d33', accent: '#d9f27a' },
  tiles: [
    'TTTTTTTTT,,TTTTTTTTT',
    'TTTTTTT.....TTTTTTTT',
    'TTTTTT...P...TTTTTTT',
    'TTTTTT.......TTTTTTT',
    'TTTTTTT.....TTTTTTTT',
    'TTTTTTTTXXXXTTTTTTTT',
    'T"""".....,,....""TT',
    'T""""T....,,..L.""TT',
    'T..TTT....,,TTTTT..T',
    'T..T......,,.....T.T',
    'TL.T.""""",,"""".T.T',
    'T..T.""""",,""""...T',
    'T..TTTTT..,,..TTTTTT',
    'T.........,,.......T',
    'TTTTT""...,,...""..T',
    'Th...""...,,...""..T',
    'TCT..TTTTT,,TTTTT..T',
    'TTT..T....,,....T..T',
    'T....T.""",,""".T..T',
    'T.L..T.""",,""".T..T',
    'T....T....,,....T..T',
    'T....TTTT.,,.TTTT..T',
    'T"""......,,.....""T',
    'T""""....,,....""""T',
    'T.........,,.......T',
    'T.........,,.......T',
    'T.........,,.......T',
    'TTTTTTTTT,,TTTTTTTTT',
  ],
  warps: [
    { x: 9, y: 27, to: { mapId: 'grassland', x: 9, y: 1, facing: 'down' } },
    { x: 10, y: 27, to: { mapId: 'grassland', x: 10, y: 1, facing: 'down' } },
    { x: 9, y: 0, to: { mapId: 'komorebi_road', x: 9, y: 28, facing: 'up' } },
    { x: 10, y: 0, to: { mapId: 'komorebi_road', x: 10, y: 28, facing: 'up' } },
  ],
  encounters: {
    rate: 12,
    table: [
      { speciesId: 'yoiyami', weight: 32, minLevel: 8, maxLevel: 11 },
      { speciesId: 'mebukin', weight: 16, minLevel: 8, maxLevel: 10 },
      { speciesId: 'fuwamo', weight: 14, minLevel: 8, maxLevel: 10 },
      { speciesId: 'piricchi', weight: 14, minLevel: 9, maxLevel: 11 },
      { speciesId: 'koishimo', weight: 12, minLevel: 9, maxLevel: 11 },
      { speciesId: 'shizukun', weight: 8, minLevel: 8, maxLevel: 10 },
      { speciesId: 'kazamidori', weight: 4, minLevel: 9, maxLevel: 11 },
    ],
  },
  npcs: [
    {
      id: 'grunt_1', name: '静夜団のしたっぱ', x: 13, y: 9, facing: 'left',
      look: { body: '#2b2740', hair: '#5a4a8a', kind: 'grunt' },
      trainerId: 'grunt1', sight: 3,
      talk: [{ if: { defeated: 'grunt1' }, script: 'grunt1_after' }, { script: 'trainer_generic' }],
    },
    {
      id: 'grunt_2', name: '静夜団のしたっぱ', x: 4, y: 18, facing: 'down',
      look: { body: '#2b2740', hair: '#5a4a8a', kind: 'grunt' },
      trainerId: 'grunt2', sight: 3,
      talk: [{ if: { defeated: 'grunt2' }, script: 'grunt2_after' }, { script: 'trainer_generic' }],
    },
    {
      id: 'kaito_forest', name: 'カイト', x: 11, y: 24, facing: 'down',
      look: { body: '#3d8f6a', hair: '#1d1d2a', kind: 'person' },
      showIf: { notFlag: 'boss1_down' },
      talk: [{ script: 'kaito_forest_hint' }],
    },
    {
      id: 'boss_hotaru', name: 'ホタルノオウ', x: 9, y: 3, facing: 'down',
      look: { body: '#c9e86b', hair: '#c9e86b', kind: 'boss', speciesId: 'hotarunoou' },
      showIf: { notFlag: 'boss1_down' },
      talk: [{ script: 'boss_hotaru' }],
    },
    {
      id: 'hotaru_calm', name: 'ホタルノオウ', x: 10, y: 3, facing: 'down',
      look: { body: '#c9e86b', hair: '#c9e86b', kind: 'monster', speciesId: 'hotarunoou' },
      showIf: { flag: 'boss1_down' },
      talk: [{ script: 'hotaru_calm' }],
    },
    {
      id: 'forest_gate', name: '森の番人', x: 9, y: 1, facing: 'down',
      look: { body: '#5a7a4a', hair: '#3a2a1a', kind: 'person' },
      showIf: { notFlag: 'boss1_down' },
      talk: [{ script: 'forest_gate' }],
    },
    {
      id: 'forest_gate_pet', name: '番人のコイシモ', x: 10, y: 1, facing: 'down',
      look: { body: '#a07a4e', hair: '#a07a4e', kind: 'monster', speciesId: 'koishimo' },
      showIf: { notFlag: 'boss1_down' },
      talk: [{ script: 'forest_gate' }],
    },
  ],
  objects: [
    { id: 'lantern_a', x: 14, y: 7, kind: 'lantern', flag: 'lantern_a' },
    { id: 'lantern_b', x: 1, y: 10, kind: 'lantern', flag: 'lantern_b' },
    { id: 'lantern_c', x: 2, y: 19, kind: 'lantern', flag: 'lantern_c' },
    { id: 'chest_forest_secret', x: 1, y: 16, kind: 'chest', item: ['sun_lantern', 1] },
    { id: 'chest_forest_1', x: 18, y: 9, kind: 'chest', item: ['revive_shard', 1] },
    { id: 'hidden_forest_1', x: 18, y: 20, kind: 'hidden', item: ['cure_all', 2] },
    { id: 'hidden_forest_2', x: 7, y: 13, kind: 'hidden', item: ['power_tonic', 1] },
    { id: 'forest_spring', x: 9, y: 2, kind: 'heal', text: '森の泉の水を すくうと、なかまの灯が ゆらりと ともった。' },
  ],
  onEnter: [{ if: { notFlag: 'forest_entered' }, script: 'forest_first' }],
};

export const MAPS: Record<string, MapDef> = Object.fromEntries([village, home, lab, center, grassland, forest, ...WORLD_MAPS].map((m) => [m.id, m]));

export function getMap(id: string): MapDef {
  const m = MAPS[id];
  if (!m) throw new Error(`unknown map: ${id}`);
  return m;
}

/** そのマスを歩けるか（NPC・壁の判定は別） */
export function isWalkableTile(ch: string, barrierOpen: boolean): boolean {
  if (ch === 'X') return barrierOpen;
  return '.,"fhB_D'.includes(ch);
}

export function tileAt(map: MapDef, x: number, y: number): string {
  if (y < 0 || y >= map.tiles.length || x < 0 || x >= map.tiles[y].length) return 'T';
  return map.tiles[y][x];
}
