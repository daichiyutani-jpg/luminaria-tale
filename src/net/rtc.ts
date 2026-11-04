/**
 * 2台の端末を WebRTC のデータチャンネルで直接つなぐ（サーバーなし）。
 *
 * 1. へやを作る側：offer を作り、候補が集まりきるのを待って（trickle しない）、短い文字列＝QR にする
 * 2. 参加する側：その QR を読んで answer を作り、同じように QR にする
 * 3. へやを作った側が answer の QR を読むと、つながる
 *
 * 公開サーバー（STUN）は、本人が「インターネットごしに つなぐ」を選んだ時だけ使う。
 * 使わない時は、同じ Wi‑Fi の中でだけ つながる（外へは何も送らない）。
 */
import { buildSdp, decodeSignal, encodeSignal, extractSdp, type LinkMode } from './sdp';

export const PUBLIC_STUN = 'stun:stun.l.google.com:19302';
const HEARTBEAT_MS = 4000;
const SILENCE_LIMIT_MS = 30000;

export type NetMessage = { t: string; [k: string]: unknown };

export class LinkClosedError extends Error {
  constructor(public reason: string) {
    super(reason);
  }
}

function iceConfig(internet: boolean): RTCConfiguration {
  return { iceServers: internet ? [{ urls: PUBLIC_STUN }] : [] };
}

function waitGathering(pc: RTCPeerConnection, ms: number): Promise<void> {
  return new Promise((resolve) => {
    if (pc.iceGatheringState === 'complete') return resolve();
    const t = window.setTimeout(done, ms);
    function done() {
      window.clearTimeout(t);
      pc.removeEventListener('icegatheringstatechange', check);
      resolve();
    }
    function check() {
      if (pc.iceGatheringState === 'complete') done();
    }
    pc.addEventListener('icegatheringstatechange', check);
  });
}

export function webrtcAvailable(): boolean {
  return typeof RTCPeerConnection !== 'undefined';
}

/** つながった後の やりとり（メッセージの受け取り箱・切断の検出） */
export class PeerLink {
  private dc: RTCDataChannel | null = null;
  private queues = new Map<string, NetMessage[]>();
  private waiters = new Map<string, ((m: NetMessage) => void)[]>();
  private listeners = new Map<string, (m: NetMessage) => void>();
  private closeFns: ((reason: string) => void)[] = [];
  private rejecters = new Set<(e: Error) => void>();
  private lastHeard = Date.now();
  private beat: number | null = null;
  closed: string | null = null;
  readonly opened: Promise<void>;
  private resolveOpen!: () => void;

  constructor(
    private pc: RTCPeerConnection,
    readonly role: 'host' | 'guest',
    readonly mode: LinkMode,
  ) {
    this.opened = new Promise((r) => (this.resolveOpen = r));
    pc.addEventListener('connectionstatechange', () => {
      if (pc.connectionState === 'failed') this.close('つうしんが きれました');
    });
  }

  attach(dc: RTCDataChannel): void {
    this.dc = dc;
    dc.addEventListener('open', () => {
      this.lastHeard = Date.now();
      this.beat = window.setInterval(() => {
        if (Date.now() - this.lastHeard > SILENCE_LIMIT_MS) this.close('あいてからの へんじが ありません');
        else this.send({ t: 'ping' });
      }, HEARTBEAT_MS);
      this.resolveOpen();
    });
    dc.addEventListener('close', () => this.close('つうしんが きれました'));
    dc.addEventListener('message', (e) => {
      this.lastHeard = Date.now();
      if (typeof e.data !== 'string' || e.data.length > 64_000) return;
      let m: unknown;
      try {
        m = JSON.parse(e.data);
      } catch {
        return;
      }
      if (typeof m !== 'object' || m === null || typeof (m as NetMessage).t !== 'string') return;
      this.deliver(m as NetMessage);
    });
  }

  private deliver(m: NetMessage): void {
    if (m.t === 'ping') return;
    if (m.t === 'bye') {
      this.close('あいてが つうしんを おわりました');
      return;
    }
    const l = this.listeners.get(m.t);
    if (l) return l(m);
    const w = this.waiters.get(m.t);
    if (w && w.length) return w.shift()!(m);
    const q = this.queues.get(m.t) ?? [];
    q.push(m);
    this.queues.set(m.t, q);
  }

