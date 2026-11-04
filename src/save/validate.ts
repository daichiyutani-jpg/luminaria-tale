/**
 * セーブデータの検証・修復・移行。
 * - 読み込み時：小さな破損は修復して遊べるようにし、構造が壊れていれば拒否する
 * - インポート時・通信時：能力値や技の不正を厳しく拒否する
 */
import type { MonsterInstance, SaveData, Settings, StatKey } from '../core/types';
import { MOVES } from '../data/moves';
import { MAPS } from '../data/maps';
import { SPECIES } from '../data/species';
import { expForLevel } from '../logic/exp';
import { SAVE_VERSION } from '../logic/game';
import { MAX_MOVES } from '../logic/monster';
import { MAX_LEVEL, maxHp, STAT_KEYS } from '../logic/stats';

export const DEFAULT_SETTINGS: Settings = { bgmVolume: 0.6, seVolume: 0.8, bgmOn: true, seOn: true, battleSpeed: 2, skipAnimations: false };

/** FNV-1a（改ざん・破損の検出用。暗号的な安全性は不要） */
export function checksum(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown, min: number, max: number): v is number => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/** 古い版のセーブを今の版にそろえる。版を上げる時はここに変換を足す */
const MIGRATIONS: Record<number, (d: Record<string, unknown>) => Record<string, unknown>> = {
  // 例: 1: (d) => ({ ...d, newField: 初期値, version: 2 }),
};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let d = raw;
  let v = typeof d.version === 'number' ? d.version : 0;
  if (v > SAVE_VERSION) throw new SaveError('newer', 'このセーブデータは 新しい版のゲームで 作られています。ゲームを更新してください。');
  while (v < SAVE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new SaveError('broken', `版 ${v} のセーブデータは 読み込めません。`);
    d = step(d);
    v = d.version as number;
  }
  return d;
}

export class SaveError extends Error {
  constructor(
    public code: 'broken' | 'newer' | 'checksum' | 'cheat' | 'quota' | 'io',
    message: string,
  ) {
    super(message);
  }
}

export interface MonsterCheck {
  ok: boolean;
  reason?: string;
}

/** モンスター1体の厳密な検査（インポート・通信交換用） */
export function checkMonsterStrict(m: unknown): MonsterCheck {
  if (!isObj(m)) return { ok: false, reason: '形式が正しくありません' };
  if (typeof m.uid !== 'string' || m.uid.length === 0 || m.uid.length > 64) return { ok: false, reason: 'IDが不正です' };
  if (typeof m.speciesId !== 'string' || !SPECIES[m.speciesId]) return { ok: false, reason: '存在しない灯獣です' };
  if (SPECIES[m.speciesId].rarity === 'boss') return { ok: false, reason: 'この灯獣は 持ちこめません' };
  if (!isInt(m.level, 1, MAX_LEVEL)) return { ok: false, reason: 'レベルが不正です' };
  if (!isInt(m.exp, 0, expForLevel(MAX_LEVEL))) return { ok: false, reason: '経験値が不正です' };
  if (m.exp < expForLevel(m.level) || (m.level < MAX_LEVEL && m.exp >= expForLevel(m.level + 1))) return { ok: false, reason: 'レベルと経験値が合いません' };
  if (!isObj(m.ivs) || !STAT_KEYS.every((k) => isInt((m.ivs as Record<string, unknown>)[k], 0, 15))) return { ok: false, reason: '素質の値が不正です' };
  if (!Array.isArray(m.moves) || m.moves.length < 1 || m.moves.length > MAX_MOVES) return { ok: false, reason: '技の数が不正です' };
  const history = Array.isArray(m.history) ? (m.history as unknown[]) : [];
  if (history.length === 0 || history.some((h) => typeof h !== 'string' || !SPECIES[h]) || history[history.length - 1] !== m.speciesId)
    return { ok: false, reason: '進化の記録が不正です' };
  // 進化の記録が正しい順番か
  for (let i = 1; i < history.length; i++) {
    const prev = SPECIES[history[i - 1] as string];
    if (!(prev.evolutions ?? []).some((e) => e.to === history[i])) return { ok: false, reason: '進化の記録が不正です' };
  }
  // 覚えられる技か
  const legal = new Set(history.flatMap((h) => SPECIES[h as string].learnset.filter(([lv]) => lv <= (m.level as number)).map(([, id]) => id)));
  const ids = new Set<string>();
  for (const mv of m.moves as unknown[]) {
    if (!isObj(mv) || typeof mv.id !== 'string' || !MOVES[mv.id]) return { ok: false, reason: '存在しない技です' };
    if (!legal.has(mv.id)) return { ok: false, reason: `${MOVES[mv.id].name}は 覚えられない技です` };
    if (ids.has(mv.id)) return { ok: false, reason: '同じ技が重なっています' };
    ids.add(mv.id);
    if (!isInt(mv.pp, 0, MOVES[mv.id].pp)) return { ok: false, reason: '技の使用回数が不正です' };
  }
  const max = maxHp(m as unknown as MonsterInstance);
  if (!isInt(m.hp, 0, max)) return { ok: false, reason: 'HPが不正です' };
  if (m.nickname !== undefined && (typeof m.nickname !== 'string' || m.nickname.length > 10)) return { ok: false, reason: 'ニックネームが不正です' };
  return { ok: true };
}

