/**
 * ゲーム全体で使う型定義。
 * データ（src/data）とゲーム処理（src/logic）はこの型だけでつながる。
 */

/** 属性 */
export type Element = 'neutral' | 'blaze' | 'tide' | 'sprout' | 'volt' | 'stone' | 'gale' | 'shine' | 'shade';

export type StatKey = 'hp' | 'atk' | 'def' | 'spa' | 'spd' | 'spe';
export type Stats = Record<StatKey, number>;
/** 戦闘中に上下する能力（命中を含む） */
export type StageKey = 'atk' | 'def' | 'spa' | 'spd' | 'spe' | 'acc';

export type StatusId = 'burn' | 'poison' | 'paralyze' | 'sleep' | 'mist';

export type Rarity = 'common' | 'uncommon' | 'rare' | 'boss' | 'legend';
export type Role = 'attacker' | 'tank' | 'special' | 'support' | 'speed' | 'balanced';

export type MoveCategory = 'physical' | 'special' | 'status';
export type MoveTarget = 'enemy' | 'self';

export interface MoveEffect {
  /** 状態異常を与える */
  status?: StatusId;
  /** 発生確率（0〜100）。省略時は100 */
  chance?: number;
  /** 能力ランクの変化 */
  stages?: Partial<Record<StageKey, number>>;
  /** 変化の対象。省略時は技の対象 */
  stageTarget?: MoveTarget;
  /** 与えたダメージに対する回復割合（吸収） */
  drain?: number;
  /** 最大HPに対する回復割合 */
  heal?: number;
  /** 自分の状態異常を治す */
  cureSelf?: boolean;
  /** 急所に当たりやすい */
  highCrit?: boolean;
  /** 先制（行動順の優先度） */
  priority?: number;
  /** 反動（与えたダメージに対する割合） */
  recoil?: number;
  /** 使ったターンを含めて この数のターン、相手の技（相手が対象のもの）を受けつけない */
  guard?: number;
  /** ため技：使ったターンは力をためるだけ（動けない）。次のターンに自動で この技の威力・命中率で こうげきする */
  charge?: boolean;
}

export interface MoveDef {
  id: string;
  name: string;
  description: string;
  element: Element;
  category: MoveCategory;
  /** 威力（補助技は0） */
  power: number;
  /** 命中率（0〜100）。100超は必中 */
  accuracy: number;
  /** 使用回数 */
  pp: number;
  target: MoveTarget;
  effect?: MoveEffect;
}

export type EvolutionCondition =
  | { kind: 'level'; level: number }
  | { kind: 'item'; itemId: string; minLevel?: number }
  | { kind: 'levelAtLocation'; level: number; mapId: string }
  | { kind: 'levelKnowsMove'; level: number; moveId: string }
  | { kind: 'quest'; questId: string; level: number };

export interface EvolutionDef {
  to: string;
  condition: EvolutionCondition;
  /** 進化先選択画面での説明（戦い方の違い） */
  hint: string;
}

export interface SpeciesDef {
  id: string;
  dexNo: number;
  name: string;
  /** 分類（例：「ひのこギツネ」） */
  category: string;
  description: string;
  /** 生態・性格 */
  ecology: string;
  elements: [Element] | [Element, Element];
  baseStats: Stats;
  /** 倒した時の基礎経験値 */
  baseExp: number;
  /** 捕まえやすさ（0〜255、0は捕獲不可） */
  catchRate: number;
  /** [覚えるレベル, 技ID] */
  learnset: [number, string][];
  evolutions?: EvolutionDef[];
  /** 進化前（図鑑表示用・自動計算でも可） */
  evolvesFrom?: string;
  rarity: Rarity;
  role: Role;
  habitat: string;
  /** 画像の参照（src/art の描画レシピID） */
  art: string;
  /** 図鑑の色見本 */
  color: string;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string;
  kind: 'heal' | 'cure' | 'revive' | 'capture' | 'evolve' | 'battle' | 'key';
  price: number;
  /** 回復量（heal） */
  healAmount?: number;
  /** 治す状態異常（cure）。'all' ですべて */
  cures?: StatusId[] | 'all';
  /** 復活時のHP割合（revive） */
  reviveRatio?: number;
  /** 捕獲補正（capture） */
  captureBonus?: number;
  /** 戦闘中の能力上昇（battle） */
  stages?: Partial<Record<StageKey, number>>;
  usableInBattle: boolean;
  usableInField: boolean;
}

/** 育てているモンスター1体分の保存データ */
export interface MonsterInstance {
  uid: string;
  speciesId: string;
  nickname?: string;
  level: number;
  exp: number;
  /** 素質（個体値）0〜15 */
  ivs: Stats;
  hp: number;
  status: StatusId | null;
  /** 眠りの残りターン */
  sleepTurns?: number;
  moves: { id: string; pp: number }[];
  /** 進化の履歴（種族IDの並び。最後が現在） */
  history: string[];
  caughtAt: string;
  caughtLevel: number;
  /** 捕まえた/もらった日時（ISO） */
  obtainedAt: string;
  /** 元の持ち主（通信交換用。自分なら undefined） */
  originalTrainer?: string;
}

export type DexState = 'unknown' | 'seen' | 'caught';

export interface QuestDef {
  id: string;
  name: string;
  kind: 'main' | 'sub';
  description: string;
  /** 達成判定の種類 */
  goal:
    | { kind: 'flag'; flag: string }
    | { kind: 'dexCaught'; count: number }
    | { kind: 'defeatTrainers'; trainerIds: string[] }
    | { kind: 'ownSpecies'; speciesId: string };
  /** 受注のきっかけ（フラグ）。省略時は最初から受注 */
  startFlag?: string;
  reward: { money?: number; items?: [string, number][]; flag?: string };
  /** 報告先NPC（説明用） */
  reportTo?: string;
}

export interface QuestProgress {
  state: 'active' | 'done' | 'claimed';
}

export interface Settings {
  bgmVolume: number;
  seVolume: number;
  bgmOn: boolean;
  seOn: boolean;
  /** 戦闘メッセージの速さ 1=ふつう 2=はやい 3=さいそく */
  battleSpeed: 1 | 2 | 3;
  /** 戦闘アニメの省略 */
  skipAnimations: boolean;
}

export type Facing = 'up' | 'down' | 'left' | 'right';

/** セーブデータ本体 */
export interface SaveData {
  version: number;
  gameVersion: string;
  slot: number;
  createdAt: string;
  savedAt: string;
  playerName: string;
  playTimeSec: number;
  money: number;
  location: { mapId: string; x: number; y: number; facing: Facing };
  /** 最後に回復した場所（全滅時に戻る） */
  respawn: { mapId: string; x: number; y: number };
  party: MonsterInstance[];
  box: MonsterInstance[];
  items: Record<string, number>;
  dex: Record<string, DexState>;
  flags: Record<string, boolean>;
  quests: Record<string, QuestProgress>;
  defeatedTrainers: string[];
  openedChests: string[];
  /** 図鑑番号順の進化記録（何回進化させたか） */
  stats: { battlesWon: number; captures: number; evolutions: number; steps: number };
  /** 次のモンスターUIDの通し番号 */
  nextUid: number;
}