  send(m: NetMessage): void {
    if (this.closed || !this.dc || this.dc.readyState !== 'open') return;
    try {
      this.dc.send(JSON.stringify(m));
    } catch {
      this.close('つうしんが きれました');
    }
  }

  /** その種類のメッセージを1つ待つ（届いていれば すぐ返す） */
  next(t: string): Promise<NetMessage> {
    if (this.closed) return Promise.reject(new LinkClosedError(this.closed));
    const q = this.queues.get(t);
    if (q && q.length) return Promise.resolve(q.shift()!);
    return new Promise((resolve, reject) => {
      const list = this.waiters.get(t) ?? [];
      const rej = (e: Error) => reject(e);
      this.rejecters.add(rej);
      list.push((m) => {
        this.rejecters.delete(rej);
        resolve(m);
      });
      this.waiters.set(t, list);
    });
  }

  /** その種類のメッセージが来るたびに呼ぶ（受け取り箱には入れない） */
  on(t: string, fn: (m: NetMessage) => void): void {
    this.listeners.set(t, fn);
    const q = this.queues.get(t);
    if (q) {
      this.queues.delete(t);
      q.forEach(fn);
    }
  }

  onClose(fn: (reason: string) => void): void {
    if (this.closed) fn(this.closed);
    else this.closeFns.push(fn);
  }

  close(reason = 'つうしんを おわりました', notify = false): void {
    if (this.closed) return;
    if (notify) this.send({ t: 'bye' });
    this.closed = reason;
    if (this.beat !== null) window.clearInterval(this.beat);
    const err = new LinkClosedError(reason);
    this.rejecters.forEach((r) => r(err));
    this.rejecters.clear();
    this.waiters.clear();
    // bye を送り切ってから閉じる
    window.setTimeout(() => {
      try {
        this.dc?.close();
        this.pc.close();
      } catch {
        /* すでに閉じている */
      }
    }, notify ? 300 : 0);
    this.closeFns.splice(0).forEach((f) => f(reason));
  }
}

/** へやを作る：offer の QR 文字列と、answer を受け取る関数を返す */
export async function createRoom(mode: LinkMode, internet: boolean): Promise<{ link: PeerLink; code: string; accept: (answerCode: string) => Promise<void> }> {
  const pc = new RTCPeerConnection(iceConfig(internet));
  const link = new PeerLink(pc, 'host', mode);
  link.attach(pc.createDataChannel('luminaria', { ordered: true }));
  await pc.setLocalDescription(await pc.createOffer());
  await waitGathering(pc, internet ? 6000 : 3000);
  const code = encodeSignal({ kind: 'offer', mode, stun: internet, sdp: extractSdp(pc.localDescription!.sdp) });
  const accept = async (answerCode: string) => {
    const p = decodeSignal(answerCode);
    if (p.kind !== 'answer') throw new Error('あいての「へんじの QR」を よみとってね');
    await pc.setRemoteDescription({ type: 'answer', sdp: buildSdp(p.sdp) });
  };
  return { link, code, accept };
}

/** へやに入る：offer の QR から answer の QR 文字列を作る */
export async function joinRoom(offerCode: string, internet: boolean): Promise<{ link: PeerLink; code: string; mode: LinkMode }> {
  const p = decodeSignal(offerCode);
  if (p.kind !== 'offer') throw new Error('へやを つくった人の QR を よみとってね');
  const useStun = internet || !!p.stun;
  const pc = new RTCPeerConnection(iceConfig(useStun));
  const link = new PeerLink(pc, 'guest', p.mode ?? 'battle');
  pc.addEventListener('datachannel', (e) => link.attach(e.channel));
  await pc.setRemoteDescription({ type: 'offer', sdp: buildSdp(p.sdp) });
  await pc.setLocalDescription(await pc.createAnswer());
  await waitGathering(pc, useStun ? 6000 : 3000);
  const code = encodeSignal({ kind: 'answer', sdp: extractSdp(pc.localDescription!.sdp) });
  return { link, code, mode: link.mode };
}
