import { describe, expect, it } from 'vitest';
import type { MonsterInstance } from '../src/core/types';
import { effectiveness } from '../src/data/elements';
import { MAPS, isWalkableTile, tileAt } from '../src/data/maps';
import { MOVES } from '../src/data/moves';
import { SCRIPTS, type Cmd } from '../src/data/scripts';
import { SPECIES, SPECIES_LIST } from '../src/data/species';
import { TRAINERS } from '../src/data/trainers';
import { ITEMS } from '../src/data/items';
import { QUESTS } from '../src/data/quests';
import { SHOPS } from '../src/data/shops';
import { active, aiChooseMove, calcDamage, createBattle, resolveTurn, switchAfterFaint } from '../src/logic/battle';
import { captureChance, rollCapture } from '../src/logic/capture';
import { expForLevel, expYield, levelForExp } from '../src/logic/exp';
import { addMonster, buy, dexCounts, giveNewMonster, moveToBox, newGame, sell, swapPartyBox, updateQuests } from '../src/logic/game';
import { availableEvolutions, createMonster, evolve, grantExp, learnMove } from '../src/logic/monster';
import { fixedRng, seededRng } from '../src/logic/rng';
import { maxHp, statsOf } from '../src/logic/stats';

const ivs0 = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
let n = 0;
const mk = (sp: string, lv: number, ivs = ivs0): MonsterInstance => createMonster(sp, lv, seededRng(1), { uid: `t${n++}`, caughtAt: 'test', ivs });

describe('データの整合性', () => {
  it('全モンスターの技・進化先が存在する', () => {
    for (const s of SPECIES_LIST) {
      for (const [, id] of s.learnset) expect(MOVES[id], `${s.id} の技 ${id}`).toBeTruthy();
      for (const e of s.evolutions ?? []) {
        expect(SPECIES[e.to], `${s.id} の進化先 ${e.to}`).toBeTruthy();
        expect(SPECIES[e.to].evolvesFrom).toBe(s.id);
      }
    }
    const nos = SPECIES_LIST.map((s) => s.dexNo);
    expect(new Set(nos).size).toBe(nos.length);
  });
  it('マップの行の長さがそろい、ワープ・NPC・調べる物が正しい位置にある', () => {
    for (const m of Object.values(MAPS)) {
      const w = m.tiles[0].length;
      m.tiles.forEach((row, y) => expect(row.length, `${m.id} の ${y} 行目`).toBe(w));
      for (const wp of m.warps) {
        const dest = MAPS[wp.to.mapId];
        expect(dest, `${m.id} のワープ先`).toBeTruthy();
        expect(isWalkableTile(tileAt(dest, wp.to.x, wp.to.y), true), `${m.id}→${dest.id} (${wp.to.x},${wp.to.y}) に立てる`).toBe(true);
        expect(isWalkableTile(tileAt(m, wp.x, wp.y), true), `${m.id} のワープ元 (${wp.x},${wp.y})`).toBe(true);
      }
      for (const npc of m.npcs) expect(isWalkableTile(tileAt(m, npc.x, npc.y), true), `${m.id} の ${npc.id}`).toBe(true);
      for (const o of m.objects) {
        if (o.kind === 'hidden') expect(isWalkableTile(tileAt(m, o.x, o.y), true), `${m.id} の ${o.id}`).toBe(true);
        else {
          const ch = tileAt(m, o.x, o.y);
          expect(isWalkableTile(ch, true) || 'SCLPKO'.includes(ch), `${m.id} の ${o.id} の位置 (${ch})`).toBe(true);
        }
        if (o.item) expect(ITEMS[o.item[0]]).toBeTruthy();
      }
      for (const e of m.encounters?.table ?? []) expect(SPECIES[e.speciesId]).toBeTruthy();
      for (const npc of m.npcs) {
        for (const t of npc.talk) expect(SCRIPTS[t.script], `台本 ${t.script}`).toBeTruthy();
        if (npc.trainerId) expect(TRAINERS[npc.trainerId]).toBeTruthy();
      }
    }
  });
  it('台本が参照するアイテム・トレーナー・ショップが存在する', () => {
    const walk = (cmds: Cmd[]) => {
      for (const c of cmds) {
        if ('give' in c) expect(ITEMS[c.give[0]], c.give[0]).toBeTruthy();
        if ('trainer' in c) {
          expect(TRAINERS[c.trainer]).toBeTruthy();
          walk(c.win ?? []);
          walk(c.lose ?? []);
        }
        if ('boss' in c) {
          expect(SPECIES[c.boss.speciesId]).toBeTruthy();
          walk(c.win ?? []);
        }
        if ('shop' in c) expect(SHOPS[c.shop]).toBeTruthy();
        if ('choice' in c) c.options.forEach((o) => walk(o.then));
        if ('if' in c) {
          walk(c.then);
          walk(c.else ?? []);
        }
      }
    };
    Object.values(SCRIPTS).forEach(walk);
    for (const q of Object.values(QUESTS)) for (const [id] of q.reward.items ?? []) expect(ITEMS[id]).toBeTruthy();
  });
});

