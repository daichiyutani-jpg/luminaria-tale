/**
 * ターン制バトルの処理本体（画面とは独立）。
 * 一人プレイと対人戦で同じ処理を使う。乱数は外から渡すので、対人戦では両者で同じシードを使えば同じ結果になる。
 *
 * 画面側は resolveTurn() が返すイベント列を順に再生するだけでよい。
 */
import type { MonsterInstance, MoveDef, StageKey, StatusId } from '../core/types';
import { effectiveness, STAB } from '../data/elements';
import { getItem } from '../data/items';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import { rollCapture } from './capture';
import { expYield } from './exp';
import { displayName, grantExp } from './monster';
import { chance, type Rng } from './rng';
import { maxHp, statsOf } from './stats';

export type BattleKind = 'wild' | 'trainer' | 'boss' | 'pvp';
export type SideIndex = 0 | 1;
export type BattleResult = 'win' | 'lose' | 'run' | 'captured';

export type Stages = Record<StageKey, number>;
const emptyStages = (): Stages => ({ atk: 0, def: 0, spa: 0, spd: 0, spe: 0, acc: 0 });

export interface BattleSide {
  name: string;
  party: MonsterInstance[];
  active: number;
  stages: Stages;
  /** 「かたくなる」の残りターン（0 で効果なし） */
  guard?: number;
}

export interface BattleState {
  kind: BattleKind;
  sides: [BattleSide, BattleSide];
  turn: number;
  result: BattleResult | null;
  /** たおれて交代先を選ぶ必要がある側 */
  needsSwitch: [boolean, boolean];
  runAttempts: number;
  /** 今の相手と戦った味方のUID（経験値の分配に使う） */
  participants: string[];
  /** 技が4つで覚えられなかった技（戦闘後に入れ替えを確認する） */
  pendingMoves: { uid: string; moveId: string }[];
  /** 捕まえたモンスター */
  captured: MonsterInstance | null;
  /** 戦闘中にレベルが上がった味方 */
  leveledUp: string[];
}

export type Action =
  | { type: 'move'; index: number }
  | { type: 'switch'; to: number }
  | { type: 'item'; itemId: string; target: number }
  | { type: 'capture'; itemId: string }
  | { type: 'run' };

export type BattleEvent =
  | { t: 'msg'; text: string }
  | { t: 'move'; side: SideIndex; moveId: string }
  | { t: 'hp'; side: SideIndex; hp: number; max: number; crit?: boolean; eff?: number }
  | { t: 'faint'; side: SideIndex }
  | { t: 'send'; side: SideIndex; index: number }
  | { t: 'status'; side: SideIndex; status: StatusId | null }
  | { t: 'stage'; side: SideIndex; stat: StageKey; delta: number }
  | { t: 'capture'; shakes: number; success: boolean }
  | { t: 'exp'; uid: string; amount: number }
  | { t: 'levelup'; uid: string; level: number }
  | { t: 'end'; result: BattleResult };

