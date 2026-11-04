/**
 * セーブデータ（＝ゲームの進行状態）を操作する関数群。画面からはここを通して状態を変える。
 */
import type { MonsterInstance, SaveData } from '../core/types';
import { checkCondition } from '../data/conditions';
import { getItem } from '../data/items';
import { QUEST_ORDER, QUESTS } from '../data/quests';
import { getSpecies, SPECIES } from '../data/species';
import { createMonster, issueUid } from './monster';
import type { Rng } from './rng';

export const SAVE_VERSION = 1;
export const PARTY_MAX = 3;
export const BOX_MAX = 300;
export const ITEM_MAX = 99;
export const MONEY_MAX = 9_999_999;

declare const __APP_VERSION__: string;
export const GAME_VERSION = typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : '0.0.0-test';

export function newGame(slot: number, playerName: string, now = new Date()): SaveData {
  const iso = now.toISOString();
  return {
    version: SAVE_VERSION,
    gameVersion: GAME_VERSION,
    slot,
    createdAt: iso,
    savedAt: iso,
    playerName: playerName.trim().slice(0, 8) || 'アカリ',
    playTimeSec: 0,
    money: 1000,
    location: { mapId: 'home', x: 3, y: 4, facing: 'up' },
    respawn: { mapId: 'home', x: 3, y: 4 },
    party: [],
    box: [],
    items: {},
    dex: {},
    flags: {},
    quests: {},
    defeatedTrainers: [],
    openedChests: [],
    stats: { battlesWon: 0, captures: 0, evolutions: 0, steps: 0 },
    nextUid: 1,
  };
}

// ── 図鑑 ─────────────────────────────
export function markSeen(save: SaveData, speciesId: string): void {
  if (!save.dex[speciesId]) save.dex[speciesId] = 'seen';
}
export function markCaught(save: SaveData, speciesId: string): void {
  save.dex[speciesId] = 'caught';
}
export function dexCounts(save: SaveData): { seen: number; caught: number; total: number } {
  const vals = Object.entries(save.dex).filter(([id]) => SPECIES[id]);
  return {
    seen: vals.filter(([, v]) => v === 'seen' || v === 'caught').length,
    caught: vals.filter(([, v]) => v === 'caught').length,
    total: Object.keys(SPECIES).length,
  };
}

// ── アイテム・お金 ───────────────────────
export function itemCount(save: SaveData, id: string): number {
  return save.items[id] ?? 0;
}
export function addItem(save: SaveData, id: string, n = 1): number {
  if (!getItem(id)) return 0;
  const before = itemCount(save, id);
  const after = Math.min(ITEM_MAX, before + Math.max(0, n));
  save.items[id] = after;
  return after - before;
}
export function removeItem(save: SaveData, id: string, n = 1): boolean {
  if (itemCount(save, id) < n) return false;
  save.items[id] -= n;
  if (save.items[id] <= 0) delete save.items[id];
  return true;
}
export function addMoney(save: SaveData, n: number): void {
  save.money = Math.max(0, Math.min(MONEY_MAX, Math.floor(save.money + n)));
}
export function buy(save: SaveData, itemId: string, qty: number): { ok: boolean; reason?: string } {
  const item = getItem(itemId);
  if (!item || item.price <= 0) return { ok: false, reason: 'このアイテムは 買えません。' };
  if (qty <= 0) return { ok: false, reason: '数を えらんでください。' };
  const cost = item.price * qty;
  if (save.money < cost) return { ok: false, reason: 'お金が たりません。' };
  if (itemCount(save, itemId) + qty > ITEM_MAX) return { ok: false, reason: `${ITEM_MAX}こまでしか 持てません。` };
  save.money -= cost;
  addItem(save, itemId, qty);
  return { ok: true };
}
export function sell(save: SaveData, itemId: string, qty: number): { ok: boolean; gained: number } {
  const item = getItem(itemId);
  if (!item || item.price <= 0 || item.kind === 'key' || qty <= 0) return { ok: false, gained: 0 };
  if (!removeItem(save, itemId, qty)) return { ok: false, gained: 0 };
  const gained = Math.floor(item.price / 2) * qty;
  addMoney(save, gained);
  return { ok: true, gained };
}

// ── なかま ─────────────────────────────
/** なかまに加える。パーティーがいっぱいならボックスへ。どちらに入ったかを返す */
export function addMonster(save: SaveData, mon: MonsterInstance): 'party' | 'box' | 'full' {
  markCaught(save, mon.speciesId);
  for (const sp of mon.history) markCaught(save, sp);
  if (save.party.length < PARTY_MAX) {
    save.party.push(mon);
    return 'party';
  }
  if (save.box.length < BOX_MAX) {
    save.box.push(mon);
    return 'box';
  }
  return 'full';
}