describe('属性相性', () => {
  it('倍率が正しく計算される', () => {
    expect(effectiveness('blaze', ['sprout'])).toBe(2);
    expect(effectiveness('blaze', ['tide'])).toBe(0.5);
    expect(effectiveness('tide', ['blaze', 'stone'])).toBe(4);
    expect(effectiveness('sprout', ['sprout', 'stone'])).toBe(1);
    expect(effectiveness('neutral', ['gale'])).toBe(1);
    expect(effectiveness('shine', ['shade'])).toBe(2);
    expect(effectiveness('shade', ['shine'])).toBe(2);
  });
  it('0倍（完全無効）は存在しない', () => {
    const els = ['neutral', 'blaze', 'tide', 'sprout', 'volt', 'stone', 'gale', 'shine', 'shade'] as const;
    for (const a of els) for (const d of els) expect(effectiveness(a, [d])).toBeGreaterThan(0);
  });
});

describe('経験値とレベル', () => {
  it('必要経験値とレベルが対応している', () => {
    expect(expForLevel(1)).toBe(0);
    expect(expForLevel(5)).toBe(100);
    expect(levelForExp(100)).toBe(5);
    expect(levelForExp(99)).toBe(4);
    for (let lv = 2; lv <= 60; lv++) expect(expForLevel(lv)).toBeGreaterThan(expForLevel(lv - 1));
  });
  it('格上ほど多く、格下ほど少ない経験値になる', () => {
    expect(expYield(60, 10, 5, false)).toBeGreaterThan(expYield(60, 5, 5, false));
    expect(expYield(60, 3, 20, false)).toBeLessThan(expYield(60, 3, 3, false));
    expect(expYield(60, 5, 5, true)).toBeGreaterThan(expYield(60, 5, 5, false));
  });
  it('レベルアップで能力が上がり、技を覚える', () => {
    const m = mk('hinokoro', 3);
    const atk = statsOf(m).atk;
    const r = grantExp(m, expForLevel(5) - m.exp);
    expect(m.level).toBe(5);
    expect(r.levels).toEqual([4, 5]);
    expect(r.learned).toContain('ember');
    expect(statsOf(m).atk).toBeGreaterThan(atk);
  });
  it('技が4つの時は保留になり、入れ替えできる', () => {
    const m = mk('hinokoro', 12);
    expect(m.moves.length).toBe(4);
    const r = grantExp(m, expForLevel(13) - m.exp);
    expect(r.pending).toContain('flame_fang');
    expect(learnMove(m, 'flame_fang', 0)).toBe(true);
    expect(m.moves[0].id).toBe('flame_fang');
    expect(learnMove(m, 'flame_fang', 1)).toBe(false);
  });
});