export const STATUS_NAME: Record<StatusId, string> = { burn: 'やけど', poison: 'どく', paralyze: 'まひ', sleep: 'ねむり', mist: 'かすみ' };
const STAGE_NAME: Record<StageKey, string> = { atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ', acc: 'めいちゅう' };

export function createBattle(kind: BattleKind, player: { name: string; party: MonsterInstance[] }, enemy: { name: string; party: MonsterInstance[] }): BattleState {
  const firstAlive = (p: MonsterInstance[]) => Math.max(0, p.findIndex((m) => m.hp > 0));
  const state: BattleState = {
    kind,
    sides: [
      { name: player.name, party: player.party, active: firstAlive(player.party), stages: emptyStages() },
      { name: enemy.name, party: enemy.party, active: firstAlive(enemy.party), stages: emptyStages() },
    ],
    turn: 0,
    result: null,
    needsSwitch: [false, false],
    runAttempts: 0,
    participants: [],
    pendingMoves: [],
    captured: null,
    leveledUp: [],
  };
  state.participants = [active(state, 0).uid];
  return state;
}

export function active(state: BattleState, side: SideIndex): MonsterInstance {
  const s = state.sides[side];
  return s.party[s.active];
}

export const canRun = (s: BattleState) => s.kind === 'wild';
export const canCapture = (s: BattleState) => s.kind === 'wild';

function stageMult(stage: number): number {
  return stage >= 0 ? (2 + stage) / 2 : 2 / (2 - stage);
}
function accMult(stage: number): number {
  return stage >= 0 ? (3 + stage) / 3 : 3 / (3 - stage);
}

export function effectiveSpeed(state: BattleState, side: SideIndex): number {
  const mon = active(state, side);
  let spe = statsOf(mon).spe * stageMult(state.sides[side].stages.spe);
  if (mon.status === 'paralyze') spe *= 0.5;
  return spe;
}

/** 使える技（PPが残っている技）。無ければわるあがき */
export function usableMoves(mon: MonsterInstance): number[] {
  return mon.moves.map((m, i) => (m.pp > 0 ? i : -1)).filter((i) => i >= 0);
}

const sideName = (state: BattleState, side: SideIndex) => {
  const mon = active(state, side);
  if (side === 0) return displayName(mon);
  return state.kind === 'wild' || state.kind === 'boss' ? `やせいの ${displayName(mon)}` : `あいての ${displayName(mon)}`;
};

export interface DamageCalc {
  damage: number;
  eff: number;
  crit: boolean;
}

export function calcDamage(state: BattleState, atkSide: SideIndex, move: MoveDef, rng: Rng): DamageCalc {
  const defSide: SideIndex = atkSide === 0 ? 1 : 0;
  const attacker = active(state, atkSide);
  const defender = active(state, defSide);
  const a = statsOf(attacker);
  const d = statsOf(defender);
  const physical = move.category === 'physical';
  const atkStat = (physical ? a.atk : a.spa) * stageMult(state.sides[atkSide].stages[physical ? 'atk' : 'spa']);
  const defStat = (physical ? d.def : d.spd) * stageMult(state.sides[defSide].stages[physical ? 'def' : 'spd']);
  const eff = effectiveness(move.element, getSpecies(defender.speciesId).elements);
  const stab = getSpecies(attacker.speciesId).elements.includes(move.element) ? STAB : 1;
  const crit = chance(rng, move.effect?.highCrit ? 100 / 6 : 100 / 16);
  const random = 0.85 + rng.next() * 0.15;
  const burn = physical && attacker.status === 'burn' ? 0.5 : 1;
  const base = Math.floor(Math.floor((Math.floor((2 * attacker.level) / 5 + 2) * move.power * atkStat) / Math.max(1, defStat)) / 50) + 2;
  const damage = Math.max(1, Math.floor(base * stab * eff * random * (crit ? 1.5 : 1) * burn));
  return { damage, eff, crit };
}

function applyStatus(state: BattleState, side: SideIndex, status: StatusId, rng: Rng, ev: BattleEvent[], fromMove: boolean): boolean {
  const mon = active(state, side);
  if (mon.hp <= 0) return false;
  if (mon.status) {
    if (fromMove) ev.push({ t: 'msg', text: `${sideName(state, side)}は すでに ${STATUS_NAME[mon.status]}状態だ。` });
    return false;
  }
  // 同じ属性の状態異常にはかかりにくい
  const els = getSpecies(mon.speciesId).elements;
  if ((status === 'burn' && els.includes('blaze')) || (status === 'paralyze' && els.includes('volt')) || (status === 'poison' && els.includes('sprout'))) {
    if (fromMove) ev.push({ t: 'msg', text: `${sideName(state, side)}には きかなかった。` });
    return false;
  }
  mon.status = status;
  if (status === 'sleep') mon.sleepTurns = 1 + Math.floor(rng.next() * 3);
  ev.push({ t: 'status', side, status });
  const verb: Record<StatusId, string> = { burn: 'やけどを おった！', poison: 'どくに おかされた！', paralyze: 'まひして うごきにくくなった！', sleep: 'ねむってしまった！', mist: 'かすみに つつまれた！' };
  ev.push({ t: 'msg', text: `${sideName(state, side)}は ${verb[status]}` });
  return true;
}

function applyStages(state: BattleState, side: SideIndex, stages: Partial<Record<StageKey, number>>, ev: BattleEvent[]): void {
  for (const [k, delta] of Object.entries(stages) as [StageKey, number][]) {
    const cur = state.sides[side].stages[k];
    const next = Math.max(-6, Math.min(6, cur + delta));
    if (next === cur) {
      ev.push({ t: 'msg', text: `${sideName(state, side)}の ${STAGE_NAME[k]}は もう かわらない！` });
      continue;
    }
    state.sides[side].stages[k] = next;
    ev.push({ t: 'stage', side, stat: k, delta: next - cur });
    const word = Math.abs(delta) >= 2 ? (delta > 0 ? 'ぐーんと あがった！' : 'がくっと さがった！') : delta > 0 ? 'あがった！' : 'さがった！';
    ev.push({ t: 'msg', text: `${sideName(state, side)}の ${STAGE_NAME[k]}が ${word}` });
  }
}

function setHp(state: BattleState, side: SideIndex, hp: number, ev: BattleEvent[], extra?: { crit?: boolean; eff?: number }): void {
  const mon = active(state, side);
  const max = maxHp(mon);
  mon.hp = Math.max(0, Math.min(max, Math.round(hp)));
  ev.push({ t: 'hp', side, hp: mon.hp, max, ...extra });
}

function executeMove(state: BattleState, side: SideIndex, moveIndex: number, rng: Rng, ev: BattleEvent[]): void {
  const user = active(state, side);
  const foe: SideIndex = side === 0 ? 1 : 0;
  if (user.hp <= 0) return;

  // 行動前の状態異常
  if (user.status === 'sleep') {
    if ((user.sleepTurns ?? 0) <= 0) {
      user.status = null;
      ev.push({ t: 'status', side, status: null });
      ev.push({ t: 'msg', text: `${sideName(state, side)}は めをさました！` });
    } else {
      user.sleepTurns = (user.sleepTurns ?? 1) - 1;
      ev.push({ t: 'msg', text: `${sideName(state, side)}は ぐうぐう ねむっている。` });
      return;
    }
  }
  if (user.status === 'paralyze' && chance(rng, 25)) {
    ev.push({ t: 'msg', text: `${sideName(state, side)}は からだが しびれて うごけない！` });
    return;
  }

  const slot = user.moves[moveIndex];
  const move = slot && slot.pp > 0 ? getMove(slot.id) : getMove('struggle');
  if (slot && slot.pp > 0) slot.pp--;
  ev.push({ t: 'move', side, moveId: move.id });
  ev.push({ t: 'msg', text: `${sideName(state, side)}の ${move.name}！` });

  const targetSide: SideIndex = move.target === 'self' ? side : foe;
  // 相手が「かたくなる」の間は、相手に向けた技は効かない
  if (move.target === 'enemy' && (state.sides[foe].guard ?? 0) > 0) {
    ev.push({ t: 'msg', text: `${sideName(state, foe)}は かたくなっていて こうげきを うけつけない！` });
    return;
  }
  // 命中判定（自分が対象の技と必中技は外れない）
  if (move.target === 'enemy' && move.accuracy <= 100) {
    let acc = move.accuracy * accMult(state.sides[side].stages.acc);
    if (user.status === 'mist') acc *= 0.75;
    if (!chance(rng, acc)) {
      ev.push({ t: 'msg', text: 'しかし こうげきは はずれた！' });
      return;
    }
  }

  const eff = move.effect;
  if (move.category !== 'status') {
    const calc = calcDamage(state, side, move, rng);
    const target = active(state, foe);
    const dealt = Math.min(target.hp, calc.damage);
    setHp(state, foe, target.hp - calc.damage, ev, { crit: calc.crit, eff: calc.eff });
    if (calc.crit) ev.push({ t: 'msg', text: 'きゅうしょに あたった！' });
    if (calc.eff > 1) ev.push({ t: 'msg', text: 'こうかは ばつぐんだ！' });
    else if (calc.eff < 1) ev.push({ t: 'msg', text: 'こうかは いまひとつのようだ……' });
    if (eff?.drain && dealt > 0) {
      setHp(state, side, user.hp + Math.max(1, Math.floor(dealt * eff.drain)), ev);
      ev.push({ t: 'msg', text: `${sideName(state, foe)}から たいりょくを すいとった！` });
    }
    if (eff?.recoil && dealt > 0) {
      setHp(state, side, user.hp - Math.max(1, Math.floor(dealt * eff.recoil)), ev);
      ev.push({ t: 'msg', text: `${sideName(state, side)}は はんどうを うけた！` });
    }
    // 追加効果
    if (eff && target.hp > 0) {
      const p = eff.chance ?? 100;
      if (eff.status && chance(rng, p)) applyStatus(state, foe, eff.status, rng, ev, false);
      if (eff.stages && chance(rng, p)) applyStages(state, eff.stageTarget === 'self' ? side : foe, eff.stages, ev);
    } else if (eff?.stages && eff.stageTarget === 'self' && user.hp > 0 && chance(rng, eff.chance ?? 100)) {
      applyStages(state, side, eff.stages, ev);
    }
    return;
  }

  // 補助技
  let did = false;
  if (eff?.guard) {
    if ((state.sides[side].guard ?? 0) > 0) {
      ev.push({ t: 'msg', text: 'しかし もう かたくなっている！' });
      return;
    }
    state.sides[side].guard = eff.guard;
    ev.push({ t: 'msg', text: `${sideName(state, side)}は かちかちに かたくなった！ ${eff.guard}ターンのあいだ こうげきを うけつけない！` });
    did = true;
  }
  if (eff?.heal) {
    const max = maxHp(user);
    if (user.hp < max) {
      setHp(state, side, user.hp + Math.floor(max * eff.heal), ev);
      ev.push({ t: 'msg', text: `${sideName(state, side)}の たいりょくが かいふくした！` });
      did = true;
    }
  }
  if (eff?.cureSelf && user.status) {
    user.status = null;
    ev.push({ t: 'status', side, status: null });
    ev.push({ t: 'msg', text: `${sideName(state, side)}の じょうたいいじょうが なおった！` });
    did = true;
  }
  if (eff?.status) {
    applyStatus(state, targetSide, eff.status, rng, ev, true);
    did = true;
  }
  if (eff?.stages) {
    applyStages(state, eff.stageTarget === 'self' ? side : eff.stageTarget === 'enemy' ? foe : targetSide, eff.stages, ev);
    did = true;
  }
  if (!did) ev.push({ t: 'msg', text: 'しかし なにも おこらなかった。' });
}

function endOfTurnStatus(state: BattleState, side: SideIndex, ev: BattleEvent[]): void {
  const mon = active(state, side);
  if (mon.hp <= 0) return;
  const max = maxHp(mon);
  if (mon.status === 'burn') {
    setHp(state, side, mon.hp - Math.max(1, Math.floor(max / 16)), ev);
    ev.push({ t: 'msg', text: `${sideName(state, side)}は やけどの ダメージを うけた！` });
  } else if (mon.status === 'poison') {
    setHp(state, side, mon.hp - Math.max(1, Math.floor(max / 8)), ev);
    ev.push({ t: 'msg', text: `${sideName(state, side)}は どくの ダメージを うけた！` });
  }
}

const alive = (party: MonsterInstance[]) => party.filter((m) => m.hp > 0).length;

/** たおれたモンスターの処理。経験値・勝敗・交代の要否を決める */
function handleFaints(state: BattleState, ev: BattleEvent[]): void {
  for (const side of [1, 0] as SideIndex[]) {
    const mon = active(state, side);
    if (mon.hp > 0 || state.needsSwitch[side]) continue;
    ev.push({ t: 'faint', side });
    ev.push({ t: 'msg', text: `${sideName(state, side)}は たおれた！` });
    if (side === 1 && state.kind !== 'pvp') awardExp(state, mon, ev);
    if (alive(state.sides[side].party) > 0) state.needsSwitch[side] = true;
  }
  if (alive(state.sides[1].party) === 0) finish(state, 'win', ev);
  else if (alive(state.sides[0].party) === 0) finish(state, 'lose', ev);
}

function awardExp(state: BattleState, enemy: MonsterInstance, ev: BattleEvent[]): void {
  const receivers = state.sides[0].party.filter((m) => m.hp > 0 && state.participants.includes(m.uid));
  if (receivers.length === 0) return;
  const trainer = state.kind === 'trainer';
  const base = getSpecies(enemy.speciesId).baseExp;
  for (const mon of receivers) {
    const amount = Math.max(1, Math.floor(expYield(base, enemy.level, mon.level, trainer) / receivers.length));
    ev.push({ t: 'exp', uid: mon.uid, amount });
    ev.push({ t: 'msg', text: `${displayName(mon)}は ${amount} けいけんちを もらった！` });
    const res = grantExp(mon, amount);
    for (const lv of res.levels) {
      ev.push({ t: 'levelup', uid: mon.uid, level: lv });
      ev.push({ t: 'msg', text: `${displayName(mon)}は レベル${lv}に あがった！` });
    }
    if (res.levels.length && !state.leveledUp.includes(mon.uid)) state.leveledUp.push(mon.uid);
    for (const id of res.learned) ev.push({ t: 'msg', text: `${displayName(mon)}は ${getMove(id).name}を おぼえた！` });
    for (const id of res.pending) state.pendingMoves.push({ uid: mon.uid, moveId: id });
    // 経験値で最大HPが変わった場合、場に出ている味方のHP表示を合わせる
    if (active(state, 0).uid === mon.uid) ev.push({ t: 'hp', side: 0, hp: mon.hp, max: maxHp(mon) });
  }
  state.participants = [active(state, 0).uid].filter(() => active(state, 0).hp > 0);
}

function finish(state: BattleState, result: BattleResult, ev: BattleEvent[]): void {
  if (state.result) return;
  state.result = result;
  for (const side of state.sides) {
    side.stages = emptyStages();
    side.guard = 0;
  }
  ev.push({ t: 'end', result });
}

function doSwitch(state: BattleState, side: SideIndex, to: number, ev: BattleEvent[]): boolean {
  const s = state.sides[side];
  const target = s.party[to];
  if (!target || target.hp <= 0 || to === s.active) return false;
  if (!state.needsSwitch[side]) ev.push({ t: 'msg', text: side === 0 ? `もどれ、${displayName(active(state, side))}！` : `${s.name}は ${displayName(active(state, side))}を ひっこめた。` });
  s.active = to;
  s.stages = emptyStages();
  s.guard = 0;
  state.needsSwitch[side] = false;
  ev.push({ t: 'send', side, index: to });
  ev.push({ t: 'msg', text: side === 0 ? `いけっ、${displayName(target)}！` : `${s.name}は ${displayName(target)}を くりだした！` });
  if (side === 0 && !state.participants.includes(target.uid)) state.participants.push(target.uid);
  return true;
}

/** たおれた後の交代（ターンを消費しない） */
export function switchAfterFaint(state: BattleState, side: SideIndex, to: number): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (!state.needsSwitch[side]) return ev;
  doSwitch(state, side, to, ev);
  if (side === 1) state.participants = [active(state, 0).uid].filter(() => active(state, 0).hp > 0);
  return ev;
}

