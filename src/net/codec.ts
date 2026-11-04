/**
 * 通信まわりで使う小さな変換（文字列 ⇄ base64url、名前の整え）。ブラウザと Node（テスト）の両方で動く。
 */

export function utf8ToB64url(text: string): string {
  const bytes = new TextEncoder().encode(text);
  return bytesToB64url(bytes);
}

export function b64urlToUtf8(b64: string): string {
  return new TextDecoder('utf-8', { fatal: true }).decode(b64urlToBytes(b64));
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function b64urlToBytes(b64: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(b64)) throw new Error('bad base64');
  const s = b64.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(s + '='.repeat((4 - (s.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** 制御文字・見えない文字・向きを変える文字 */
const BAD_CHARS = new RegExp('[' + String.fromCharCode(0) + '-' + String.fromCharCode(0x1f) + String.fromCharCode(0x7f) + String.fromCharCode(0x200b) + '-' + String.fromCharCode(0x200f) + String.fromCharCode(0x2028) + '-' + String.fromCharCode(0x202e) + String.fromCharCode(0x2066) + '-' + String.fromCharCode(0x2069) + String.fromCharCode(0xfeff) + ']', 'g');

/** 相手から来た名前：制御文字を除き、長さを切る */
export function cleanName(v: unknown, max = 12): string {
  if (typeof v !== 'string') return '';
  return [...v.replace(BAD_CHARS, '').trim()].slice(0, max).join('');
}

/** 32bit の乱数（シード・合言葉用） */
export function randomU32(): number {
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) return crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 0x1_0000_0000) >>> 0;
}