describe('進化', () => {
  it('レベル進化の条件を判定できる', () => {
    const m = mk('hinokoro', 13);
    expect(availableEvolutions(m, { mapId: 'grassland' })).toHaveLength(0);
    grantExp(m, expForLevel(14) - m.exp);
    expect(availableEvolutions(m, { mapId: 'grassland' }).map((e) => e.to)).toEqual(['kagurabi']);
    m.hp = 5;
    const hpLost = maxHp(m) - m.hp;
    evolve(m, 'kagurabi');
    expect(m.speciesId).toBe('kagurabi');
    expect(m.history).toEqual(['hinokoro', 'kagurabi']);
    expect(maxHp(m) - m.hp).toBe(hpLost);
  });
  it('フワモは条件によって3つに分岐する', () => {
    const a = mk('fuwamo', 6);
    expect(availableEvolutions(a, { mapId: 'grassland', itemId: 'dawn_stone' }).map((e) => e.to)).toEqual(['hikariwata']);
    expect(availableEvolutions(a, { mapId: 'grassland' })).toHaveLength(0);
    const b = mk('fuwamo', 16);
    b.moves = b.moves.filter((m) => m.id !== 'whirlwind_step');
    expect(availableEvolutions(b, { mapId: 'grassland' })).toHaveLength(0);
    expect(availableEvolutions(b, { mapId: 'firefly_forest' }).map((e) => e.to)).toEqual(['kagewata']);
    const c = mk('fuwamo', 16);
    expect(c.moves.some((m) => m.id === 'whirlwind_step')).toBe(true);
    expect(availableEvolutions(c, { mapId: 'grassland' }).map((e) => e.to)).toEqual(['kazewata']);
    expect(availableEvolutions(c, { mapId: 'firefly_forest' }).map((e) => e.to).sort()).toEqual(['kagewata', 'kazewata']);
    evolve(c, 'kazewata');
    expect(c.speciesId).toBe('kazewata');
    expect(() => evolve(c, 'hikariwata')).toThrow();
  });
});