/** 敵（CPU）の交代先：相性が良く、残りHPが多いもの */
export function aiChooseSwitch(state: BattleState, side: SideIndex): number {
  const s = state.sides[side];
  const foe = active(state, side === 0 ? 1 : 0);
  const foeEls = getSpecies(foe.speciesId).elements;
  let best = -1;
  let bestScore = -Infinity;
  s.party.forEach((m, i) => {
    if (m.hp <= 0 || i === s.active) return;
    const mine = getSpecies(m.speciesId).elements;
    const offense = Math.max(...mine.map((e) => effectiveness(e, foeEls)));
    const defense = Math.max(...foeEls.map((e) => effectiveness(e, mine)));
    const score = offense * 2 - defense + m.hp / maxHp(m);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  });
  return best;
}

/** 敵（CPU）の技選び。ばつぐんを狙いつつ、補助技も状況に応じて使う */
export function aiChooseMove(state: BattleState, side: SideIndex, rng: Rng, smart = 0.75): Action {
  const me = active(state, side);
  const foe = active(state, side === 0 ? 1 : 0);
  const usable = usableMoves(me);
  if (usable.length === 0) return { type: 'move', index: 0 };
  const myEls = getSpecies(me.speciesId).elements;
  const foeEls = getSpecies(foe.speciesId).elements;
  const scores = usable.map((i) => {
    const mv = getMove(me.moves[i].id);
    const e = mv.effect;
    if (mv.category !== 'status') {
      const stab = myEls.includes(mv.element) ? STAB : 1;
      return mv.power * effectiveness(mv.element, foeEls) * stab * (Math.min(100, mv.accuracy) / 100);
    }
    if (e?.guard) return (state.sides[side].guard ?? 0) > 0 ? 0 : me.hp / maxHp(me) < 0.6 ? 90 : 30;
    if (e?.heal) return me.hp / maxHp(me) < 0.45 ? 120 : 5;
    if (e?.status) return foe.status ? 1 : 55;
    if (e?.stages) {
      const selfSide = e.stageTarget ? e.stageTarget === 'self' : mv.target === 'self';
      const tgt: SideIndex = selfSide ? side : side === 0 ? 1 : 0;
      const [k, v] = Object.entries(e.stages)[0] as [StageKey, number];
      const cur = state.sides[tgt].stages[k];
      return (v > 0 ? cur < 2 : cur > -2) ? 35 : 2;
    }
    return 10;
  });
  if (rng.next() < smart) {
    let bi = 0;
    scores.forEach((s, i) => {
      if (s > scores[bi]) bi = i;
    });
    return { type: 'move', index: usable[bi] };
  }
  return { type: 'move', index: usable[Math.floor(rng.next() * usable.length)] };
}

