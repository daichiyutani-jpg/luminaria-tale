import type { MonsterInstance, StatusId } from '../core/types';
import { getSpecies } from '../data/species';
import type { Rng } from './rng';
import { maxHp } from './stats';

/**
 * 捕獲成功率の上限。どんなに弱らせても、良いランタンでも、まれに逃げられる（運の要素を残す）。
 */
export const MAX_CAPTURE_CHANCE = 0.85;

const STATUS_BONUS: Record<StatusId, number> = { sleep: 2, paralyze: 1.5, burn: 1.5, poison: 1.5, mist: 1.2 };

/**
 * 捕獲成功率（0〜1）。
 * 残りHPが少ないほど・状態異常があるほど・ランタンが良いほど上がる。捕獲率0の種は捕まえられない。
 * 上限は MAX_CAPTURE_CHANCE（必ず捕まえられる、ということはない）。
 */
export function captureChance(target: MonsterInstance, lanternBonus: number): number {
  const rate = getSpecies(target.speciesId).catchRate;
  if (rate <= 0) return 0;
  const max = maxHp(target);
  const hp = Math.max(1, target.hp);
  const status = target.status ? STATUS_BONUS[target.status] : 1;
  const a = (((3 * max - 2 * hp) * rate * lanternBonus) / (3 * max)) * status;
  return Math.max(0, Math.min(MAX_CAPTURE_CHANCE, a / 255));
}

export interface CaptureRoll {
  success: boolean;
  /** ランタンが揺れた回数（0〜3）。演出用 */
  shakes: number;
  chance: number;
}

/** 4回の判定をすべて通れば成功。通った回数が揺れる回数になる（成功確率は chance と等しい） */
export function rollCapture(target: MonsterInstance, lanternBonus: number, rng: Rng): CaptureRoll {
  const chance = captureChance(target, lanternBonus);
  if (chance <= 0) return { success: false, shakes: 0, chance };
  const per = chance ** 0.25;
  let passed = 0;
  while (passed < 4 && rng.next() < per) passed++;
  return { success: passed === 4, shakes: Math.min(3, passed), chance };
}
