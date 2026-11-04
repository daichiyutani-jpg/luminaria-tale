/**
 * ブラウザでの総合テスト（本番ビルドを使用）。
 *  - dist/ をサブディレクトリ（/luminaria-sub/）で配信し、GitHub Pages などと同じ条件にする
 *  - オフライン準備完了（Service Worker のキャッシュ）を確認
 *  - サーバー停止＋オフライン化 → 起動・はじめから・相棒選び・ライバル戦・草原・捕獲・メニュー・セーブ・つづきから を確認
 *  - 外部ドメインへの通信が一度も発生していないことを確認（ひとり用は完全オフライン）
 *
 * 実行: npm run build && npm run test:e2e
 * ブラウザはインストール済みの Microsoft Edge（なければ Chrome）を使う。
 * 画面写真は test-results/ に保存される。
 *
 * ※ 歩行や戦闘のコマンド選択は時間短縮のため、ゲーム内の入力処理（タップ時と同じ関数）を直接呼ぶ。
 *    ボタンは実際のクリックで押す。
 */
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { chromium } from 'playwright-core';

const DIST = 'dist';
const BASE = '/luminaria-sub/';
const PORT = 4213;
const ORIGIN = `http://localhost:${PORT}`;
const SHOTS = process.env.E2E_SCREENSHOTS || 'test-results';
mkdirSync(SHOTS, { recursive: true });

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

if (!existsSync(join(DIST, 'sw.js'))) {
  console.error('dist/sw.js がありません。先に npm run build を実行してください。');
  process.exit(1);
}

const server = createServer((req, res) => {
  const url = new URL(req.url, ORIGIN);
  if (url.pathname === BASE.slice(0, -1)) {
    res.writeHead(301, { Location: BASE });
    return res.end();
  }
  if (!url.pathname.startsWith(BASE)) {
    res.writeHead(404);
    return res.end('not found');
  }
  const rel = decodeURIComponent(url.pathname.slice(BASE.length)) || 'index.html';
  const file = normalize(join(DIST, rel));
  if (!file.startsWith(normalize(DIST)) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    return res.end('not found');
  }
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
  res.end(readFileSync(file));
});
await new Promise((r) => server.listen(PORT, r));

const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail });
  console.log(`${ok ? '✔' : '✘'} ${name}${detail ? `  (${detail})` : ''}`);
};

let browser;
try {
  browser = await chromium.launch({ channel: 'msedge', headless: true }).catch(() => chromium.launch({ channel: 'chrome', headless: true }));
} catch (e) {
  console.error('Edge / Chrome を起動できませんでした:', e.message);
  process.exit(1);
}

const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
});
const external = [];
context.on('request', (r) => {
  const u = r.url();
  if (!u.startsWith(ORIGIN) && !u.startsWith('data:') && !u.startsWith('blob:')) external.push(u);
});
const page = await context.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && pageErrors.push(m.text()));

const shot = async (name) => {
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
};

/** ページ内で使う操作ヘルパー（会話送り・戦闘の自動進行・歩行） */
async function installHelpers() {
  await page.evaluate(() => {
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const w = window;
    /** 会話・確認・戦闘を、何も起きなくなるまで進める。選択肢は prefer に合う物、なければ先頭を選ぶ */
    w.__settle = async (maxMs = 90000, prefer = []) => {
      const log = [];
      const t0 = Date.now();
      let idle = 0;
      while (Date.now() - t0 < maxMs) {
        await sleep(200);
        const m = document.querySelector('.dialog-layer .msg-box');
        if (m) {
          idle = 0;
          const t = m.textContent.replace('▼', '');
          if (log[log.length - 1] !== t) log.push(t);
          m.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          continue;
        }
        const dlg = [...document.querySelectorAll('.dialog-layer button:not([disabled])')];
        if (dlg.length) {
          idle = 0;
          (dlg.find((b) => prefer.some((p) => b.textContent.includes(p))) ?? dlg[0]).click();
          continue;
        }
        const bu = document.querySelector('.battle-ui');
        if (bu) {
          idle = 0;
          const bt = bu.querySelector('.bmsg')?.textContent;
          if (bt && log[log.length - 1] !== 'B:' + bt) log.push('B:' + bt);
          const btns = [...bu.querySelectorAll('button:not([disabled])')];
          const mv = btns.filter((b) => b.classList.contains('bmove'));
          if (mv.length) {
            // 「ばつぐん」→ 補助以外 → 何でも の順に選ぶ
            (mv.find((b) => b.textContent.includes('ばつぐん')) ?? mv.find((b) => !b.textContent.includes('補助')) ?? mv[0]).click();
            continue;
          }
          const fight = btns.find((b) => b.textContent.includes('たたかう'));
          if (fight) {
            fight.click();
            continue;
          }
          const mon = btns.find((b) => b.textContent.includes('Lv'));
          if (mon) mon.click();
          continue;
        }
        if (document.querySelector('.screen, .evo-screen, .ending')) break;
        const f = w.__game.app.field;
        if (f && !f.busy && !f.moving) {
          if (++idle > 5) break;
        } else idle = 0;
      }
      return log;
    };
    /** その場所をタップしたのと同じ処理で歩く（途中の会話・戦闘も進める） */
    w.__go = async (x, y) => {
      w.__game.app.field.onTap({ x, y });
      await sleep(300);
      return w.__settle();
    };
    w.__state = () => {
      const s = w.__game.session.data;
      return {
        map: w.__game.app.field?.map.id,
        flags: Object.keys(s.flags),
        party: s.party.map((m) => ({ id: m.speciesId, lv: m.level, hp: m.hp })),
        box: s.box.length,
        items: s.items,
        money: s.money,
        dex: Object.entries(s.dex).filter(([, v]) => v === 'caught').length,
        quests: Object.fromEntries(Object.entries(s.quests).map(([k, v]) => [k, v.state])),
      };
    };
  });
}

