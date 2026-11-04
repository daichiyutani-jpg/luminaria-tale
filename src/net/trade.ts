/**
 * 灯獣の交換（画面・通信とは独立した部分）。
 * - 送る灯獣は必要な項目だけの形にして送る
 * - 受け取った灯獣は checkMonsterStrict で厳しく検査する（ボス・不正なデータは拒否）
 * - 成立したら：送った灯獣をセーブから外し、受け取った灯獣に新しい UID と元の持ち主を付けて加える
 */
import type { MonsterInstance, SaveData, StatusId } from '../core/types';
import { addMonster } from '../logic/game';
import { healFully, issueUid } from '../logic/monster';
import { checkMonsterStrict } from '../save/validate';
import { cleanName } from './codec';

export interface WireMonster {
  s: string;
  n?: string;
  l: number;
  e: number;
  iv: Record<string, number>;
  mv: { id: string; pp: number }[];
  hi: string[];
  ca: string;
  cl: number;
  ot?: string;
  hp: number;
  st: StatusId | null;
}

export function toWire(m: MonsterInstance): WireMonster {
  const w: WireMonster = { s: m.speciesId, l: m.level, e: m.exp, iv: { ...m.ivs }, mv: m.moves.map((x) => ({ id: x.id, pp: x.pp })), hi: [...m.history], ca: m.caughtAt, cl: m.caughtLevel, hp: m.hp, st: m.status };
  if (m.nickname) w.n = m.nickname;
  if (m.originalTrainer) w.ot = m.originalTrainer;
  return w;
}

const STATUSES = ['burn', 'poison', 'paralyze', 'sleep', 'mist'];

/** 相手から来た灯獣を検査して、受け取れる形にする */
export function fromWire(raw: unknown): { ok: true; mon: MonsterInstance } | { ok: false; reason: string } {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return { ok: false, reason: '形式が正しくありません' };
  const w = raw as Partial<WireMonster>;
  if (w.st !== null && w.st !== undefined && !STATUSES.includes(w.st)) return { ok: false, reason: '状態が不正です' };
  if (typeof w.cl !== 'number' || !Number.isInteger(w.cl) || w.cl < 1 || typeof w.l !== 'number' || w.cl > w.l) return { ok: false, reason: '捕まえた時のレベルが不正です' };
  const mon: MonsterInstance = {
    uid: 'trade-incoming',
    speciesId: w.s as string,
    level: w.l as number,
    exp: w.e as number,
    ivs: w.iv as MonsterInstance['ivs'],
    hp: w.hp as number,
    status: (w.st ?? null) as StatusId | null,
    sleepTurns: 0,
    moves: Array.isArray(w.mv) ? w.mv.map((x) => (typeof x === 'object' && x !== null ? { id: x.id, pp: x.pp } : (x as never))) : (w.mv as never),
    history: w.hi as string[],
    caughtAt: typeof w.ca === 'string' ? cleanName(w.ca, 24) : '',
    caughtLevel: w.cl,
    obtainedAt: new Date().toISOString(),
  };
  if (w.n !== undefined) mon.nickname = w.n;
  if (w.ot !== undefined) {
    const ot = cleanName(w.ot);
    if (ot) mon.originalTrainer = ot;
  }
  const c = checkMonsterStrict(mon);
  if (!c.ok) return { ok: false, reason: c.reason ?? '不正なデータです' };
  return { ok: true, mon };
}

/** この灯獣を 交換に だせるか（パーティーの最後の1体は だせない） */
export function canOffer(save: SaveData, uid: string): { ok: boolean; reason?: string } {
  const inParty = save.party.findIndex((m) => m.uid === uid);
  if (inParty >= 0) {
    if (save.party.length <= 1) return { ok: false, reason: 'パーティーの さいごの 1体は だせません' };
    return { ok: true };
  }
  if (save.box.some((m) => m.uid === uid)) return { ok: true };
  return { ok: false, reason: 'みつかりません' };
}

/**
 * 交換を成立させる（セーブの中身を書きかえる。保存は呼ぶ側で行う）。
 * 受け取った灯獣は全回復し、新しい UID と元の持ち主（partnerName）を付ける。
 */
export function applyTrade(save: SaveData, givenUid: string, incoming: MonsterInstance, partnerName: string): { ok: true; received: MonsterInstance; given: MonsterInstance } | { ok: false; reason: string } {
  const can = canOffer(save, givenUid);
  if (!can.ok) return { ok: false, reason: can.reason ?? 'だせません' };
  const pi = save.party.findIndex((m) => m.uid === givenUid);
  let given: MonsterInstance;
  if (pi >= 0) given = save.party.splice(pi, 1)[0];
  else {
    const bi = save.box.findIndex((m) => m.uid === givenUid);
    given = save.box.splice(bi, 1)[0];
  }
  const received: MonsterInstance = JSON.parse(JSON.stringify(incoming));
  received.uid = issueUid(save);
  received.obtainedAt = new Date().toISOString();
  received.originalTrainer = incoming.originalTrainer ?? (cleanName(partnerName) || 'ともだち');
  healFully(received);
  const where = addMonster(save, received);
  if (where === 'full') {
    // ありえないはず（1体 外したので空きがある）。念のため元に戻す
    if (pi >= 0) save.party.splice(pi, 0, given);
    else save.box.push(given);
    return { ok: false, reason: 'ボックスが いっぱいです' };
  }
  return { ok: true, received, given };
}
