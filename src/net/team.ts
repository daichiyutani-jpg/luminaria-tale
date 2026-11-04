/**
 * チームの「コード」（QR に入れる文字列）。QRチーム対戦と、直接対戦のチーム交換の両方で使う。
 *
 *   LMT<版>.<base64url(JSON)>.<チェックサム8桁>
 *   JSON = { n: プレイヤー名, t: [[進化の記録[], レベル, 素質(16進6けた), 技ID[], ニックネーム?], ...] }
 *
 * HP・PP・状態異常は入れない（読みこむ側で全回復の状態にする）。
 * 読みこむ時は1体ずつ checkMonsterStrict で検査し、ボスや不正なデータは拒否する。
 */
import type { MonsterInstance, Stats } from '../core/types';
import { getMove } from '../data/moves';
import { expForLevel } from '../logic/exp';
import { PARTY_MAX } from '../logic/game';
import { maxHp, STAT_KEYS } from '../logic/stats';
import { checkMonsterStrict, checksum } from '../save/validate';
import { b64urlToUtf8, cleanName, utf8ToB64url } from './codec';

export const TEAM_CODE_VERSION = 1;
const PREFIX = 'LMT';

export interface Team {
  name: string;
  party: MonsterInstance[];
}

export type TeamDecode = { ok: true; team: Team } | { ok: false; reason: string };

type WireMon = [string[], number, string, string[], string?];

function ivsToHex(ivs: Stats): string {
  return STAT_KEYS.map((k) => Math.max(0, Math.min(15, ivs[k] | 0)).toString(16)).join('');
}

/** 自分のパーティーをコードにする（不正なデータが混ざっていたら理由を返す） */
export function encodeTeam(name: string, party: MonsterInstance[]): { ok: true; code: string } | { ok: false; reason: string } {
  if (party.length === 0) return { ok: false, reason: 'なかまが いません' };
  for (const m of party) {
    const c = checkMonsterStrict(m);
    if (!c.ok) return { ok: false, reason: `${m.nickname || m.speciesId}：${c.reason}` };
  }
  const t: WireMon[] = party.slice(0, PARTY_MAX).map((m) => {
    const w: WireMon = [m.history, m.level, ivsToHex(m.ivs), m.moves.map((x) => x.id)];
    if (m.nickname) w.push(m.nickname);
    return w;
  });
  const body = utf8ToB64url(JSON.stringify({ n: cleanName(name) || 'ななし', t }));
  const head = `${PREFIX}${TEAM_CODE_VERSION}.${body}`;
  return { ok: true, code: `${head}.${checksum(head)}` };
}

export function isTeamCode(text: string): boolean {
  return text.trim().startsWith(PREFIX);
}

/**
 * コードを読んでチームにする。uidPrefix は 灯獣のIDの頭につける文字（対戦の両側で ID が重ならないように）。
 * できた灯獣は全回復の状態。
 */
export function decodeTeam(text: string, uidPrefix = 'q'): TeamDecode {
  const m = /^LMT(\d+)\.([A-Za-z0-9_-]+)\.([0-9a-f]{8})$/.exec(text.trim());
  if (!m) return { ok: false, reason: 'チームの QRコードでは ありません' };
  const ver = Number(m[1]);
  if (ver > TEAM_CODE_VERSION) return { ok: false, reason: 'あたらしい ばんの ゲームで つくられた QRです。ゲームを こうしんしてね' };
  if (ver !== TEAM_CODE_VERSION) return { ok: false, reason: 'ふるい ばんの QRです' };
  if (checksum(`${PREFIX}${m[1]}.${m[2]}`) !== m[3]) return { ok: false, reason: 'QRコードが かけています（もういちど よみとってね）' };
  let data: unknown;
  try {
    data = JSON.parse(b64urlToUtf8(m[2]));
  } catch {
    return { ok: false, reason: 'QRコードの なかみが こわれています' };
  }
  if (typeof data !== 'object' || data === null) return { ok: false, reason: 'QRコードの なかみが こわれています' };
  const d = data as { n?: unknown; t?: unknown };
  const name = cleanName(d.n) || 'ななし';
  if (!Array.isArray(d.t) || d.t.length < 1 || d.t.length > PARTY_MAX) return { ok: false, reason: 'チームの 数が ただしくありません' };
  const party: MonsterInstance[] = [];
  for (let i = 0; i < d.t.length; i++) {
    const mon = wireToMonster(d.t[i], `${uidPrefix}${i}`);
    if (!mon) return { ok: false, reason: `${i + 1}体目の データが こわれています` };
    const c = checkMonsterStrict(mon);
    if (!c.ok) return { ok: false, reason: `${i + 1}体目：${c.reason}` };
    party.push(mon);
  }
  return { ok: true, team: { name, party } };
}

function wireToMonster(w: unknown, uid: string): MonsterInstance | null {
  if (!Array.isArray(w) || w.length < 4 || w.length > 5) return null;
  const [history, level, ivHex, moves, nickname] = w as unknown[];
  if (!Array.isArray(history) || history.length < 1 || history.length > 8 || !history.every((h) => typeof h === 'string')) return null;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) return null;
  if (typeof ivHex !== 'string' || !/^[0-9a-f]{6}$/.test(ivHex)) return null;
  if (!Array.isArray(moves) || !moves.every((x) => typeof x === 'string')) return null;
  if (nickname !== undefined && typeof nickname !== 'string') return null;
  const ivs = Object.fromEntries(STAT_KEYS.map((k, i) => [k, parseInt(ivHex[i], 16)])) as Stats;
  const speciesId = history[history.length - 1] as string;
  let exp: number;
  let pp: { id: string; pp: number }[];
  try {
    exp = expForLevel(level);
    pp = (moves as string[]).map((id) => ({ id, pp: getMove(id).pp }));
  } catch {
    return null;
  }
  const mon: MonsterInstance = {
    uid,
    speciesId,
    level,
    exp,
    ivs,
    hp: 0,
    status: null,
    sleepTurns: 0,
    moves: pp,
    history: [...(history as string[])],
    caughtAt: '',
    caughtLevel: level,
    obtainedAt: new Date(0).toISOString(),
  };
  if (nickname) mon.nickname = nickname;
  try {
    mon.hp = maxHp(mon);
  } catch {
    return null;
  }
  return mon;
}