function priorityOf(state: BattleState, side: SideIndex, action: Action): number {
  if (action.type === 'run') return 10;
  if (action.type === 'switch' || action.type === 'item' || action.type === 'capture') return 6;
  const slot = active(state, side).moves[action.index];
  const mv = slot && slot.pp > 0 ? getMove(slot.id) : getMove('struggle');
  return mv.effect?.priority ?? 0;
}

function doItem(state: BattleState, side: SideIndex, itemId: string, targetIndex: number, ev: BattleEvent[]): void {
  const item = getItem(itemId);
  const s = state.sides[side];
  const mon = s.party[targetIndex];
  if (!item || !mon) return;
  const who = side === 0 ? 'あなた' : s.name;
  ev.push({ t: 'msg', text: `${who}は ${item.name}を つかった！` });
  const isActive = targetIndex === s.active;
  const max = maxHp(mon);
  if (item.kind === 'heal' && mon.hp > 0) {
    mon.hp = Math.min(max, mon.hp + (item.healAmount ?? 0));
    if (isActive) ev.push({ t: 'hp', side, hp: mon.hp, max });
    ev.push({ t: 'msg', text: `${displayName(mon)}の HPが かいふくした！` });
  } else if (item.kind === 'cure' && mon.status && (item.cures === 'all' || item.cures?.includes(mon.status))) {
    mon.status = null;
    if (isActive) ev.push({ t: 'status', side, status: null });
    ev.push({ t: 'msg', text: `${displayName(mon)}は げんきに なった！` });
  } else if (item.kind === 'revive' && mon.hp <= 0) {
    mon.hp = Math.max(1, Math.floor(max * (item.reviveRatio ?? 0.5)));
    mon.status = null;
    ev.push({ t: 'msg', text: `${displayName(mon)}は げんきを とりもどした！` });
  } else if (item.kind === 'battle' && item.stages && isActive) {
    applyStages(state, side, item.stages, ev);
  } else {
    ev.push({ t: 'msg', text: 'しかし こうかが なかった……' });
  }
}

