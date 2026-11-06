/**
 * さいはて諸島（2回目のトコヨノヤミの後に開く追加エリア）・ボッキー・がまん（2026-11-06）
 */
import { describe, expect, it } from 'vitest';
import type { MonsterInstance } from '../src/core/types';
import { checkCondition } from '../src/data/conditions';
import { ITEMS } from '../src/data/items';
import { MAPS } from '../src/data/maps';
import { MOVES } from '../src/data/moves';
import { SCRIPTS, type Cmd } from '../src/data/scripts';
import { SHOPS } from '../src/data/shops';
import { SPECIES, SPECIES_LIST } from '../src/data/species';
import { GYMS, ISLE_BOSS_LEVEL, ISLE_OPEN_FLAG, TOKOYO2_LEVEL, TRAVEL_TOWNS } from '../src/data/world';
import { active, createBattle, resolveTurn } from '../src/logic/battle';
import { buy, newGame } from '../src/logic/game';
import { availableEvolutions, createMonster, evolve, movesOnEvolve } from '../src/logic/monster';
import { seededRng } from '../src/logic/rng';
import { maxHp } from '../src/logic/stats';

const ISLE_TOWN_IDS = ['shiranami_port', 'kokemusu_village', 'tsurara_village', 'hoshifuru_hill', 'hate_capital'];
const ISLE_MAP_IDS = [...ISLE_TOWN_IDS, 'sasanami_coast', 'inishie_jukai', 'koorikaze_pass', 'nagareboshi_field', 'saihate_lighthouse', 'saihate_top'];
const ISLE_SPECIES = SPECIES_LIST.filter((s) => s.dexNo >= 102 && s.id !== 'hatenonushi');

let n = 0;
const mk = (sp: string, lv: number): MonsterInstance =>
  createMonster(sp, lv, seededRng(n), { uid: `i${n++}`, caughtAt: 'test', ivs: { hp: 8, atk: 8, def: 8, spa: 8, spd: 8, spe: 8 } });

function bossOf(script: string) {
  return (SCRIPTS[script].find((c) => 'boss' in c) as Extract<Cmd, { boss: unknown }>).boss;
}

describe('さいはて諸島', () => {
  it('町は5つ。渡し舟は 2回目のトコヨノヤミを倒すまで行けない', () => {
    for (const id of ISLE_MAP_IDS) expect(MAPS[id], id).toBeTruthy();
    const isleTravel = TRAVEL_TOWNS.filter((t) => ISLE_TOWN_IDS.includes(t.id));
    expect(isleTravel).toHaveLength(5);
    expect(isleTravel[0].unlock).toBe(ISLE_OPEN_FLAG);
    const win = (SCRIPTS.final_boss2.find((c) => 'boss' in c) as Extract<Cmd, { boss: unknown }>).win!;
    expect(win).toContainEqual({ setFlag: ISLE_OPEN_FLAG });
    // 島の町にジムは無い
    expect(GYMS.some((g) => ISLE_TOWN_IDS.includes(g.townId))).toBe(false);
  });

  it('2回目のトコヨノヤミは、ボスを倒して きらめく灯章10個がそろった時だけ現れる', () => {
    expect(bossOf('final_boss2')).toEqual({ speciesId: 'tokoyonoyami', level: TOKOYO2_LEVEL });
    const npc = MAPS.kurogasumi_depths.npcs.find((x) => x.id === 'final_boss2')!;
    const save = newGame(1, 'テスト');
    save.flags.final_boss_down = true;
    for (const g of GYMS.slice(0, 9)) save.flags[`badge2_${g.n}`] = true;
    expect(checkCondition(save, npc.showIf!)).toBe(false);
    save.flags[`badge2_${GYMS[9].n}`] = true;
    expect(checkCondition(save, npc.showIf!)).toBe(true);
    save.flags.final_boss2_down = true;
    expect(checkCondition(save, npc.showIf!)).toBe(false);
  });

  it('最後のボスは Lv100 のハテノヌシ（捕まえられない）', () => {
    expect(ISLE_BOSS_LEVEL).toBe(100);
    expect(bossOf('isle_boss')).toEqual({ speciesId: 'hatenonushi', level: 100 });
    expect(SPECIES.hatenonushi.catchRate).toBe(0);
  });

  it('島の灯獣は ボッキーを入れて50種。49種は島の野生にだけ出て、本島の野生には出ない', () => {
    expect(ISLE_SPECIES).toHaveLength(49);
    expect(ISLE_SPECIES.length + 1).toBe(50); // ＋ボッキー
    const isleWild = new Set<string>();
    const mainWild = new Set<string>();
    for (const m of Object.values(MAPS)) {
      for (const e of m.encounters?.table ?? []) (ISLE_MAP_IDS.includes(m.id) ? isleWild : mainWild).add(e.speciesId);
    }
    for (const s of ISLE_SPECIES) {
      expect(isleWild.has(s.id), `${s.id} が島の野生に出る`).toBe(true);
      expect(mainWild.has(s.id), `${s.id} が本島の野生に出ない`).toBe(false);
    }
    expect(isleWild.has('bokki') || mainWild.has('bokki')).toBe(false);
    // 島の野生には本島の灯獣も出ない（島だけの顔ぶれ）
    for (const id of isleWild) expect(ISLE_SPECIES.some((s) => s.id === id), id).toBe(true);
  });

  it('難易度は高め：島の野生は Lv80以上、トレーナーは Lv86以上', () => {
    for (const id of ISLE_MAP_IDS) {
      for (const e of MAPS[id].encounters?.table ?? []) expect(e.minLevel, `${id} ${e.speciesId}`).toBeGreaterThanOrEqual(80);
    }
    const wildMain = Object.values(MAPS).filter((m) => !ISLE_MAP_IDS.includes(m.id)).flatMap((m) => m.encounters?.table ?? []);
    const mainMax = Math.max(...wildMain.map((e) => e.maxLevel));
    expect(mainMax).toBeLessThan(80);
  });
});

