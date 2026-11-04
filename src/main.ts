import './ui/styles.css';
import { app } from './core/app';
import { registerServiceWorker } from './pwa';

function showFatal(msg: string): void {
  const el = document.getElementById('boot-error');
  if (!el) return;
  el.hidden = false;
  el.textContent = `エラーが おきました：${msg}\n（画面を 読み込み直すと なおることがあります。セーブデータは 消えていません）`;
}

// 予期しないエラーでゲーム全体が止まらないよう、表示だけして続ける
window.addEventListener('error', (e) => {
  console.error(e.error ?? e.message);
  showFatal(String(e.message ?? e.error));
});
window.addEventListener('unhandledrejection', (e) => {
  console.error(e.reason);
  showFatal(String((e.reason as Error)?.message ?? e.reason));
});

// iOS のダブルタップ拡大・ピンチを防ぐ
document.addEventListener('gesturestart', (e) => e.preventDefault());

void registerServiceWorker();
app.start().catch((e) => showFatal((e as Error).message));