/** アイテムが今その対象に効くか（画面側で使えないアイテムを選ばせないため） */
export function itemUsableOn(itemId: string, mon: MonsterInstance, isActive: boolean): boolean {
  const item = getItem(itemId);
  if (!item) return false;
  switch (item.kind) {
    case 'heal':
      return mon.hp > 0 && mon.hp < maxHp(mon);
    case 'cure':
      return mon.hp > 0 && !!mon.status && (item.cures === 'all' || !!item.cures?.includes(mon.status));
    case 'revive':
      return mon.hp <= 0;
    case 'battle':
      return isActive && mon.hp > 0;
    default:
      return false;
  }
}

function doCapture(state: BattleState, itemId: string, rng: Rng, ev: BattleEvent[]): boolean {
  const item = getItem(itemId);
  const target = active(state, 1);
  ev.push({ t: 'msg', text: `あなたは ${item?.name ?? 'ランタン'}を かかげた！` });
  if (!canCapture(state)) {
    ev.push({ t: 'msg', text: 'ランタンの光が はじかれた！ このあいては つかまえられない！' });
    return false;
  }
  const roll = rollCapture(target, item?.captureBonus ?? 1, rng);
  ev.push({ t: 'capture', shakes: roll.shakes, success: roll.success });
  if (roll.success) {
    ev.push({ t: 'msg', text: `やったー！ ${displayName(target)}を つかまえた！` });
    target.status = null;
    target.sleepTurns = 0;
    state.captured = target;
    finish(state, 'captured', ev);
    return true;
  }
  const lines = ['ああっ！ ランタンから とびだしてしまった！', 'おしい！ もうすこしで つかまえられたのに！', 'あと すこしだった……！', 'ほんの すこしの差で にげられた！'];
  ev.push({ t: 'msg', text: lines[roll.shakes] });
  return false;
}

