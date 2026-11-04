/**
 * QRコードの表示（qrcode-generator, MIT）と読み取り（jsQR, Apache-2.0）。
 * この2つは「つうしん」画面を開いた時だけ読みこまれる（src/ui/link.ts からの動的 import）。
 */
import qrcode from 'qrcode-generator';
import jsQR from 'jsqr';

/** QR の白黒の並び（true＝黒） */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'L');
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** QR を canvas に描く（まわりに白い余白 4マス） */
export function renderQr(text: string, px = 280): HTMLCanvasElement {
  const m = qrMatrix(text);
  const n = m.length + 8;
  const cell = Math.max(2, Math.floor(px / n));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cell * n;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000';
  m.forEach((row, r) => row.forEach((dark, c) => dark && ctx.fillRect((c + 4) * cell, (r + 4) * cell, cell, cell)));
  return canvas;
}

/** 画像の画素（RGBA）から QR を読む */
export function decodeRgba(data: Uint8ClampedArray, width: number, height: number, thorough = false): string | null {
  const r = jsQR(data, width, height, { inversionAttempts: thorough ? 'attemptBoth' : 'dontInvert' });
  return r?.data ? r.data : null;
}

/** 写真（ファイル）から QR を読む。大きい写真は縮めてから読む */
export async function decodeImageFile(file: Blob): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('画像を 読めませんでした'));
      im.src = url;
    });
    for (const max of [1200, 800, 1800]) {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const w = Math.max(1, Math.round(img.naturalWidth * k));
      const h = Math.max(1, Math.round(img.naturalHeight * k));
      const c = document.createElement('canvas');
      c.width = w;
      c.height = h;
      const ctx = c.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, w, h);
      const text = decodeRgba(ctx.getImageData(0, 0, w, h).data, w, h, true);
      if (text) return text;
    }
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** カメラで読み続ける。読めたら onText。stop() で止める */
export class CameraScanner {
  private stream: MediaStream | null = null;
  private timer: number | null = null;
  private canvas = document.createElement('canvas');

  constructor(
    private video: HTMLVideoElement,
    private onText: (text: string) => void,
  ) {}

  static available(): boolean {
    return !!navigator.mediaDevices?.getUserMedia;
  }

  async start(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    this.video.srcObject = this.stream;
    this.video.setAttribute('playsinline', '');
    this.video.muted = true;
    await this.video.play();
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true })!;
    this.timer = window.setInterval(() => {
      const v = this.video;
      if (v.readyState < 2 || !v.videoWidth) return;
      const k = Math.min(1, 720 / Math.max(v.videoWidth, v.videoHeight));
      const w = Math.round(v.videoWidth * k);
      const h = Math.round(v.videoHeight * k);
      this.canvas.width = w;
      this.canvas.height = h;
      ctx.drawImage(v, 0, 0, w, h);
      const text = decodeRgba(ctx.getImageData(0, 0, w, h).data, w, h);
      if (text) this.onText(text);
    }, 200);
  }

  stop(): void {
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.video.srcObject = null;
  }
}
