import { MAX_LEVEL } from './stats';

/**
 * そのレベルになるまでに必要な累計経験値。
 * Lv5=100, Lv10=800, Lv14=2195, Lv20=6400, Lv30=21600。
 */
export function expForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(0.8 * level ** 3);
}

export function levelForExp(exp: number): number {
  let lv = 1;
  while (lv < MAX_LEVEL && exp >= expForLevel(lv + 1)) lv++;
  return lv;
}

/**
 * 倒した相手から得る経験値。
 * 相手のレベルが自分より高いほど多く、低いほど少ない（格下狩りで時間を稼がせないため）。
 */
export function expYield(baseExp: number, enemyLevel: number, myLevel: number, trainer: boolean): number {
  const raw = (baseExp * enemyLevel) / 5;
  const ratio = Math.min(1.5, Math.max(0.35, (enemyLevel + 4) / (myLevel + 4)));
  // 2026-11-05：レベル上げを少し楽に（全体 1.25 倍）
  return Math.max(1, Math.floor(raw * ratio * (trainer ? 1.4 : 1) * 1.25));
}
