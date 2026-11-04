import type { EvolutionDef, MonsterInstance, SaveData, Stats } from '../core/types';
import { getMove, MOVES } from '../data/moves';
import { getSpecies } from '../data/species';
import { expForLevel } from './exp';
import { randInt, type Rng } from './rng';
import { calcStats, MAX_LEVEL, maxHp, STAT_KEYS } from './stats';

export const MAX_MOVES = 4;

export function displayName(mon: MonsterInstance): string {
  return mon.nickname || getSpecies(mon.speciesId).name;
}

/** そのレベルまでに覚える技（新しいものから最大4つ） */
export function defaultMoves(speciesId: string, level: number): { id: string; pp: number }[] {
  const learned = getSpecies(speciesId)
    .learnset.filter(([lv, id]) => lv <= level && MOVES[id])
    .map(([, id]) => id);
  const unique = [...new Set(learned)];
  return unique.slice(-MAX_MOVES).map((id) => ({ id, pp: getMove(id).pp }));
}

export function createMonster(
  speciesId: string,
  level: number,
  rng: Rng,
  opts: { uid: string; caughtAt: string; ivs?: Stats; now?: string },
): MonsterInstance {
  getSpecies(speciesId); // 存在確認
  const ivs = opts.ivs ?? (Object.fromEntries(STAT_KEYS.map((k) => [k, randInt(rng, 0, 15)])) as Stats);
  const mon: MonsterInstance = {
    uid: opts.uid,
    speciesId,
    level,
    exp: expForLevel(level),
    ivs,
    hp: 0,
    status: null,
    moves: defaultMoves(speciesId, level),
    history: [speciesId],
    caughtAt: opts.caughtAt,
    caughtLevel: level,
    obtainedAt: opts.now ?? new Date().toISOString(),
  };
  mon.hp = maxHp(mon);
  return mon;
}

/** 新しいUIDを払い出す（セーブ内の通し番号＋作成時刻で端末内一意） */
export function issueUid(save: SaveData): string {
  const n = save.nextUid++;
  return `${save.slot}-${Date.now().toString(36)}-${n.toString(36)}`;
}

export function healFully(mon: MonsterInstance): void {
  mon.hp = maxHp(mon);
  mon.status = null;
  mon.sleepTurns = 0;
  for (const m of mon.moves) m.pp = getMove(m.id).pp;
}

export interface LevelUpResult {
  /** 上がった後のレベル一覧（例：[6,7]） */
  levels: number[];
  /** 自動で覚えた技 */
  learned: string[];
  /** 技が4つで覚えられず、入れ替えを確認する必要がある技 */
  pending: string[];
}

/** 経験値を加え、レベルアップと技の習得を処理する */
export function grantExp(mon: MonsterInstance, amount: number): LevelUpResult {
  const res: LevelUpResult = { levels: [], learned: [], pending: [] };
  if (mon.level >= MAX_LEVEL) return res;
  mon.exp += Math.max(0, Math.floor(amount));
  while (mon.level < MAX_LEVEL && mon.exp >= expForLevel(mon.level + 1)) {
    const before = maxHp(mon);
    mon.level++;
    const after = maxHp(mon);
    if (mon.hp > 0) mon.hp = Math.min(after, mon.hp + (after - before));
    res.levels.push(mon.level);
    for (const [lv, id] of getSpecies(mon.speciesId).learnset) {
      if (lv !== mon.level || !MOVES[id] || mon.moves.some((m) => m.id === id)) continue;
      if (mon.moves.length < MAX_MOVES) {
        mon.moves.push({ id, pp: getMove(id).pp });
        res.learned.push(id);
      } else res.pending.push(id);
    }
  }
  if (mon.level >= MAX_LEVEL) mon.exp = expForLevel(MAX_LEVEL);
  return res;
}

/** 技の入れ替え。replaceIndex が null なら覚えない */
export function learnMove(mon: MonsterInstance, moveId: string, replaceIndex: number | null): boolean {
  if (replaceIndex === null) return false;
  if (!MOVES[moveId] || mon.moves.some((m) => m.id === moveId)) return false;
  if (mon.moves.length < MAX_MOVES) mon.moves.push({ id: moveId, pp: getMove(moveId).pp });
  else if (replaceIndex >= 0 && replaceIndex < mon.moves.length) mon.moves[replaceIndex] = { id: moveId, pp: getMove(moveId).pp };
  else return false;
  return true;
}

export interface EvolutionContext {
  mapId: string;
  /** 使おうとしているアイテム（アイテム進化の時だけ） */
  itemId?: string;
  completedQuests?: string[];
}

/** 今の状況で満たしている進化先 */
export function availableEvolutions(mon: MonsterInstance, ctx: EvolutionContext): EvolutionDef[] {
  const evos = getSpecies(mon.speciesId).evolutions ?? [];
  return evos.filter((e) => {
    const c = e.condition;
    switch (c.kind) {
      case 'level':
        return !ctx.itemId && mon.level >= c.level;
      case 'item':
        return ctx.itemId === c.itemId && mon.level >= (c.minLevel ?? 1);
      case 'levelAtLocation':
        return !ctx.itemId && mon.level >= c.level && ctx.mapId === c.mapId;
      case 'levelKnowsMove':
        return !ctx.itemId && mon.level >= c.level && mon.moves.some((m) => m.id === c.moveId);
      case 'quest':
        return !ctx.itemId && mon.level >= c.level && (ctx.completedQuests ?? []).includes(c.questId);
    }
  });
}

/** 進化させる。HPは減っている量を保ったまま新しい最大値に合わせる */
export function evolve(mon: MonsterInstance, toSpeciesId: string): void {
  const sp = getSpecies(mon.speciesId);
  if (!(sp.evolutions ?? []).some((e) => e.to === toSpeciesId)) throw new Error(`${sp.id} は ${toSpeciesId} に進化できない`);
  const before = maxHp(mon);
  const damage = before - mon.hp;
  mon.speciesId = toSpeciesId;
  mon.history.push(toSpeciesId);
  const after = maxHp(mon);
  mon.hp = mon.hp <= 0 ? 0 : Math.max(1, after - damage);
}

/** 進化で覚える技（進化先の learnset で、現在レベル以下かつ未習得のうち Lv1 のもの＋現在レベルのもの） */
export function movesOnEvolve(mon: MonsterInstance): string[] {
  return getSpecies(mon.speciesId)
    .learnset.filter(([lv, id]) => (lv === 1 || lv === mon.level) && !mon.moves.some((m) => m.id === id) && MOVES[id])
    .map(([, id]) => id);
}

export function statsPreview(mon: MonsterInstance, speciesId: string): Stats {
  return calcStats(speciesId, mon.ivs, mon.level);
}
