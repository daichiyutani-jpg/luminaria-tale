import type { MonsterInstance, Stats, StatKey } from '../core/types';
import { getSpecies } from '../data/species';

export const MAX_LEVEL = 100;
export const STAT_KEYS: StatKey[] = ['hp', 'atk', 'def', 'spa', 'spd', 'spe'];

/** 能力値の計算。素質(0〜15)が少しだけ個性を出す。 */
export function calcStat(key: StatKey, base: number, iv: number, level: number): number {
  if (key === 'hp') return Math.floor(((base * 2 + iv) * level) / 100) + level + 10;
  return Math.floor(((base * 2 + iv) * level) / 100) + 5;
}

export function calcStats(speciesId: string, ivs: Stats, level: number): Stats {
  const sp = getSpecies(speciesId);
  const out = {} as Stats;
  for (const k of STAT_KEYS) out[k] = calcStat(k, sp.baseStats[k], ivs[k], level);
  return out;
}

export function statsOf(mon: MonsterInstance): Stats {
  return calcStats(mon.speciesId, mon.ivs, mon.level);
}

export function maxHp(mon: MonsterInstance): number {
  return statsOf(mon).hp;
}
