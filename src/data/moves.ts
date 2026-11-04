import type { MoveDef } from '../core/types';

const list: MoveDef[] = [
  // ふつう
  { id: 'tackle', name: 'たいあたり', description: '体ごとぶつかる。', element: 'neutral', category: 'physical', power: 40, accuracy: 100, pp: 35, target: 'enemy' },
  { id: 'quick_dash', name: 'すばやダッシュ', description: '必ず先に動ける体当たり。', element: 'neutral', category: 'physical', power: 40, accuracy: 100, pp: 25, target: 'enemy', effect: { priority: 1 } },
  { id: 'growl_soft', name: 'こわいかお', description: '相手の攻撃を1段階下げる。', element: 'neutral', category: 'status', power: 0, accuracy: 100, pp: 30, target: 'enemy', effect: { stages: { atk: -1 } } },
  { id: 'harden', name: 'かたくなる', description: '自分の防御を1段階上げる。', element: 'neutral', category: 'status', power: 0, accuracy: 101, pp: 30, target: 'self', effect: { stages: { def: 1 } } },
  { id: 'rest_song', name: 'まどろみのうた', description: '相手をねむらせる。', element: 'neutral', category: 'status', power: 0, accuracy: 60, pp: 15, target: 'enemy', effect: { status: 'sleep' } },
  { id: 'heavy_press', name: 'のしかかり', description: '重い体でのしかかる。まひさせることがある。', element: 'neutral', category: 'physical', power: 75, accuracy: 100, pp: 15, target: 'enemy', effect: { status: 'paralyze', chance: 20 } },
  // ほむら
  { id: 'ember', name: 'ひのこ', description: '小さな火の粉。やけどさせることがある。', element: 'blaze', category: 'special', power: 40, accuracy: 100, pp: 25, target: 'enemy', effect: { status: 'burn', chance: 10 } },
  { id: 'flame_fang', name: 'ほむらのキバ', description: '燃えるキバでかみつく。', element: 'blaze', category: 'physical', power: 65, accuracy: 95, pp: 15, target: 'enemy', effect: { status: 'burn', chance: 10 } },
  { id: 'kagura_flame', name: 'かぐらび', description: '舞うように炎を放つ。自分の特攻が上がることがある。', element: 'blaze', category: 'special', power: 80, accuracy: 100, pp: 10, target: 'enemy', effect: { stages: { spa: 1 }, stageTarget: 'self', chance: 30 } },
  { id: 'scorch', name: 'あぶりだし', description: '相手をやけどにする。', element: 'blaze', category: 'status', power: 0, accuracy: 80, pp: 15, target: 'enemy', effect: { status: 'burn' } },
  // しお
  { id: 'splash_shot', name: 'みずでっぽう', description: '水を勢いよくかける。', element: 'tide', category: 'special', power: 40, accuracy: 100, pp: 25, target: 'enemy' },
  { id: 'tide_tail', name: 'しおなみテール', description: '波をまとった尾で打つ。', element: 'tide', category: 'physical', power: 70, accuracy: 100, pp: 15, target: 'enemy' },
  { id: 'spring_heal', name: 'わきみず', description: '湧き水で最大HPの半分を回復する。', element: 'tide', category: 'status', power: 0, accuracy: 101, pp: 10, target: 'self', effect: { heal: 0.5 } },
  { id: 'torrent', name: 'うずしお', description: '大きな渦で巻き込む。', element: 'tide', category: 'special', power: 85, accuracy: 90, pp: 10, target: 'enemy' },
  // めぶき
  { id: 'leaf_cut', name: 'はっぱカッター', description: '鋭い葉で切りつける。急所に当たりやすい。', element: 'sprout', category: 'physical', power: 50, accuracy: 95, pp: 25, target: 'enemy', effect: { highCrit: true } },
  { id: 'sap_drain', name: 'すいとるつる', description: '与えたダメージの半分だけ回復する。', element: 'sprout', category: 'special', power: 45, accuracy: 100, pp: 20, target: 'enemy', effect: { drain: 0.5 } },
  { id: 'spore_puff', name: 'ねむりごな', description: '相手をねむらせる。', element: 'sprout', category: 'status', power: 0, accuracy: 75, pp: 15, target: 'enemy', effect: { status: 'sleep' } },
  { id: 'thorn_rush', name: 'いばらラッシュ', description: 'トゲのつるで何度も打つ。', element: 'sprout', category: 'physical', power: 85, accuracy: 90, pp: 10, target: 'enemy' },
  { id: 'toxic_pollen', name: 'どくかふん', description: '相手をどくにする。', element: 'sprout', category: 'status', power: 0, accuracy: 90, pp: 20, target: 'enemy', effect: { status: 'poison' } },
  // いかずち
  { id: 'spark', name: 'でんきショック', description: '電気を流す。まひさせることがある。', element: 'volt', category: 'special', power: 40, accuracy: 100, pp: 30, target: 'enemy', effect: { status: 'paralyze', chance: 10 } },
  { id: 'jolt_wave', name: 'しびれのは', description: '相手をまひさせる。', element: 'volt', category: 'status', power: 0, accuracy: 90, pp: 20, target: 'enemy', effect: { status: 'paralyze' } },
  { id: 'thunder_beak', name: 'いなずまくちばし', description: '雷をまとったくちばしで突く。', element: 'volt', category: 'physical', power: 75, accuracy: 100, pp: 15, target: 'enemy', effect: { status: 'paralyze', chance: 10 } },
  { id: 'storm_bolt', name: 'らいめい', description: '空から雷を落とす。', element: 'volt', category: 'special', power: 90, accuracy: 85, pp: 10, target: 'enemy', effect: { status: 'paralyze', chance: 20 } },
  // いわお
  { id: 'pebble_toss', name: 'いしつぶて', description: '小石を投げつける。', element: 'stone', category: 'physical', power: 45, accuracy: 100, pp: 25, target: 'enemy' },
  { id: 'iron_shell', name: 'てっぺきのから', description: '防御を2段階上げる。', element: 'stone', category: 'status', power: 0, accuracy: 101, pp: 15, target: 'self', effect: { stages: { def: 2 } } },
  { id: 'rock_drill', name: 'がんせきドリル', description: '岩のツメで掘り進むように攻撃。', element: 'stone', category: 'physical', power: 80, accuracy: 90, pp: 10, target: 'enemy' },
  { id: 'sand_veil', name: 'すなけむり', description: '相手の命中を1段階下げる。', element: 'stone', category: 'status', power: 0, accuracy: 100, pp: 15, target: 'enemy', effect: { stages: { acc: -1 } } },
  // はやて
  { id: 'gust', name: 'かぜおこし', description: '風を起こしてぶつける。', element: 'gale', category: 'special', power: 40, accuracy: 100, pp: 30, target: 'enemy' },
  { id: 'whirlwind_step', name: 'つむじかぜ', description: '風をまとって素早さを2段階上げる。', element: 'gale', category: 'status', power: 0, accuracy: 101, pp: 20, target: 'self', effect: { stages: { spe: 2 } } },
  { id: 'air_slash', name: 'エアスラッシュ', description: '空気の刃で切り裂く。', element: 'gale', category: 'special', power: 75, accuracy: 95, pp: 15, target: 'enemy', effect: { highCrit: true } },
  { id: 'gale_wing', name: 'はやてのつばさ', description: '一瞬で切り込む先制攻撃。', element: 'gale', category: 'physical', power: 55, accuracy: 100, pp: 15, target: 'enemy', effect: { priority: 1 } },
  // ひかり
  { id: 'glow_beam', name: 'ひかりのつぶ', description: '光の粒をぶつける。', element: 'shine', category: 'special', power: 45, accuracy: 100, pp: 25, target: 'enemy' },
  { id: 'dawn_prayer', name: 'あかつきのいのり', description: '最大HPの半分を回復し、状態異常を治す。', element: 'shine', category: 'status', power: 0, accuracy: 101, pp: 10, target: 'self', effect: { heal: 0.5, cureSelf: true } },
  { id: 'prism_ray', name: 'プリズムレイ', description: '虹色の光線。相手の特防を下げることがある。', element: 'shine', category: 'special', power: 85, accuracy: 100, pp: 10, target: 'enemy', effect: { stages: { spd: -1 }, chance: 20 } },
  { id: 'dazzle', name: 'まばゆいひかり', description: '強い光で相手の命中を1段階下げる。', element: 'shine', category: 'status', power: 0, accuracy: 100, pp: 20, target: 'enemy', effect: { stages: { acc: -1 } } },
  // かげ
  { id: 'shadow_nip', name: 'かげかじり', description: '影から現れてかじる。', element: 'shade', category: 'physical', power: 45, accuracy: 100, pp: 25, target: 'enemy' },
  { id: 'night_mist', name: 'よいやみのかすみ', description: '相手をかすみ状態にする（命中が下がる）。', element: 'shade', category: 'status', power: 0, accuracy: 90, pp: 15, target: 'enemy', effect: { status: 'mist' } },
  { id: 'dusk_orb', name: 'たそがれだま', description: '黒い光の玉。かすみ状態にすることがある。', element: 'shade', category: 'special', power: 80, accuracy: 100, pp: 10, target: 'enemy', effect: { status: 'mist', chance: 20 } },
  { id: 'soul_sip', name: 'たましいすすり', description: '与えたダメージの半分だけ回復する。', element: 'shade', category: 'special', power: 60, accuracy: 100, pp: 15, target: 'enemy', effect: { drain: 0.5 } },
  { id: 'nasty_whisper', name: 'あやしいささやき', description: '自分の特攻を2段階上げる。', element: 'shade', category: 'status', power: 0, accuracy: 101, pp: 15, target: 'self', effect: { stages: { spa: 2 } } },
  // 使える技が無い時の最後の手段
  { id: 'struggle', name: 'わるあがき', description: '技を使い切った時の最後の手段。自分も少し傷つく。', element: 'neutral', category: 'physical', power: 40, accuracy: 101, pp: 1, target: 'enemy', effect: { recoil: 0.25 } },
  // ボス専用
  { id: 'black_haze', name: 'くろがすみ', description: '黒霞を吐き出す。どくにすることがある。', element: 'shade', category: 'special', power: 70, accuracy: 100, pp: 15, target: 'enemy', effect: { status: 'poison', chance: 30 } },
  { id: 'firefly_storm', name: 'ほたるあらし', description: '無数の光の粒が吹き荒れる。', element: 'shine', category: 'special', power: 75, accuracy: 95, pp: 10, target: 'enemy' },
];

export const MOVES: Record<string, MoveDef> = Object.fromEntries(list.map((m) => [m.id, m]));

/** 技が見つからない時に使う代わりの技（データ破損時でも戦闘を止めない） */
export const FALLBACK_MOVE = MOVES.tackle;

export function getMove(id: string): MoveDef {
  return MOVES[id] ?? FALLBACK_MOVE;
}
