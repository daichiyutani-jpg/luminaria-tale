/**
 * 難易度の目安を確かめるシミュレーション。
 * プレイヤー側は「いちばん効く技を選ぶ」素直な遊び方、道具は使わない想定。
 * 勝率が極端（ほぼ勝てない／作業になる）にならないことを確かめる。
 */
import { describe, expect, it } from 'vitest';
import { aiChooseMove, aiChooseSwitch, createBattle, resolveTurn, switchAfterFaint, type BattleKind } from '../src/logic/battle';
import { createMonster, evolve } from '../src/logic/monster';
import { seededRng, type Rng } from '../src/logic/rng';
import type { MonsterInstance, Stats } from '../src/core/types';

const MID: Stats = { hp: 8, atk: 8, def: 8, spa: 8, spd: 8, spe: 8 };

let uid = 0;
function mon(speciesId: string, level: number, rng: Rng, ivs: Stats = MID, evolveTo?: string): MonsterInstance {
  const m = createMonster(speciesId, level, rng, { uid: `u${uid++}`, caughtAt: 'test', ivs, now: '2026-01-01T00:00:00Z' });
  if (evolveTo) evolve(m, evolveTo);
  return m;
}

function simulate(kind: BattleKind, player: () => MonsterInstance[], enemy: () => MonsterInstance[], runs: number, seed: number): number {
  let wins = 0;
  for (let r = 0; r < runs; r++) {
    const rng = seededRng(seed + r);
    const state = createBattle(kind, { name: 'P', party: player() }, { name: 'E', party: enemy() });
    for (let turn = 0; turn < 200 && !state.result; turn++) {
      for (const side of [0, 1] as const) {
        if (state.needsSwitch[side]) switchAfterFaint(state, side, aiChooseSwitch(state, side));
      }
      if (state.result) break;
      resolveTurn(state, [aiChooseMove(state, 0, rng, 1), aiChooseMove(state, 1, rng)], rng);
    }
    if (state.result === 'win') wins++;
  }
  return wins / runs;
}

const STARTERS: [string, string][] = [
  ['hinokoro', 'kagurabi'],
  ['shizukun', 'minamodra'],
  ['mebukin', 'morinonushi'],
];
const RIVAL_FOR: Record<string, string> = { hinokoro: 'shizukun', shizukun: 'mebukin', mebukin: 'hinokoro' };

const BOSS_IVS: Stats = { hp: 12, atk: 12, def: 12, spa: 12, spd: 12, spe: 12 };
/** 森までに捕まえられる灯獣で組んだ 2 通りのパーティ（相性を意識した編成／適当な編成） */
const PARTNERS: [string, string][] = [
  ['kazamidori', 'yoiyami'],
  ['fuwamo', 'piricchi'],
];

function bossRate(starter: string, evo: string, partners: [string, string], lv: number, sub: number, seed: number): number {
  return simulate(
    'boss',
    () => [mon(starter, lv, seededRng(1), MID, evo), mon(partners[0], sub, seededRng(2)), mon(partners[1], sub, seededRng(3))],
    () => [mon('hotarunoou', 13, seededRng(4), BOSS_IVS)],
    200,
    seed,
  );
}

describe('難易度のめやす（シミュレーション・道具なし）', () => {
  it('最初の見習いトレーナー（ユウ）は 相棒1体の Lv5 で たいてい勝てる', () => {
    for (const [s] of STARTERS) {
      const rate = simulate('trainer', () => [mon(s, 5, seededRng(1))], () => [mon('piricchi', 3, seededRng(2)), mon('kazamidori', 3, seededRng(3))], 200, 100);
      expect(rate, `${s} vs ユウ`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('ライバル戦（負けてもよい戦い）は 不利相性だが 勝つこともある', () => {
    for (const [s] of STARTERS) {
      const rate = simulate('trainer', () => [mon(s, 5, seededRng(1))], () => [mon(RIVAL_FOR[s], 4, seededRng(2))], 300, 200);
      expect(rate, `${s} vs ライバル`).toBeGreaterThan(0);
      expect(rate, `${s} vs ライバル`).toBeLessThan(0.6);
    }
  });

  it('森の主（Lv13）は 想定レベル（相棒Lv15・なかまLv13）なら どの相棒でも 勝てる', () => {
    for (const [s, evo] of STARTERS) {
      for (const p of PARTNERS) {
        expect(bossRate(s, evo, p, 15, 13, 300), `${s}+${p} Lv15/13`).toBeGreaterThanOrEqual(0.9);
      }
    }
  });

  it('森の主は 少し低いレベル（Lv13/11）だと 負けることもある（作業ではなく 手ごたえがある）', () => {
    for (const [s, evo] of STARTERS) {
      for (const p of PARTNERS) {
        const rate = bossRate(s, evo, p, 13, 11, 500);
        expect(rate, `${s}+${p} Lv13/11`).toBeGreaterThanOrEqual(0.25);
        expect(rate, `${s}+${p} Lv13/11`).toBeLessThan(1);
      }
    }
  });

  it('大きく低いレベル（Lv9/8）では 森の主に まず勝てない', () => {
    const rate = simulate('boss', () => [mon('hinokoro', 9, seededRng(1)), mon('koishimo', 8, seededRng(2)), mon('piricchi', 8, seededRng(3))], () => [mon('hotarunoou', 13, seededRng(4), BOSS_IVS)], 200, 400);
    expect(rate).toBeLessThan(0.25);
  });
});