/** 読み込み時のゆるい修復。直せない時は null */
function repairMonster(m: unknown): MonsterInstance | null {
  if (!isObj(m) || typeof m.speciesId !== 'string' || !SPECIES[m.speciesId] || typeof m.uid !== 'string') return null;
  const mon = m as unknown as MonsterInstance;
  mon.level = isInt(mon.level, 1, MAX_LEVEL) ? mon.level : Math.min(MAX_LEVEL, Math.max(1, Math.round(Number(mon.level) || 1)));
  if (!isInt(mon.exp, 0, Number.MAX_SAFE_INTEGER) || mon.exp < expForLevel(mon.level)) mon.exp = expForLevel(mon.level);
  if (!isObj(mon.ivs)) mon.ivs = { hp: 0, atk: 0, def: 0, spa: 0, spd: 0, spe: 0 };
  for (const k of STAT_KEYS as StatKey[]) if (!isInt(mon.ivs[k], 0, 15)) mon.ivs[k] = 0;
  mon.moves = (Array.isArray(mon.moves) ? mon.moves : []).filter((mv) => isObj(mv) && MOVES[mv.id]).slice(0, MAX_MOVES);
  for (const mv of mon.moves) if (!isInt(mv.pp, 0, MOVES[mv.id].pp)) mv.pp = MOVES[mv.id].pp;
  if (mon.moves.length === 0) mon.moves = [{ id: 'tackle', pp: MOVES.tackle.pp }];
  if (!Array.isArray(mon.history) || mon.history.length === 0) mon.history = [mon.speciesId];
  mon.history = mon.history.filter((h) => SPECIES[h]);
  if (mon.history[mon.history.length - 1] !== mon.speciesId) mon.history.push(mon.speciesId);
  const max = maxHp(mon);
  if (!isInt(mon.hp, 0, max)) mon.hp = Math.max(0, Math.min(max, Math.round(Number(mon.hp) || 0)));
  if (!['burn', 'poison', 'paralyze', 'sleep', 'mist', null].includes(mon.status as never)) mon.status = null;
  if (typeof mon.caughtAt !== 'string') mon.caughtAt = '不明';
  if (!isInt(mon.caughtLevel, 1, MAX_LEVEL)) mon.caughtLevel = mon.level;
  if (typeof mon.obtainedAt !== 'string') mon.obtainedAt = new Date(0).toISOString();
  return mon;
}

/**
 * セーブデータを検証・修復して返す。構造が壊れていたら SaveError。
 * strict=true（インポート時）はモンスターの不正を1体でも見つけたら拒否する。
 */