describe('バトル', () => {
  it('技でダメージを与え、相性で倍率が変わる', () => {
    const fire = mk('hinokoro', 10);
    const grass = mk('mebukin', 10);
    const water = mk('shizukun', 10);
    const b1 = createBattle('wild', { name: 'p', party: [fire] }, { name: 'e', party: [grass] });
    const b2 = createBattle('wild', { name: 'p', party: [fire] }, { name: 'e', party: [water] });
    const rng = () => fixedRng([0.99, 0.5]);
    const d1 = calcDamage(b1, 0, MOVES.ember, rng());
    const d2 = calcDamage(b2, 0, MOVES.ember, rng());
    expect(d1.eff).toBe(2);
    expect(d2.eff).toBe(0.5);
    expect(d1.damage).toBeGreaterThan(d2.damage * 2);
  });
  it('1ターン処理でPPが減り、HPが減る', () => {
    const p = mk('hinokoro', 8);
    const e = mk('piricchi', 5);
    const b = createBattle('wild', { name: 'p', party: [p] }, { name: 'e', party: [e] });
    const idx = p.moves.findIndex((m) => m.id === 'ember');
    const pp = p.moves[idx].pp;
    const before = e.hp;
    const ev = resolveTurn(b, [{ type: 'move', index: idx }, { type: 'move', index: 0 }], fixedRng([0.5, 0.1, 0.99, 0.5, 0.99], 0.5));
    expect(p.moves[idx].pp).toBe(pp - 1);
    expect(e.hp).toBeLessThan(before);
    expect(ev.some((x) => x.t === 'move')).toBe(true);
  });
  it('状態異常の技が効く', () => {
    const p = mk('piricchi', 12);
    const e = mk('koishimo', 12);
    const b = createBattle('wild', { name: 'p', party: [p] }, { name: 'e', party: [e] });
    const idx = p.moves.findIndex((m) => m.id === 'jolt_wave');
    expect(idx).toBeGreaterThanOrEqual(0);
    resolveTurn(b, [{ type: 'move', index: idx }, { type: 'move', index: 1 }], fixedRng([0.1], 0.1));
    expect(e.status).toBe('paralyze');
  });
  it('補助技で能力ランクが上がる', () => {
    const p = mk('koishimo', 15);
    const e = mk('piricchi', 3);
    const b = createBattle('wild', { name: 'p', party: [p] }, { name: 'e', party: [e] });
    const idx = p.moves.findIndex((m) => m.id === 'iron_shell');
    resolveTurn(b, [{ type: 'move', index: idx }, { type: 'move', index: 0 }], seededRng(2));
    expect(b.sides[0].stages.def).toBe(2);
  });
  it('倒すと経験値が入り、勝利になる', () => {
    const p = mk('hinokoro', 20);
    const e = mk('piricchi', 2);
    const b = createBattle('wild', { name: 'p', party: [p] }, { name: 'e', party: [e] });
    const exp = p.exp;
    let guard = 0;
    while (!b.result && guard++ < 20) resolveTurn(b, [{ type: 'move', index: p.moves.findIndex((m) => m.id === 'flame_fang') }, { type: 'move', index: 0 }], seededRng(guard));
    expect(b.result).toBe('win');
    expect(p.exp).toBeGreaterThan(exp);
  });
  it('交代でき、倒れた後は交代先を選ぶ必要がある', () => {
    const a = mk('mebukin', 5);
    const c = mk('shizukun', 5);
    const e = mk('hinokoro', 30);
    const b = createBattle('trainer', { name: 'p', party: [a, c] }, { name: 'e', party: [e] });
    resolveTurn(b, [{ type: 'switch', to: 1 }, { type: 'move', index: 0 }], seededRng(1));
    expect(active(b, 0).uid).toBe(c.uid);
    c.hp = 1;
    let guard = 0;
    while (!b.needsSwitch[0] && !b.result && guard++ < 10) resolveTurn(b, [{ type: 'move', index: 0 }, aiChooseMove(b, 1, seededRng(guard))], seededRng(guard));
    expect(b.needsSwitch[0]).toBe(true);
    switchAfterFaint(b, 0, 0);
    expect(active(b, 0).uid).toBe(a.uid);
    expect(b.needsSwitch[0]).toBe(false);
  });
  it('全員倒れると負けになる', () => {
    const a = mk('piricchi', 2);
    const e = mk('kagurabi', 30);
    const b = createBattle('trainer', { name: 'p', party: [a] }, { name: 'e', party: [e] });
    let guard = 0;
    while (!b.result && guard++ < 10) resolveTurn(b, [{ type: 'move', index: 0 }, aiChooseMove(b, 1, seededRng(guard))], seededRng(guard));
    expect(b.result).toBe('lose');
  });
  it('道具で回復できる', () => {
    const a = mk('shizukun', 10);
    a.hp = 5;
    const e = mk('piricchi', 2);
    const b = createBattle('wild', { name: 'p', party: [a] }, { name: 'e', party: [e] });
    resolveTurn(b, [{ type: 'item', itemId: 'potion', target: 0 }, { type: 'move', index: 0 }], fixedRng([0.99]));
    expect(a.hp).toBeGreaterThan(5);
  });
  it('トレーナー戦では逃げられない', () => {
    const a = mk('shizukun', 10);
    const e = mk('piricchi', 2);
    const b = createBattle('trainer', { name: 'p', party: [a] }, { name: 'e', party: [e] });
    resolveTurn(b, [{ type: 'run' }, { type: 'move', index: 0 }], seededRng(1));
    expect(b.result).not.toBe('run');
  });
});

