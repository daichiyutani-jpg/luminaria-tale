/**
 * WebRTC の接続情報（SDP）を、QR に入る短い文字列にする／元に戻す。
 *
 * データチャンネルだけの接続に必要なのは、ICE の合言葉（ufrag / pwd）、DTLS の指紋（fingerprint）、
 * 役割（setup）、mid、接続先の候補（candidate）だけ。残りは決まった形なので、読みこむ側で組み立て直す。
 *
 *   LMO1~<モード>~<STUN>~<ufrag>~<pwd>~<指紋>~<setup>~<mid>~<候補>...~<チェック4けた>   （へやを作った側）
 *   LMA1~-~-~<ufrag>~<pwd>~<指紋>~<setup>~<mid>~<候補>...~<チェック4けた>              （参加する側の返事）
 *   候補 = <種類 h/s/p/r><アドレス>:<ポート>
 */
import { checksum } from '../save/validate';
import { b64urlToBytes, bytesToB64url } from './codec';

export type LinkMode = 'battle' | 'trade';

export interface SdpCandidate {
  type: 'host' | 'srflx' | 'prflx' | 'relay';
  address: string;
  port: number;
}

export interface SdpEssentials {
  ufrag: string;
  pwd: string;
  /** 例: sha-256 */
  fpAlg: string;
  /** 16進を : でつないだもの（大文字） */
  fingerprint: string;
  setup: 'actpass' | 'active' | 'passive';
  mid: string;
  candidates: SdpCandidate[];
}

export interface SignalPayload {
  kind: 'offer' | 'answer';
  /** へやの種類（offer のみ） */
  mode?: LinkMode;
  /** へやを作った側が 公開サーバー（STUN）を使ったか（offer のみ） */
  stun?: boolean;
  sdp: SdpEssentials;
}

const MAX_CANDIDATES = 6;
const TYPE_CHAR: Record<SdpCandidate['type'], string> = { host: 'h', srflx: 's', prflx: 'p', relay: 'r' };
const CHAR_TYPE: Record<string, SdpCandidate['type']> = { h: 'host', s: 'srflx', p: 'prflx', r: 'relay' };
const SETUP_CHAR = { actpass: 'a', active: 'c', passive: 'p' } as const;
const CHAR_SETUP: Record<string, SdpEssentials['setup']> = { a: 'actpass', c: 'active', p: 'passive' };
const TYPE_PREF: Record<SdpCandidate['type'], number> = { host: 126, prflx: 110, srflx: 100, relay: 0 };

/** SDP から必要な所だけ取り出す */
export function extractSdp(sdp: string): SdpEssentials {
  const lines = sdp.split(/\r?\n/).map((l) => l.trim());
  const attr = (name: string) => lines.find((l) => l.startsWith(`a=${name}:`))?.slice(name.length + 3).trim();
  const ufrag = attr('ice-ufrag');
  const pwd = attr('ice-pwd');
  const fp = attr('fingerprint');
  const setup = attr('setup');
  const mid = attr('mid') ?? '0';
  if (!ufrag || !pwd || !fp || !setup) throw new Error('SDP に必要な情報がありません');
  const [fpAlg, fingerprint] = fp.split(/\s+/);
  if (!fpAlg || !fingerprint) throw new Error('fingerprint が読めません');
  if (setup !== 'actpass' && setup !== 'active' && setup !== 'passive') throw new Error('setup が読めません');
  const candidates: SdpCandidate[] = [];
  const seen = new Set<string>();
  for (const l of lines) {
    if (!l.startsWith('a=candidate:')) continue;
    const p = l.slice('a=candidate:'.length).split(/\s+/);
    // foundation component transport priority address port typ type ...
    if (p.length < 8 || p[1] !== '1' || p[2].toLowerCase() !== 'udp' || p[6] !== 'typ') continue;
    const type = p[7] as SdpCandidate['type'];
    if (!(type in TYPE_CHAR)) continue;
    const port = Number(p[5]);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) continue;
    const key = `${p[4]}:${port}`;
    if (seen.has(key)) continue;
    seen.add(key);
    candidates.push({ type, address: p[4], port });
  }
  // 近い順（host → srflx …）に並べ、多すぎる時は切る
  candidates.sort((a, b) => TYPE_PREF[b.type] - TYPE_PREF[a.type]);
  return { ufrag, pwd, fpAlg: fpAlg.toLowerCase(), fingerprint: fingerprint.toUpperCase(), setup, mid, candidates: candidates.slice(0, MAX_CANDIDATES) };
}

