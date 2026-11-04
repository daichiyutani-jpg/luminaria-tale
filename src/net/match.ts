/**
 * 対人戦の進行（画面・通信とは独立。テストで2台分を同時に動かせる）。
 *
 * - 戦闘の状態は「へやを作った側＝0、参加した側＝1」の並び（正本の並び）で、両方の端末が同じものを持つ
 * - 乱数は同じシードの seededRng。両者が同じ行動を同じ順に入れれば、必ず同じ結果になる
 * - 画面はいつも「自分＝0」で表示するので、参加した側では向きを入れかえた「見え方」を渡す
 * - 文章（「あいての ○○」など）は state.pov で自分側から書かれる。処理の結果には影響しない
 */
import type { BattleState, Action, BattleEvent, BattleResult, BattleSide, SideIndex } from '../logic/battle';
import { aiChooseMove, aiChooseSwitch, createBattle, resolveTurn, switchAfterFaint, usableMoves } from '../logic/battle';
import { mathRng, seededRng, type Rng } from '../logic/rng';
import { checksum } from '../save/validate';
import type { Team } from './team';

/** 画面（BattleView）が使う戦闘の入口。こちら＝0 の向きで読み書きする */
export interface BattleDriver {
  /** 画面が読む状態（こちら＝0） */
  view: BattleState;
  /** 1ターン進める（こちらの行動, 相手の行動） */
  turn(mine: Action, theirs: Action): BattleEvent[];
  /** たおれた後の交代（いらない側は null） */
  switches(mine: number | null, theirs: number | null): BattleEvent[];
}

export type VersusEndKind = 'surrender' | 'disconnect' | 'desync';
export interface VersusEnd {
  kind: VersusEndKind;
  text?: string;
}

/** 相手（通信相手 か CPU） */
export interface BattleOpponent {
  name: string;
  /** こちらの行動を伝えて、相手の行動を受け取る */
  exchangeAction(view: BattleState, mine: Action): Promise<Action>;
  /** たおれた後の交代先を伝えあう。mine はこちらの交代先（いらなければ null）。相手の交代先（いらなければ null）を返す */
  exchangeSwitch(view: BattleState, mine: number | null): Promise<number | null>;
  /** 相手がこうさんした・つうしんが切れた時に解決する */
  ended: Promise<VersusEnd>;
  /** こちらがこうさんした */
  surrender(): void;
  /** 相手を待っている間の表示 */
  waitText: string;
}

const flipSide = (s: SideIndex): SideIndex => (s === 0 ? 1 : 0);
const flipResult = (r: BattleResult | null): BattleResult | null => (r === 'win' ? 'lose' : r === 'lose' ? 'win' : r);

/** 正本の状態を、反対側から見た形にする（中身は同じものを指すので、正本が進めばこちらも進む） */
export function mirrorState(s: BattleState): BattleState {
  return {
    get kind() {
      return s.kind;
    },
    get sides() {
      return [s.sides[1], s.sides[0]] as [BattleSide, BattleSide];
    },
    get turn() {
      return s.turn;
    },
    get result() {
      return flipResult(s.result);
    },
    get needsSwitch() {
      return [s.needsSwitch[1], s.needsSwitch[0]] as [boolean, boolean];
    },
    get runAttempts() {
      return s.runAttempts;
    },
    get participants() {
      return s.participants;
    },
    get pendingMoves() {
      return [];
    },
    get captured() {
      return null;
    },
    get leveledUp() {
      return [];
    },
    get pov() {
      return 0 as SideIndex;
    },
  };
}

function flipEvent(e: BattleEvent): BattleEvent {
  if ('side' in e) return { ...e, side: flipSide(e.side) } as BattleEvent;
  if (e.t === 'end') return { ...e, result: flipResult(e.result)! };
  return e;
}

export interface Match extends BattleDriver {
  /** 正本の状態（0＝へやを作った側） */
  canonical: BattleState;
  /** 自分は正本のどちら側か */
  me: SideIndex;
  /** ずれの検出用：今の状態の要約 */
  hash(): string;
}

/**
 * 対戦を作る。host/guest のチームは両方の端末で「同じコード」から作ったものを渡すこと。
 * 灯獣はコピーして使うので、渡したチームやセーブは変わらない。
 */
export function createMatch(host: Team, guest: Team, me: SideIndex, seed: number, rng: Rng = seededRng(seed)): Match {
  const copy = (t: Team) => ({ name: t.name, party: JSON.parse(JSON.stringify(t.party)) as Team['party'] });
  const canonical = createBattle('pvp', copy(host), copy(guest));
  canonical.pov = me;
  const view = me === 0 ? canonical : mirrorState(canonical);
  const out = (ev: BattleEvent[]) => (me === 0 ? ev : ev.map(flipEvent));
  return {
    canonical,
    me,
    view,
    turn(mine, theirs) {
      const actions: [Action, Action] = me === 0 ? [mine, theirs] : [theirs, mine];
      return out(resolveTurn(canonical, actions, rng));
    },
    switches(mine, theirs) {
      const s0 = me === 0 ? mine : theirs;
      const s1 = me === 0 ? theirs : mine;
      const ev: BattleEvent[] = [];
      // 必ず 0 → 1 の順に入れる（両方の端末で同じ結果にするため）
      if (s0 !== null) ev.push(...switchAfterFaint(canonical, 0, s0));
      if (s1 !== null) ev.push(...switchAfterFaint(canonical, 1, s1));
      return out(ev);
    },
    hash: () => stateHash(canonical),
  };
}

/** 状態の要約（両方の端末で同じなら一致する） */
export function stateHash(s: BattleState): string {
  return checksum(
    JSON.stringify([
      s.turn,
      s.result,
      s.needsSwitch,
      s.sides.map((side) => [side.active, side.stages, side.guard ?? 0, side.party.map((m) => [m.hp, m.status, m.sleepTurns ?? 0, m.moves.map((x) => x.pp)])]),
    ]),
  );
}

/** 相手から来た行動が、その側にとって正しいか（技・交代だけ。道具・捕獲・にげるは対人戦では使えない） */
export function isValidAction(s: BattleState, side: SideIndex, a: unknown): a is Action {
  if (typeof a !== 'object' || a === null) return false;
  const x = a as { type?: unknown; index?: unknown; to?: unknown };
  const sd = s.sides[side];
  const mon = sd.party[sd.active];
  if (x.type === 'move') {
    if (typeof x.index !== 'number' || !Number.isInteger(x.index)) return false;
    if (usableMoves(mon).length === 0) return x.index === 0; // わるあがき
    return x.index >= 0 && x.index < mon.moves.length && mon.moves[x.index].pp > 0;
  }
  if (x.type === 'switch') return isValidSwitch(s, side, x.to);
  return false;
}

export function isValidSwitch(s: BattleState, side: SideIndex, to: unknown): to is number {
  const sd = s.sides[side];
  return typeof to === 'number' && Number.isInteger(to) && to >= 0 && to < sd.party.length && to !== sd.active && sd.party[to].hp > 0;
}

/** QRチーム対戦の相手（CPU が操作する） */
export function aiOpponent(name: string, smart = 0.8, rng: Rng = mathRng): BattleOpponent {
  return {
    name,
    waitText: '',
    exchangeAction: async (view) => aiChooseMove(view, 1, rng, smart),
    exchangeSwitch: async (view) => (view.needsSwitch[1] ? aiChooseSwitch(view, 1) : null),
    ended: new Promise<VersusEnd>(() => {}),
    surrender: () => {},
  };
}
