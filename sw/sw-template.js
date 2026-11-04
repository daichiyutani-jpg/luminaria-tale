/*
 * ルミナリア・テイル Service Worker
 * ビルド時（vite.config.ts）に VERSION と ASSETS が埋め込まれ、dist/sw.js として出力される。
 * - インストール時に全ファイルを「その版専用のキャッシュ」に保存する。1つでも失敗したらインストールしない
 * - 読み込みは今の版のキャッシュだけを見る（古い版と新しい版のファイルが混ざらない）
 * - 新しい版は、ゲーム側が「更新する」を押した時（SKIP_WAITING）に切り替わる
 * - セーブデータは IndexedDB にあるので、キャッシュの削除では消えない
 */
const VERSION = '__VERSION__';
const CACHE_PREFIX = 'luminaria-';
const CACHE_NAME = CACHE_PREFIX + VERSION;
const ASSETS = __ASSETS__;

const scopeUrl = (path) => new URL(path, self.registration.scope).href;
const INDEX_URL = scopeUrl('index.html');

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS.map((path) => new Request(scopeUrl(path), { cache: 'reload' })))),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith(CACHE_PREFIX) && k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'GET_STATUS') {
    const port = event.ports && event.ports[0];
    if (!port) return;
    event.waitUntil(
      caches.open(CACHE_NAME).then(async (cache) => {
        const results = await Promise.all(ASSETS.map((path) => cache.match(scopeUrl(path), { ignoreVary: true })));
        const cached = results.filter(Boolean).length;
        port.postMessage({ version: VERSION, total: ASSETS.length, cached, complete: cached === ASSETS.length });
      }),
    );
  }
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  // 他のサイトへの通信には関与しない（このゲームは通常プレイで外部へ通信しない）
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      if (request.mode === 'navigate') {
        // 攻略ガイド（guide.html）など、ゲーム以外のページはそのページを返す。それ以外はゲーム本体
        const page = await cache.match(request, { ignoreVary: true, ignoreSearch: true });
        if (page) return page;
        const cached = await cache.match(INDEX_URL, { ignoreVary: true });
        if (cached) return cached;
        return fetch(request);
      }
      // サーバーが Vary: Origin を返すと module script の要求と一致しないので ignoreVary
      const cached = (await cache.match(request, { ignoreVary: true })) || (await cache.match(request, { ignoreVary: true, ignoreSearch: true }));
      if (cached) return cached;
      return fetch(request);
    })(),
  );
});
