/**
 * 引き継ぎコード：セーブデータを「コピーして貼り付けられる文字」にする。
 * iPhone では Safari・LINE の中のブラウザ・ホーム画面に追加したアプリが それぞれ別の保存場所を持つため、
 * サーバーなしで データを移すには 文字かファイルで運ぶしかない。
 *
 * 形式：`LUMI1-` ＋ base64url（deflate 圧縮した exportSave の文字列）。
 * 圧縮が使えない端末では `LUMI0-` ＋ base64url（圧縮なし）。
 * 中身は exportSave と同じなので、読み込み時は parseImport でチェックサムと内容を確かめる。
 */
import type { SaveData } from '../core/types';
import { exportSave, parseImport } from './saveManager';
import { SaveError } from './validate';

const ZIP = 'LUMI1-';
const RAW = 'LUMI0-';

function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const res = new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await res.arrayBuffer());
}

export async function makeTransferCode(data: SaveData): Promise<string> {
  const bytes = new TextEncoder().encode(exportSave(data));
  if (typeof CompressionStream !== 'undefined') {
    try {
      return ZIP + toB64url(await pipe(bytes, new CompressionStream('deflate')));
    } catch {
      // 圧縮に失敗したら そのまま
    }
  }
  return RAW + toB64url(bytes);
}

/** 引き継ぎコード（または書き出したファイルの中身）を SaveData にする。保存はしない */
export async function readTransferCode(input: string, targetSlot: number): Promise<SaveData> {
  const text = input.trim();
  if (text.startsWith('{')) return parseImport(text, targetSlot);
  // LINE などで 改行や空白が まざっても 読めるように
  const code = text.replace(/\s+/g, '');
  const head = code.slice(0, ZIP.length);
  if (head !== ZIP && head !== RAW) throw new SaveError('broken', '引き継ぎコードでは ありません。「LUMI」で 始まる 文字を ぜんぶ 貼り付けてください。');
  let bytes: Uint8Array;
  try {
    bytes = fromB64url(code.slice(ZIP.length));
    if (head === ZIP) {
      if (typeof DecompressionStream === 'undefined') throw new SaveError('io', 'この端末では この コードを 読めません。ファイルの 書き出しを 使ってください。');
      bytes = await pipe(bytes, new DecompressionStream('deflate'));
    }
  } catch (e) {
    if (e instanceof SaveError) throw e;
    throw new SaveError('broken', 'コードが とちゅうで 切れているか、まちがっています。さいごまで ぜんぶ コピーしてください。');
  }
  return parseImport(new TextDecoder().decode(bytes), targetSlot);
}
