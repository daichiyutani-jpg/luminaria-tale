/** 乱数。テストで結果を固定できるように、すべてのゲーム処理はこの型を受け取る。 */
export interface Rng {
  /** 0以上1未満 */
  next(): number;
}

export const mathRng: Rng = { next: () => Math.random() };

/** シード付き乱数（mulberry32）。テストと対人戦の再現に使う。 */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0;
  return {
    next() {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

/** 決まった値を順に返す乱数（テスト用） */
export function fixedRng(values: number[], fallback = 0.5): Rng {
  let i = 0;
  return { next: () => (i < values.length ? values[i++] : fallback) };
}

export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng.next() * (max - min + 1));
}

export function chance(rng: Rng, percent: number): boolean {
  return rng.next() * 100 < percent;
}