describe('捕獲', () => {
  it('HPが少ないほど・状態異常・良いランタンほど捕まえやすい', () => {
    const m = mk('piricchi', 5);
    const full = captureChance(m, 1);
    m.hp = 1;
    const low = captureChance(m, 1);
    expect(low).toBeGreaterThan(full);
    m.status = 'sleep';
    expect(captureChance(m, 1)).toBeGreaterThan(low);
    m.status = null;
    expect(captureChance(m, 2.2)).toBeGreaterThan(low);
  });
  it('捕獲率0のボスは捕まえられない', () => {
    const boss = mk('hotarunoou', 16);
    boss.hp = 1;
    expect(captureChance(boss, 2.2)).toBe(0);
    expect(rollCapture(boss, 2.2, seededRng(1)).success).toBe(false);
  });
  it('成功確率が理論値どおりになる（統計）', () => {
    const m = mk('koishimo', 5);
    m.hp = Math.floor(maxHp(m) / 2);
    const p = captureChance(m, 1);
    const rng = seededRng(42);
    let ok = 0;
    const N = 20000;
    for (let i = 0; i < N; i++) if (rollCapture(m, 1, rng).success) ok++;
    expect(Math.abs(ok / N - p)).toBeLessThan(0.02);
  });
  it('野生戦で捕まえると captured になり、セーブデータと図鑑に加わる', () => {
    const save = newGame(1, 'テスト');
    giveNewMonster(save, 'hinokoro', 5, seededRng(1), 'test');
    const wild = mk('piricchi', 3);
    wild.hp = 1;
    const b = createBattle('wild', { name: 'p', party: save.party }, { name: 'e', party: [wild] });
    resolveTurn(b, [{ type: 'capture', itemId: 'sun_lantern' }, { type: 'move', index: 0 }], fixedRng([0, 0, 0, 0]));
    expect(b.result).toBe('captured');
    expect(addMonster(save, b.captured!)).toBe('party');
    expect(save.dex.piricchi).toBe('caught');
    expect(dexCounts(save).caught).toBe(2);
  });
});

describe('パーティー・道具・クエスト', () => {
  it('パーティーは3体まで、超えたらボックスへ', () => {
    const save = newGame(1, 'テスト');
    for (const sp of ['hinokoro', 'piricchi', 'koishimo', 'fuwamo']) giveNewMonster(save, sp, 5, seededRng(1), 'test');
    expect(save.party).toHaveLength(3);
    expect(save.box).toHaveLength(1);
    expect(swapPartyBox(save, 0, 0).ok).toBe(true);
    expect(save.party[0].speciesId).toBe('fuwamo');
    expect(moveToBox(save, 0).ok).toBe(true);
    expect(moveToBox(save, 0).ok).toBe(true);
    expect(moveToBox(save, 0).ok).toBe(false);
  });
  it('戦える仲間が0になる入れ替えはできない', () => {
    const save = newGame(1, 'テスト');
    giveNewMonster(save, 'hinokoro', 5, seededRng(1), 'test');
    giveNewMonster(save, 'piricchi', 5, seededRng(1), 'test');
    save.party[1].hp = 0;
    expect(moveToBox(save, 0).ok).toBe(false);
  });
  it('買い物と売却でお金が正しく増減する', () => {
    const save = newGame(1, 'テスト');
    expect(buy(save, 'potion', 2).ok).toBe(true);
    expect(save.money).toBe(600);
    expect(buy(save, 'super_potion', 5).ok).toBe(false);
    expect(sell(save, 'potion', 1).gained).toBe(100);
    expect(save.items.potion).toBe(1);
    expect(buy(save, 'dawn_stone', 1).ok).toBe(false);
  });
  it('クエストは条件で受注・達成し、報酬は1回だけ', () => {
    const save = newGame(1, 'テスト');
    updateQuests(save);
    expect(save.quests.main_1.state).toBe('active');
    expect(save.quests.main_2).toBeUndefined();
    save.flags.rival1_done = true;
    const n1 = updateQuests(save);
    expect(n1.some((x) => x.questId === 'main_1' && x.kind === 'completed')).toBe(true);
    expect(save.quests.main_2.state).toBe('active');
    const potions = save.items.potion;
    updateQuests(save);
    expect(save.items.potion).toBe(potions);
  });
});
