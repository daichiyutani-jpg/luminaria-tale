/**
 * 端末内（IndexedDB）へのセーブ。
 * - 1回の書き込みで「本体」と「1つ前のバックアップ」を同じトランザクションに入れる（途中で落ちても片方は必ず残る）
 * - 本体が壊れていたらバックアップから読み込む
 * - チェックサムで破損を検出する
 */
import type { SaveData, Settings } from '../core/types';
import { GAME_VERSION } from '../logic/game';
import { checksum, DEFAULT_SETTINGS, SaveError, validateSave, validateSettings } from './validate';

const DB_NAME = 'luminaria-tale';
const STORE = 'kv';
export const SLOT_COUNT = 3;

interface StoredSave {
  checksum: string;
  json: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new SaveError('io', 'この端末では 保存機能が 使えません。'));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(new SaveError('io', '保存領域を 開けませんでした。'));
    req.onblocked = () => reject(new SaveError('io', '別のタブで ゲームが 開いています。閉じてから もう一度 お試しください。'));
  });
  dbPromise.catch(() => {
    dbPromise = null;
  });
  return dbPromise;
}

/** テスト用：接続を閉じて作り直せるようにする */
export async function _resetDbForTest(): Promise<void> {
  if (dbPromise) (await dbPromise.catch(() => null))?.close();
  dbPromise = null;
}

function req<T>(r: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

const mainKey = (slot: number) => `slot:${slot}`;
const backupKey = (slot: number) => `slot:${slot}:backup`;

function encode(data: SaveData): StoredSave {
  const json = JSON.stringify(data);
  return { checksum: checksum(json), json };
}

function decode(stored: unknown): SaveData {
  if (!stored || typeof stored !== 'object') throw new SaveError('broken', 'セーブデータが 見つかりません。');
  const s = stored as StoredSave;
  if (typeof s.json !== 'string' || checksum(s.json) !== s.checksum) throw new SaveError('checksum', 'セーブデータが 壊れています。');
  return validateSave(JSON.parse(s.json));
}

function isQuota(e: unknown): boolean {
  const name = (e as { name?: string })?.name ?? '';
  return name === 'QuotaExceededError' || name === 'NS_ERROR_DOM_QUOTA_REACHED';
}

let writing: Promise<void> = Promise.resolve();

/** セーブ。前回の本体をバックアップに回してから、新しい本体を書く（1トランザクション） */
export function saveGame(data: SaveData): Promise<void> {
  // 連続で呼ばれても順番に書く（追い越しで古いデータが残らないように）
  const job = writing.then(async () => {
    data.savedAt = new Date().toISOString();
    data.gameVersion = GAME_VERSION;
    const encoded = encode(data);
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      let tx: IDBTransaction;
      try {
        tx = db.transaction(STORE, 'readwrite');
      } catch (e) {
        reject(new SaveError('io', `保存に失敗しました（${(e as Error).message}）`));
        return;
      }
      const store = tx.objectStore(STORE);
      const getOld = store.get(mainKey(data.slot));
      getOld.onsuccess = () => {
        const old = getOld.result as StoredSave | undefined;
        // 古い本体が正常な時だけバックアップを更新する（壊れた本体でバックアップを上書きしない）
        if (old && typeof old.json === 'string' && checksum(old.json) === old.checksum) store.put(old, backupKey(data.slot));
        store.put(encoded, mainKey(data.slot));
      };
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => {
        const err = tx.error;
        reject(isQuota(err) ? new SaveError('quota', '端末の空き容量が たりないため 保存できませんでした。') : new SaveError('io', `保存に失敗しました（${err?.message ?? '不明なエラー'}）`));
      };
    });
  });
  writing = job.catch(() => undefined);
  return job;
}

export interface LoadResult {
  data: SaveData;
  /** 本体が壊れていて、バックアップから読み込んだ */
  fromBackup: boolean;
}

export async function loadGame(slot: number): Promise<LoadResult | null> {
  const db = await openDb();
  const tx = db.transaction(STORE, 'readonly');
  const store = tx.objectStore(STORE);
  const [main, backup] = await Promise.all([req(store.get(mainKey(slot))), req(store.get(backupKey(slot)))]);
  if (!main && !backup) return null;
  try {
    return { data: decode(main), fromBackup: false };
  } catch (e) {
    if (e instanceof SaveError && e.code === 'newer') throw e;
    if (!backup) throw e;
    return { data: decode(backup), fromBackup: true };
  }
}

export interface SlotSummary {
  slot: number;
  exists: boolean;
  broken?: boolean;
  playerName?: string;
  playTimeSec?: number;
  location?: string;
  dexCaught?: number;
  savedAt?: string;
  partySpecies?: string[];
}

export async function listSlots(): Promise<SlotSummary[]> {
  const out: SlotSummary[] = [];
  for (let slot = 1; slot <= SLOT_COUNT; slot++) {
    try {
      const r = await loadGame(slot);
      if (!r) out.push({ slot, exists: false });
      else
        out.push({
          slot,
          exists: true,
          broken: false,
          playerName: r.data.playerName,
          playTimeSec: r.data.playTimeSec,
          location: r.data.location.mapId,
          dexCaught: Object.values(r.data.dex).filter((v) => v === 'caught').length,
          savedAt: r.data.savedAt,
          partySpecies: r.data.party.map((m) => m.speciesId),
        });
    } catch {
      out.push({ slot, exists: true, broken: true });
    }
  }
  return out;
}

export async function deleteSlot(slot: number): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).delete(mainKey(slot));
    tx.objectStore(STORE).delete(backupKey(slot));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ── 設定 ─────────────────────────────
export async function loadSettings(): Promise<Settings> {
  try {
    const db = await openDb();
    const raw = await req(db.transaction(STORE, 'readonly').objectStore(STORE).get('settings'));
    return validateSettings(raw);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export async function saveSettings(s: Settings): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put({ ...s }, 'settings');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // 設定が保存できなくてもゲームは続ける
  }
}

// ── エクスポート・インポート ───────────────────
const EXPORT_FORMAT = 'luminaria-tale-save';

export function exportSave(data: SaveData): string {
  const json = JSON.stringify(data);
  return JSON.stringify({ format: EXPORT_FORMAT, exportedAt: new Date().toISOString(), checksum: checksum(json), data: json });
}

/** インポート文字列を検証して SaveData にする（保存はしない。上書き確認は画面側で行う） */
export function parseImport(text: string, targetSlot: number): SaveData {
  let outer: unknown;
  try {
    outer = JSON.parse(text);
  } catch {
    throw new SaveError('broken', 'ファイルの形式が 正しくありません。');
  }
  const o = outer as { format?: string; checksum?: string; data?: string };
  if (!o || o.format !== EXPORT_FORMAT || typeof o.data !== 'string') throw new SaveError('broken', 'このゲームの セーブファイルでは ありません。');
  if (checksum(o.data) !== o.checksum) throw new SaveError('checksum', 'ファイルが 壊れているか、書きかえられています。');
  const data = validateSave(JSON.parse(o.data), true);
  data.slot = targetSlot;
  return data;
}

/** ブラウザに「消さないで」とお願いする（対応ブラウザのみ） */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    // 非対応
  }
  return false;
}