export function giveNewMonster(save: SaveData, speciesId: string, level: number, rng: Rng, caughtAt: string): MonsterInstance {
  const mon = createMonster(speciesId, level, rng, { uid: issueUid(save), caughtAt });
  addMonster(save, mon);
  return mon;
}

/** パーティーとボックスの入れ替え。パーティーが0体になる操作や、戦えるなかまが0になる操作は禁止 */
export function moveToBox(save: SaveData, partyIndex: number): { ok: boolean; reason?: string } {
  if (save.party.length <= 1) return { ok: false, reason: 'パーティーを 0体には できません。' };
  const mon = save.party[partyIndex];
  if (!mon) return { ok: false };
  const restAlive = save.party.filter((m, i) => i !== partyIndex && m.hp > 0).length;
  if (restAlive === 0) return { ok: false, reason: '戦える なかまが いなくなってしまいます。' };
  if (save.box.length >= BOX_MAX) return { ok: false, reason: 'ボックスが いっぱいです。' };
  save.party.splice(partyIndex, 1);
  save.box.push(mon);
  return { ok: true };
}
export function moveToParty(save: SaveData, boxIndex: number): { ok: boolean; reason?: string } {
  if (save.party.length >= PARTY_MAX) return { ok: false, reason: `パーティーは ${PARTY_MAX}体までです。` };
  const mon = save.box[boxIndex];
  if (!mon) return { ok: false };
  save.box.splice(boxIndex, 1);
  save.party.push(mon);
  return { ok: true };
}
export function swapPartyBox(save: SaveData, partyIndex: number, boxIndex: number): { ok: boolean; reason?: string } {
  const p = save.party[partyIndex];
  const b = save.box[boxIndex];
  if (!p || !b) return { ok: false };
  const restAlive = save.party.filter((m, i) => i !== partyIndex && m.hp > 0).length + (b.hp > 0 ? 1 : 0);
  if (restAlive === 0) return { ok: false, reason: '戦える なかまが いなくなってしまいます。' };
  save.party[partyIndex] = b;
  save.box[boxIndex] = p;
  return { ok: true };
}
export function reorderParty(save: SaveData, from: number, to: number): void {
  if (from === to || !save.party[from] || to < 0 || to >= save.party.length) return;
  const [m] = save.party.splice(from, 1);
  save.party.splice(to, 0, m);
}
export function healParty(save: SaveData, heal: (m: MonsterInstance) => void): void {
  for (const m of save.party) heal(m);
}

// ── クエスト ───────────────────────────
export function questGoalMet(save: SaveData, questId: string): boolean {
  const q = QUESTS[questId];
  if (!q) return false;
  const g = q.goal;
  switch (g.kind) {
    case 'flag':
      return !!save.flags[g.flag];
    case 'dexCaught':
      return dexCounts(save).caught >= g.count;
    case 'defeatTrainers':
      return g.trainerIds.every((t) => save.defeatedTrainers.includes(t));
    case 'ownSpecies':
      return checkCondition(save, { hasSpecies: g.speciesId });
  }
}

export interface QuestNotice {
  questId: string;
  kind: 'started' | 'completed';
  rewardText?: string;
}

/**
 * クエストの受注・達成を更新する。達成したら報酬をその場で渡す（受け取り忘れを防ぐ）。
 * 何度呼んでも同じ報酬が二重に渡らない（state が claimed になる）。
 */
export function updateQuests(save: SaveData): QuestNotice[] {
  const notices: QuestNotice[] = [];
  for (const id of QUEST_ORDER) {
    const q = QUESTS[id];
    let p = save.quests[id];
    if (!p) {
      if (q.startFlag && !save.flags[q.startFlag]) continue;
      p = save.quests[id] = { state: 'active' };
      notices.push({ questId: id, kind: 'started' });
    }
    if (p.state === 'active' && questGoalMet(save, id)) {
      p.state = 'done';
    }
    if (p.state === 'done') {
      const parts: string[] = [];
      if (q.reward.money) {
        addMoney(save, q.reward.money);
        parts.push(`${q.reward.money} ルクス`);
      }
      for (const [itemId, n] of q.reward.items ?? []) {
        addItem(save, itemId, n);
        parts.push(`${getItem(itemId)?.name ?? itemId} ×${n}`);
      }
      if (q.reward.flag) save.flags[q.reward.flag] = true;
      p.state = 'claimed';
      notices.push({ questId: id, kind: 'completed', rewardText: parts.join('、') });
    }
  }
  return notices;
}

/** 種族IDが存在するか（データ検証用） */
export function speciesExists(id: string): boolean {
  try {
    getSpecies(id);
    return true;
  } catch {
    return false;
  }
}