export function validateSave(raw: unknown, strict = false): SaveData {
  if (!isObj(raw)) throw new SaveError('broken', 'セーブデータの形式が正しくありません。');
  const d = migrate(raw) as unknown as SaveData;
  if (typeof d.playerName !== 'string' || !isObj(d.location) || !Array.isArray(d.party) || !Array.isArray(d.box) || !isObj(d.items) || !isObj(d.flags))
    throw new SaveError('broken', 'セーブデータの一部が 壊れています。');
  if (strict) {
    for (const m of [...d.party, ...d.box]) {
      const c = checkMonsterStrict(m);
      if (!c.ok) throw new SaveError('cheat', `ふせいな灯獣が ふくまれています（${c.reason}）。`);
    }
    const uids = new Set<string>();
    for (const m of [...d.party, ...d.box]) {
      if (uids.has(m.uid)) throw new SaveError('cheat', '同じ灯獣が 重複しています。');
      uids.add(m.uid);
    }
  }
  d.party = d.party.map(repairMonster).filter((m): m is MonsterInstance => !!m).slice(0, 3);
  d.box = d.box.map(repairMonster).filter((m): m is MonsterInstance => !!m);
  // UIDの重複を直す
  const seen = new Set<string>();
  for (const m of [...d.party, ...d.box]) {
    if (seen.has(m.uid)) m.uid = `${m.uid}-r${seen.size}`;
    seen.add(m.uid);
  }
  if (!MAPS[d.location.mapId]) d.location = { mapId: 'village', x: 8, y: 7, facing: 'down' };
  if (!isObj(d.respawn) || !MAPS[d.respawn.mapId]) d.respawn = { mapId: 'home', x: 3, y: 4 };
  d.money = isInt(d.money, 0, 9_999_999) ? d.money : 0;
  d.playTimeSec = isInt(d.playTimeSec, 0, Number.MAX_SAFE_INTEGER) ? d.playTimeSec : 0;
  for (const [k, v] of Object.entries(d.items)) if (!isInt(v, 1, 99)) delete d.items[k];
  d.dex = isObj(d.dex) ? d.dex : {};
  d.quests = isObj(d.quests) ? d.quests : {};
  d.defeatedTrainers = Array.isArray(d.defeatedTrainers) ? d.defeatedTrainers.filter((x) => typeof x === 'string') : [];
  d.openedChests = Array.isArray(d.openedChests) ? d.openedChests.filter((x) => typeof x === 'string') : [];
  d.stats = isObj(d.stats) ? Object.assign({ battlesWon: 0, captures: 0, evolutions: 0, steps: 0 }, d.stats) : { battlesWon: 0, captures: 0, evolutions: 0, steps: 0 };
  d.nextUid = isInt(d.nextUid, 1, Number.MAX_SAFE_INTEGER) ? d.nextUid : seen.size + 1;
  // 捕まえたことのある灯獣は図鑑に必ず反映
  for (const m of [...d.party, ...d.box]) for (const h of m.history) d.dex[h] = 'caught';
  return d;
}

export function validateSettings(raw: unknown): Settings {
  const s = { ...DEFAULT_SETTINGS };
  if (!isObj(raw)) return s;
  if (typeof raw.bgmVolume === 'number') s.bgmVolume = Math.max(0, Math.min(1, raw.bgmVolume));
  if (typeof raw.seVolume === 'number') s.seVolume = Math.max(0, Math.min(1, raw.seVolume));
  if (typeof raw.bgmOn === 'boolean') s.bgmOn = raw.bgmOn;
  if (typeof raw.seOn === 'boolean') s.seOn = raw.seOn;
  if (raw.battleSpeed === 1 || raw.battleSpeed === 2 || raw.battleSpeed === 3) s.battleSpeed = raw.battleSpeed;
  if (typeof raw.skipAnimations === 'boolean') s.skipAnimations = raw.skipAnimations;
  return s;
}
