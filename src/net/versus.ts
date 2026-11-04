/**
 * 直接対戦の通信部分：あいさつ・チームの交換・毎ターンの行動の受け渡し。
 *
 * やりとりする内容（JSON）
 *   hi   { v: 通信の版, game: ゲームの版, mode, name, nonce }      つながった直後に両方が送る
 *   team { code: チームのコード（src/net/team.ts） }                 対戦の前に両方が送る
 *   act  { n: ターン番号, a: 行動, h: ターン前の状態の要約 }           毎ターン両方が送る
 *   sw   { n: 交代の番号, to: 交代先 }                               たおれた側だけが送る
 *   gg   {}                                                          こうさん
 *   ping / bye                                                       生きているか／おわり
 * 状態の要約が合わなければ「ずれ」として勝負を中止する（どちらの勝ちにもしない）。
 */
import type { SideIndex } from '../logic/battle';
import { GAME_VERSION } from '../logic/game';
import { cleanName, randomU32 } from './codec';
import { isValidAction, isValidSwitch, type BattleOpponent, type Match, type VersusEnd } from './match';
import type { PeerLink } from './rtc';
import type { LinkMode } from './sdp';

export const NET_PROTOCOL = 1;

export interface Hello {
  name: string;
  nonce: number;
}

function timeout<T>(p: Promise<T>, ms: number, text: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = window.setTimeout(() => reject(new Error(text)), ms);
    p.then(
      (v) => {
        window.clearTimeout(t);
        resolve(v);
      },
      (e) => {
        window.clearTimeout(t);
        reject(e);
      },
    );
  });
}

/** あいさつを交わす。版が違う・モードが違う時は Error */
export async function handshake(link: PeerLink, mode: LinkMode, myName: string): Promise<{ me: Hello; them: Hello }> {
  const me: Hello = { name: cleanName(myName) || 'ななし', nonce: randomU32() };
  link.send({ t: 'hi', v: NET_PROTOCOL, game: GAME_VERSION, mode, name: me.name, nonce: me.nonce });
  const m = await timeout(link.next('hi'), 15000, 'あいてからの へんじが ありません');
  if (m.v !== NET_PROTOCOL || m.game !== GAME_VERSION) throw new Error(`ゲームの ばんが ちがいます（あなた ${GAME_VERSION}／あいて ${String(m.game ?? '?')}）。りょうほう さいしんに こうしんしてね`);
  if (m.mode !== mode) throw new Error('へやの しゅるいが ちがいます');
  const nonce = typeof m.nonce === 'number' ? m.nonce >>> 0 : 0;
  return { me, them: { name: cleanName(m.name) || 'ともだち', nonce } };
}

/** 両方の合言葉から 同じシードを作る（どちらか片方だけでは決められない） */
export function sharedSeed(hostNonce: number, guestNonce: number): number {
  return (hostNonce ^ Math.imul(guestNonce >>> 0, 0x9e3779b1)) >>> 0;
}

/** チームのコードを交換する */
export async function exchangeTeams(link: PeerLink, myCode: string): Promise<string> {
  link.send({ t: 'team', code: myCode });
  const m = await timeout(link.next('team'), 20000, 'あいての チームが とどきません');
  if (typeof m.code !== 'string' || m.code.length > 4000) throw new Error('あいての チームの データが こわれています');
  return m.code;
}

/** 通信相手を BattleOpponent にする */
export function netOpponent(link: PeerLink, match: Match, name: string): BattleOpponent {
  const remote: SideIndex = match.me === 0 ? 1 : 0;
  let turnNo = 0;
  let swNo = 0;
  let resolveEnd!: (e: VersusEnd) => void;
  const ended = new Promise<VersusEnd>((r) => (resolveEnd = r));
  const never = <T>() => new Promise<T>(() => {});
  const desync = (why: string) => {
    console.warn('pvp desync:', why);
    resolveEnd({ kind: 'desync', text: 'つうしんの ずれが おきたため、勝負を 中止しました。' });
    link.close('ずれ', true);
  };
  link.on('gg', () => resolveEnd({ kind: 'surrender' }));
  link.onClose((reason) => resolveEnd({ kind: 'disconnect', text: `${reason}……` }));
  return {
    name,
    waitText: `${name}の こうどうを まっています…`,
    async exchangeAction(_view, mine) {
      const n = ++turnNo;
      const h = match.hash();
      link.send({ t: 'act', n, a: mine, h });
      try {
        const m = await link.next('act');
        if (m.n !== n || m.h !== h) {
          desync(`turn ${n}/${String(m.n)} hash ${h}/${String(m.h)}`);
          return never();
        }
        if (!isValidAction(match.canonical, remote, m.a)) {
          desync(`invalid action ${JSON.stringify(m.a)}`);
          return never();
        }
        return m.a;
      } catch {
        return never(); // 切断は ended で知らせる
      }
    },
    async exchangeSwitch(_view, mine) {
      const n = ++swNo;
      if (mine !== null) link.send({ t: 'sw', n, to: mine });
      if (!match.canonical.needsSwitch[remote]) return null;
      try {
        const m = await link.next('sw');
        if (m.n !== n || !isValidSwitch(match.canonical, remote, m.to)) {
          desync(`invalid switch ${JSON.stringify(m)}`);
          return never();
        }
        return m.to;
      } catch {
        return never();
      }
    },
    ended,
    surrender: () => link.send({ t: 'gg' }),
  };
}