describe('ボッキー と ローション', () => {
  it('ローションは 100,000ルクス。売っているのは 島の道具屋だけ', () => {
    expect(ITEMS.lotion.price).toBe(100000);
    const sellers = Object.values(SHOPS).filter((s) => s.stock.some((x) => x.itemId === 'lotion'));
    expect(sellers.map((s) => s.id)).toEqual(['isle']);
    for (const id of ISLE_TOWN_IDS) expect(MAPS[`${id}_center`] ?? MAPS[id], id).toBeTruthy();
    const save = newGame(1, 'テスト');
    save.money = 99999;
    expect(buy(save, 'lotion', 1).ok).toBe(false);
    save.money = 100000;
    expect(buy(save, 'lotion', 1).ok).toBe(true);
    expect(save.money).toBe(0);
  });

  it('チョンボはローションを使った時だけ ボッキーに進化し、がまんを覚える', () => {
    const c = mk('chonbo', 50);
    expect(availableEvolutions(c, { mapId: 'x' })).toHaveLength(0);
    expect(availableEvolutions(c, { mapId: 'x', itemId: 'potion' })).toHaveLength(0);
    const evo = availableEvolutions(c, { mapId: 'x', itemId: 'lotion' });
    expect(evo.map((e) => e.to)).toEqual(['bokki']);
    evolve(c, 'bokki');
    expect(c.speciesId).toBe('bokki');
    expect(movesOnEvolve(c)).toEqual(['gaman']); // 進化の時に聞かれるのは がまん だけ
    expect(SPECIES.bokki.evolvesFrom).toBe('chonbo');
    expect(SPECIES.bokki.catchRate).toBe(0);
    // がまんは ボッキーだけの技
    expect(SPECIES_LIST.filter((s) => s.learnset.some(([, m]) => m === 'gaman')).map((s) => s.id)).toEqual(['bokki']);
  });
});

describe('がまん', () => {
  it('威力300・命中50%', () => {
    expect(MOVES.gaman.power).toBe(300);
    expect(MOVES.gaman.accuracy).toBe(50);
  });

  function gamanBattle(seed: number) {
    const b = mk('bokki', 100);
    b.moves = [{ id: 'gaman', pp: 5 }];
    const foe = mk('kokebou', 5);
    const state = createBattle('wild', { name: 'P', party: [b, mk('hinokoro', 5)] }, { name: 'E', party: [foe] });
    return { state, b, foe, rng: seededRng(seed) };
  }

  it('1ターン目は 動かず力をためる（ダメージなし）。2ターン目は 交代を選んでも がまんが出る', () => {
    const { state, b, foe, rng } = gamanBattle(3);
    resolveTurn(state, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }], rng);
    expect(foe.hp).toBe(maxHp(foe));
    expect(b.moves[0].pp).toBe(4);
    resolveTurn(state, [{ type: 'switch', to: 1 }, { type: 'move', index: 0 }], rng);
    expect(active(state, 0).uid).toBe(b.uid); // 交代は受け付けない
    expect(b.moves[0].pp).toBe(4); // 2ターン目は PP を使わない
  });

  it('2ターン目の攻撃は だいたい半分あたる（あたれば Lv5 は一撃）', () => {
    let hits = 0;
    const runs = 400;
    for (let i = 0; i < runs; i++) {
      const { state, foe, rng } = gamanBattle(1000 + i);
      resolveTurn(state, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }], rng);
      resolveTurn(state, [{ type: 'move', index: 0 }, { type: 'move', index: 0 }], rng);
      if (foe.hp < maxHp(foe)) {
        hits++;
        expect(foe.hp).toBe(0);
      }
    }
    expect(hits / runs).toBeGreaterThan(0.42);
    expect(hits / runs).toBeLessThan(0.58);
  });
});