async function waitBoot() {
  await page.waitForFunction(() => !!window.__game, null, { timeout: 30_000 });
  await page.locator('.tap-start').waitFor({ timeout: 10_000 });
}

/** タイトルを「タップして はじめる」→ ボタン名で選ぶ */
async function titleTo(buttonName) {
  await page.locator('.tap-start').click();
  await page.getByRole('button', { name: buttonName }).click();
}

try {
  // 1. オンラインで初回アクセス
  const res = await page.goto(ORIGIN + BASE);
  check('オンラインで初回アクセスできる', res?.status() === 200);
  await waitBoot();
  check('タイトル画面が表示される', (await page.locator('.title-logo h1').textContent())?.includes('ルミナリア'));

  // 2. Service Worker のキャッシュ完了を確認（controller が付くまで開き直す）
  let sw = null;
  for (let i = 0; i < 20 && !sw?.complete; i++) {
    await page.waitForTimeout(1000);
    sw = await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      const ctrl = navigator.serviceWorker.controller;
      if (!ctrl) return { controlled: false };
      return new Promise((resolve) => {
        const ch = new MessageChannel();
        ch.port1.onmessage = (e) => resolve({ controlled: true, ...e.data });
        ctrl.postMessage({ type: 'GET_STATUS' }, [ch.port2]);
        setTimeout(() => resolve({ controlled: true, timeout: true }), 4000);
      });
    });
    if (!sw.controlled) {
      await page.reload();
      await waitBoot();
    }
  }
  check('Service Worker がページを管理している', sw?.controlled);
  check('オフライン用のファイルが全部キャッシュされた', sw?.complete, `${sw?.cached}/${sw?.total} 版 ${sw?.version}`);
  const swInfo = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    const keys = await caches.keys();
    return { scope: reg.scope, keys };
  });
  check('Service Worker のスコープがサブディレクトリ', swInfo.scope === ORIGIN + BASE, swInfo.scope);
  check('キャッシュは現在の版の1つだけ（新旧が混ざらない）', swInfo.keys.length === 1, swInfo.keys.join(', '));
  const manifest = await page.evaluate(async () => {
    const href = document.querySelector('link[rel=manifest]').href;
    const m = await (await fetch(href)).json();
    const icons = await Promise.all(m.icons.map(async (i) => (await fetch(new URL(i.src, href))).status));
    return { name: m.name, orientation: m.orientation, display: m.display, icons };
  });
  check('マニフェスト（縦向き・アプリ表示）とアイコンが読める', manifest.orientation === 'portrait' && manifest.display === 'standalone' && manifest.icons.every((s) => s === 200), manifest.name);
  await shot('01-title-online');

  // 3. サーバー停止＋オフライン化して起動
  await new Promise((r) => {
    server.close(r);
    server.closeAllConnections?.();
  });
  await context.setOffline(true);
  await page.reload();
  await waitBoot();
  check('サーバー停止・オフラインでも起動できる', await page.evaluate(() => navigator.onLine === false && !!window.__game));
  await installHelpers();

  // 4. はじめから → 名前 → 導入
  await titleTo('はじめから');
  await page.getByRole('button', { name: /スロット1/ }).click();
  await page.locator('input').fill('テスト');
  await page.getByRole('button', { name: 'けってい' }).click();
  await page.locator('.dialog-layer .msg-box').waitFor({ timeout: 10_000 });
  await shot('02-intro');
  const intro = await page.evaluate(() => window.__settle(15000));
  check('オフラインで「はじめから」を始められる', intro.length >= 3 && (await page.evaluate(() => window.__state().map)) === 'home', intro[0]);

  // 5. 家 → 村 → 研究所（ドアで移動）
  await page.evaluate(() => window.__go(3, 6));
  await page.waitForTimeout(1500);
  check('ドアを通って村へ出られる', (await page.evaluate(() => window.__state().map)) === 'village');
  await shot('03-village');
  await page.evaluate(() => window.__go(4, 4));
  await page.waitForTimeout(1500);
  check('研究所に入れる', (await page.evaluate(() => window.__state().map)) === 'lab');

  // 6. 博士と話して相棒を選ぶ（実際のボタンを押す）
  await page.evaluate(() => {
    window.__game.app.field.onTap({ x: 4, y: 2 });
  });
  for (let i = 0; i < 80 && !(await page.locator('.screen').count()); i++) {
    await page.evaluate(() => document.querySelector('.dialog-layer .msg-box')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    await page.waitForTimeout(200);
  }
  await shot('04-starter');
  await page.locator('.screen').getByText('シズクン').first().click();
  await page.getByRole('button', { name: 'この子にする' }).click();
  await page.evaluate(() => window.__settle(15000));
  let st = await page.evaluate(() => window.__state());
  check('相棒を選んで受け取れる', st.party.length === 1 && st.party[0].id === 'shizukun' && st.flags.includes('got_starter'), JSON.stringify(st.party));
  check('ランタンと回復薬をもらえる', (st.items.lantern ?? 0) > 0 && (st.items.potion ?? 0) > 0, JSON.stringify(st.items));

  // 7. ライバル戦（勝っても負けても話が進む）
  await page.evaluate(() => window.__game.app.field.onTap({ x: 7, y: 4 }));
  await page.locator('.battle-ui').waitFor({ timeout: 20_000 }).catch(() => {});
  for (let i = 0; i < 40 && !(await page.locator('.battle-ui button', { hasText: 'たたかう' }).count()); i++) {
    await page.evaluate(() => document.querySelector('.dialog-layer .msg-box')?.dispatchEvent(new PointerEvent('pointerup', { bubbles: true })));
    await page.waitForTimeout(250);
  }
  await shot('05-rival-battle');
  await page.locator('.battle-ui button', { hasText: 'たたかう' }).click();
  await page.waitForTimeout(300);
  await shot('06-moves');
  const rival = await page.evaluate(() => window.__settle(120000));
  st = await page.evaluate(() => window.__state());
  check('ライバル戦を最後まで戦える', st.flags.includes('rival1_done'), rival.filter((t) => t.startsWith('B:')).slice(-1)[0]);

  // 8. 博士から森の話 → 草原へ
  await page.evaluate(() => window.__go(4, 2));
  await page.evaluate(() => window.__go(4, 7));
  await page.waitForTimeout(1500);
  for (let i = 0; i < 4 && (await page.evaluate(() => window.__state().map)) !== 'grassland'; i++) {
    await page.evaluate(() => window.__go(8, 0));
    await page.waitForTimeout(1500);
  }
  st = await page.evaluate(() => window.__state());
  check('村の出口から草原へ出られる（相棒を持っていれば通れる）', st.map === 'grassland');
  await shot('07-grassland');

  // 9. 野生の灯獣を捕まえる（出会いは草むらと同じ処理で発生させる）
  let caught = false;
  for (let tries = 0; tries < 6 && !caught; tries++) {
    const before = await page.evaluate(() => window.__state().party.length + window.__state().box);
    await page.evaluate(() => {
      const s = window.__game.session.data;
      for (const m of s.party) m.hp = Math.max(m.hp, 1);
      void window.__game.app.onWildEncounter(window.__game.app.field, 'fuwamo', 3);
    });
    await page.locator('.battle-ui button', { hasText: 'つかまえる' }).waitFor({ timeout: 20_000 });
    if (tries === 0) await shot('08-wild');
    check(tries === 0 ? '野生戦では「つかまえる」「にげる」が選べる' : `野生戦 ${tries + 1} 回目`, await page.locator('.battle-ui button', { hasText: 'にげる' }).isEnabled());
    // 捕獲を試す（ランタンを投げ続ける。最初の1回だけ画面写真）
    for (let i = 0; i < 80; i++) {
      const step = await page.evaluate(() => {
        if (!document.querySelector('.battle-ui')) return 'end';
        const msg = document.querySelector('.dialog-layer .msg-box');
        if (msg) {
          msg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
          return 'msg';
        }
        const btns = [...document.querySelectorAll('.battle-ui button:not([disabled])')];
        const lan = btns.find((b) => b.textContent.includes('ランタン'));
        if (lan) {
          lan.click();
          return 'lantern';
        }
        const cap = btns.find((b) => b.textContent.includes('つかまえる'));
        if (cap) {
          cap.click();
          return 'menu';
        }
        return 'wait';
      });
      if (step === 'end') break;
      if (step === 'menu' && tries === 0 && i < 4) await shot('09-capture');
      await page.waitForTimeout(250);
    }
    await page.evaluate(() => window.__settle(30000));
    const after = await page.evaluate(() => window.__state().party.length + window.__state().box);
    caught = after > before;
    if (!caught) await page.evaluate(() => { window.__game.session.data.items.lantern = 5; });
  }
  st = await page.evaluate(() => window.__state());
  check('野生の灯獣を捕まえて なかまにできる', caught && st.party.some((m) => m.id === 'fuwamo'), JSON.stringify(st.party));
  check('捕まえた灯獣が図鑑に登録される', st.dex >= 2, `つかまえた ${st.dex}`);

  // 10. メニュー・図鑑・なかま・クエスト
  await page.getByRole('button', { name: /メニュー/ }).click();
  await page.getByRole('button', { name: /ずかん/ }).click();
  await shot('10-dex');
  check('図鑑が開ける', await page.locator('.screen').last().getByText('フワモ').count() > 0);
  await page.getByRole('button', { name: /もどる/ }).first().click();
  await page.getByRole('button', { name: /クエスト/ }).click();
  await shot('11-quests');
  await page.getByRole('button', { name: /もどる/ }).first().click();

  // 11. セーブ → 開き直して つづきから
  await page.getByRole('button', { name: /レポート/ }).click();
  await page.getByRole('button', { name: /セーブする/ }).click();
  await page.evaluate(() => window.__settle(5000, ['セーブ', 'はい', 'OK']));
  await page.waitForTimeout(800);
  const savedState = await page.evaluate(() => window.__state());
  await page.reload();
  await waitBoot();
  await installHelpers();
  await titleTo('つづきから');
  await page.getByRole('button', { name: /スロット1/ }).click();
  await page.waitForFunction(() => !!window.__game.app.field, null, { timeout: 10_000 });
  await page.waitForTimeout(1000);
  st = await page.evaluate(() => window.__state());
  check('オフラインでセーブ → 開き直して「つづきから」で再開できる', st.map === savedState.map && st.party.length === savedState.party.length && st.flags.length === savedState.flags.length, `${st.map} / なかま ${st.party.length}`);
  await shot('12-continue');

  // 12. 設定画面のオフライン表示
  await page.getByRole('button', { name: /メニュー/ }).click();
  await page.getByRole('button', { name: /せってい/ }).click();
  await page.waitForTimeout(1500);
  const offlineText = await page.locator('.screen').last().textContent();
  check('設定画面に「オフラインで遊べます」と表示される', offlineText.includes('オフラインで 遊べます'));
  await shot('13-settings');
  await page.getByRole('button', { name: /もどる/ }).first().click();

  // 13. つうしん（未実装）は準備中で、通信しない
  await page.getByRole('button', { name: /つうしん/ }).click();
  await page.waitForTimeout(500);
  check('「つうしん」は準備中と表示される', (await page.locator('.screen').last().textContent()).includes('じゅんびちゅう'));
  await shot('14-online-wip');

  check('外部ドメインへの通信がない', external.length === 0, external.slice(0, 3).join(', '));
  check('ページのエラーがない', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));
} catch (e) {
  check('テスト実行中に例外', false, e.stack);
  await page.screenshot({ path: `${SHOTS}/error.png` }).catch(() => {});
} finally {
  await browser.close();
  server.close();
}

const failedCount = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failedCount}/${results.length} 項目 OK`);
process.exit(failedCount ? 1 : 0);
