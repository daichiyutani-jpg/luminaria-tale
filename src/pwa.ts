/**
 * Service Worker の登録・更新・オフライン準備の確認。
 * 開発サーバー（vite dev）では登録しない。
 */
export interface OfflineStatus {
  ready: boolean;
  message: string;
  version?: string;
}

let registration: ServiceWorkerRegistration | null = null;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<() => void>();

export function onUpdateReady(fn: () => void): void {
  listeners.add(fn);
  if (waitingWorker) fn();
}

export function updateWaiting(): boolean {
  return !!waitingWorker;
}

export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator) || import.meta.env.DEV) return;
  try {
    registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    const track = (w: ServiceWorker | null) => {
      if (!w) return;
      w.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) {
          waitingWorker = w;
          listeners.forEach((f) => f());
        }
      });
    };
    if (registration.waiting && navigator.serviceWorker.controller) {
      waitingWorker = registration.waiting;
      listeners.forEach((f) => f());
    }
    track(registration.installing);
    registration.addEventListener('updatefound', () => track(registration!.installing));
    // 起動中は1時間ごとに更新を確認（オフラインなら失敗するだけ）
    window.setInterval(() => void registration?.update().catch(() => undefined), 60 * 60 * 1000);
  } catch (e) {
    console.warn('service worker の登録に失敗', e);
  }
}

/** 新しい版に切り替える（ページを読み込み直す）。セーブは呼ぶ側で済ませておく */
export function applyUpdate(): void {
  if (!waitingWorker) return;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloaded) return;
    reloaded = true;
    location.reload();
  });
  waitingWorker.postMessage({ type: 'SKIP_WAITING' });
}

export async function offlineStatus(): Promise<OfflineStatus> {
  if (!('serviceWorker' in navigator)) return { ready: false, message: 'このブラウザは オフライン機能に 対応していません。' };
  if (import.meta.env.DEV) return { ready: false, message: '開発サーバーでは オフライン機能は 動きません（公開版で 使えます）。' };
  const ctrl = navigator.serviceWorker.controller;
  const reg = registration ?? (await navigator.serviceWorker.getRegistration());
  const worker = ctrl ?? reg?.active;
  if (!worker) return { ready: false, message: 'オフラインの準備中です。少し待ってから もう一度 ひらいてください。' };
  try {
    const status = await new Promise<{ version: string; total: number; cached: number; complete: boolean }>((resolve, reject) => {
      const ch = new MessageChannel();
      const t = window.setTimeout(() => reject(new Error('timeout')), 4000);
      ch.port1.onmessage = (e) => {
        window.clearTimeout(t);
        resolve(e.data);
      };
      worker.postMessage({ type: 'GET_STATUS' }, [ch.port2]);
    });
    if (status.complete && ctrl) return { ready: true, version: status.version, message: `✔ オフラインで 遊べます（${status.cached}/${status.total} ファイル保存ずみ・版 ${status.version}）` };
    if (status.complete) return { ready: false, version: status.version, message: '保存は完了しました。一度 ゲームを開き直すと オフラインで 遊べるようになります。' };
    return { ready: false, version: status.version, message: `保存中…（${status.cached}/${status.total}）` };
  } catch {
    return { ready: false, message: 'オフラインの準備状況を 確認できませんでした。' };
  }
}