/** 取り出した情報から、ブラウザに渡せる SDP を組み立て直す */
export function buildSdp(e: SdpEssentials, sessionId = '4611731400430051336'): string {
  const lines = [
    'v=0',
    `o=- ${sessionId} 2 IN IP4 127.0.0.1`,
    's=-',
    't=0 0',
    `a=group:BUNDLE ${e.mid}`,
    'a=msid-semantic: WMS',
    'm=application 9 UDP/DTLS/SCTP webrtc-datachannel',
    'c=IN IP4 0.0.0.0',
  ];
  e.candidates.forEach((c, i) => {
    const priority = TYPE_PREF[c.type] * 2 ** 24 + (65535 - i) * 2 ** 8 + 255;
    lines.push(`a=candidate:${i + 1} 1 udp ${priority} ${c.address} ${c.port} typ ${c.type}${c.type === 'host' ? '' : ' raddr 0.0.0.0 rport 0'} generation 0`);
  });
  lines.push(
    `a=ice-ufrag:${e.ufrag}`,
    `a=ice-pwd:${e.pwd}`,
    `a=fingerprint:${e.fpAlg} ${e.fingerprint}`,
    `a=setup:${e.setup}`,
    `a=mid:${e.mid}`,
    'a=sctp-port:5000',
    'a=max-message-size:262144',
  );
  return lines.join('\r\n') + '\r\n';
}

const SEP = '~';

/** 接続情報を QR 用の短い文字列にする */
export function encodeSignal(p: SignalPayload): string {
  const e = p.sdp;
  const fpBytes = new Uint8Array(e.fingerprint.split(':').map((x) => parseInt(x, 16)));
  const fp = (e.fpAlg === 'sha-256' ? '' : `${e.fpAlg}|`) + bytesToB64url(fpBytes);
  const head = p.kind === 'offer' ? 'LMO1' : 'LMA1';
  const mode = p.kind === 'offer' ? (p.mode === 'trade' ? 't' : 'b') : '-';
  const stun = p.kind === 'offer' ? (p.stun ? '1' : '0') : '-';
  const cands = e.candidates.map((c) => `${TYPE_CHAR[c.type]}${c.address}:${c.port}`);
  const body = [head, mode, stun, e.ufrag, e.pwd, fp, SETUP_CHAR[e.setup], e.mid, ...cands].join(SEP);
  return `${body}${SEP}${checksum(body).slice(0, 4)}`;
}

export function isSignalCode(text: string): 'offer' | 'answer' | null {
  const t = text.trim();
  if (t.startsWith('LMO')) return 'offer';
  if (t.startsWith('LMA')) return 'answer';
  return null;
}

/** QR の文字列を読む。壊れていたら理由つきの Error */
export function decodeSignal(text: string): SignalPayload {
  const t = text.trim();
  const cut = t.lastIndexOf(SEP);
  if (cut < 0) throw new Error('つうしんの QRコードでは ありません');
  const body = t.slice(0, cut);
  if (checksum(body).slice(0, 4) !== t.slice(cut + 1)) throw new Error('QRコードが かけています（もういちど よみとってね）');
  const f = body.split(SEP);
  if (f.length < 8) throw new Error('QRコードの なかみが たりません');
  const [head, mode, stun, ufrag, pwd, fp, setupC, mid, ...cands] = f;
  let kind: SignalPayload['kind'];
  if (head === 'LMO1') kind = 'offer';
  else if (head === 'LMA1') kind = 'answer';
  else if (/^LM[OA]\d+$/.test(head)) throw new Error('ちがう ばんの ゲームの QRです。りょうほう さいしんに こうしんしてね');
  else throw new Error('つうしんの QRコードでは ありません');
  const iceChar = /^[A-Za-z0-9+/]+$/;
  if (!iceChar.test(ufrag) || !iceChar.test(pwd) || ufrag.length > 256 || pwd.length > 256) throw new Error('QRコードの なかみが こわれています');
  const setup = CHAR_SETUP[setupC];
  if (!setup || !/^[A-Za-z0-9_-]{1,32}$/.test(mid)) throw new Error('QRコードの なかみが こわれています');
  let fpAlg = 'sha-256';
  let fpB64 = fp;
  if (fp.includes('|')) [fpAlg, fpB64] = fp.split('|');
  if (!/^sha-(1|224|256|384|512)$/.test(fpAlg)) throw new Error('QRコードの なかみが こわれています');
  const fingerprint = [...b64urlToBytes(fpB64)].map((b) => b.toString(16).padStart(2, '0').toUpperCase()).join(':');
  const candidates: SdpCandidate[] = [];
  for (const c of cands.slice(0, MAX_CANDIDATES)) {
    const type = CHAR_TYPE[c[0]];
    const colon = c.lastIndexOf(':');
    const address = c.slice(1, colon);
    const port = Number(c.slice(colon + 1));
    if (!type || colon < 2 || !/^[A-Za-z0-9.:\-]+$/.test(address) || !Number.isInteger(port) || port <= 0 || port > 65535) throw new Error('QRコードの なかみが こわれています');
    candidates.push({ type, address, port });
  }
  const sdp: SdpEssentials = { ufrag, pwd, fpAlg, fingerprint, setup, mid, candidates };
  if (kind === 'offer') return { kind, mode: mode === 't' ? 'trade' : 'battle', stun: stun === '1', sdp };
  return { kind, sdp };
}