function doRun(state: BattleState, rng: Rng, ev: BattleEvent[]): boolean {
  if (!canRun(state)) {
    ev.push({ t: 'msg', text: 'この戦いからは にげられない！' });
    return false;
  }
  state.runAttempts++;
  const ratio = effectiveSpeed(state, 0) / Math.max(1, effectiveSpeed(state, 1));
  const p = Math.min(100, 50 + 25 * ratio + 15 * (state.runAttempts - 1));
  if (chance(rng, p)) {
    ev.push({ t: 'msg', text: 'うまく にげきれた！' });
    finish(state, 'run', ev);
    return true;
  }
  ev.push({ t: 'msg', text: 'しかし にげられなかった！' });
  return false;
}

/**
 * 1ターンを処理する。actions[0] が味方、actions[1] が相手の行動。
 * 交代・道具・捕獲・逃げるは技より先に行われる。技は優先度→素早さの順。
 */
export function resolveTurn(state: BattleState, actions: [Action, Action], rng: Rng): BattleEvent[] {
  const ev: BattleEvent[] = [];
  if (state.result || state.needsSwitch[0] || state.needsSwitch[1]) return ev;
  state.turn++;

  const order: SideIndex[] = [0, 1];
  const pr = [priorityOf(state, 0, actions[0]), priorityOf(state, 1, actions[1])];
  if (pr[0] !== pr[1]) order.sort((a, b) => pr[b] - pr[a]);
  else {
    const s0 = effectiveSpeed(state, 0);
    const s1 = effectiveSpeed(state, 1);
    if (s1 > s0 || (s1 === s0 && rng.next() < 0.5)) order.reverse();
  }

  for (const side of order) {
    if (state.result) break;
    const action = actions[side];
    if (active(state, side).hp <= 0) continue;
    const foeSide: SideIndex = side === 0 ? 1 : 0;
    if (action.type === 'move' && active(state, foeSide).hp <= 0) {
      const slot = active(state, side).moves[action.index];
      if (!slot || getMove(slot.id).target === 'enemy') continue;
    }
    switch (action.type) {
      case 'run':
        if (side === 0) doRun(state, rng, ev);
        break;
      case 'switch':
        doSwitch(state, side, action.to, ev);
        break;
      case 'item':
        doItem(state, side, action.itemId, action.target, ev);
        break;
      case 'capture':
        if (side === 0) doCapture(state, action.itemId, rng, ev);
        break;
      case 'move':
        executeMove(state, side, action.index, rng, ev);
        break;
    }
    if (!state.result) handleFaints(state, ev);
  }

  if (!state.result) {
    for (const side of order) {
      if (state.needsSwitch[side]) continue;
      endOfTurnStatus(state, side, ev);
    }
    handleFaints(state, ev);
    // 「かたくなる」の残りターンを減らす
    for (const side of order) {
      const s = state.sides[side];
      if (!s.guard) continue;
      s.guard--;
      if (s.guard === 0 && active(state, side).hp > 0) ev.push({ t: 'msg', text: `${sideName(state, side)}の かたさが もとに もどった。` });
    }
  }
  return ev;
}

/** 戦闘後の後片付け：能力変化はリセット、眠りはそのまま */
export function aliveCount(party: MonsterInstance[]): number {
  return alive(party);
}
