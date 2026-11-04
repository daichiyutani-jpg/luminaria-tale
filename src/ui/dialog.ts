/**
 * 会話ウィンドウ・選択肢・確認ダイアログ・お知らせ（トースト）。すべて Promise で待てる。
 */
import { audio } from '../audio/audio';
import { h, uiRoot } from './dom';

let layer: HTMLElement | null = null;
function getLayer(): HTMLElement {
  if (!layer || !layer.isConnected) {
    layer = h('div', { class: 'dialog-layer' });
    uiRoot().append(layer);
  }
  return layer;
}

/** タイプライター表示のメッセージ。タップで全文表示→次へ */
export function say(text: string, who?: string, opts: { auto?: number } = {}): Promise<void> {
  return new Promise((resolve) => {
    const body = h('div', { class: 'msg-text' });
    const box = h('div', { class: 'msg-box', role: 'dialog' }, who ? h('div', { class: 'msg-name' }, who) : null, body, h('div', { class: 'msg-next' }, '▼'));
    getLayer().append(box);
    let i = 0;
    let done = false;
    let timer = window.setInterval(() => {
      i += 2;
      body.textContent = text.slice(0, i);
      if (i >= text.length) finishTyping();
    }, 24);
    let autoTimer: number | null = null;
    function finishTyping() {
      if (done) return;
      done = true;
      window.clearInterval(timer);
      body.textContent = text;
      box.classList.add('ready');
      if (opts.auto) autoTimer = window.setTimeout(close, opts.auto);
    }
    function close() {
      if (autoTimer) window.clearTimeout(autoTimer);
      box.remove();
      window.removeEventListener('keydown', onKey);
      resolve();
    }
    const advance = () => {
      if (!done) finishTyping();
      else {
        audio.se('cursor');
        close();
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ' || e.key === 'z') advance();
    };
    box.addEventListener('pointerup', advance);
    window.addEventListener('keydown', onKey);
    timer = timer || 0;
  });
}

export interface ChoiceOption<T> {
  label: string;
  value: T;
  sub?: string;
  disabled?: boolean;
}

/** 選択肢。cancelValue を渡すと「やめる」で閉じられる */
export function choose<T>(question: string | null, options: ChoiceOption<T>[], cancelValue?: T): Promise<T> {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'choice-wrap' });
    const done = (v: T, se: 'ok' | 'cancel' = 'ok') => {
      audio.se(se);
      wrap.remove();
      resolve(v);
    };
    wrap.append(
      h(
        'div',
        { class: 'choice-box' },
        question ? h('div', { class: 'choice-q' }, question) : null,
        options.map((o) =>
          h('button', { class: 'btn choice', disabled: o.disabled, onClick: () => done(o.value) }, h('span', null, o.label), o.sub ? h('small', null, o.sub) : null),
        ),
        cancelValue !== undefined ? h('button', { class: 'btn ghost choice', onClick: () => done(cancelValue, 'cancel') }, 'やめる') : null,
      ),
    );
    getLayer().append(wrap);
  });
}

export async function confirm(text: string, yes = 'はい', no = 'いいえ', danger = false): Promise<boolean> {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'modal-wrap' });
    const done = (v: boolean) => {
      audio.se(v ? 'ok' : 'cancel');
      wrap.remove();
      resolve(v);
    };
    wrap.append(
      h(
        'div',
        { class: 'modal', role: 'alertdialog' },
        h('p', { class: 'modal-text' }, text),
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn ghost', onClick: () => done(false) }, no), h('button', { class: `btn ${danger ? 'danger' : 'primary'}`, onClick: () => done(true) }, yes)),
      ),
    );
    getLayer().append(wrap);
  });
}

export function alertBox(text: string, ok = 'OK'): Promise<void> {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'modal-wrap' });
    wrap.append(
      h(
        'div',
        { class: 'modal' },
        h('p', { class: 'modal-text' }, text),
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn primary', onClick: () => { audio.se('ok'); wrap.remove(); resolve(); } }, ok)),
      ),
    );
    getLayer().append(wrap);
  });
}

/** 画面上部の小さなお知らせ（タップを妨げない） */
export function toast(text: string, ms = 2200): void {
  let area = document.querySelector<HTMLElement>('.toast-area');
  if (!area) {
    area = h('div', { class: 'toast-area' });
    uiRoot().append(area);
  }
  const t = h('div', { class: 'toast' }, text);
  area.append(t);
  window.setTimeout(() => t.classList.add('out'), ms);
  window.setTimeout(() => t.remove(), ms + 400);
}

/** 数を選ぶ（ショップなど） */
export function chooseNumber(title: string, min: number, max: number, unitPrice?: number): Promise<number | null> {
  return new Promise((resolve) => {
    let n = min;
    const val = h('div', { class: 'num-val' });
    const price = h('div', { class: 'num-price' });
    const update = () => {
      val.textContent = `× ${n}`;
      if (unitPrice !== undefined) price.textContent = `${(unitPrice * n).toLocaleString()} ルクス`;
    };
    const step = (d: number) => {
      n = Math.max(min, Math.min(max, n + d));
      audio.se('cursor');
      update();
    };
    const wrap = h('div', { class: 'modal-wrap' });
    const done = (v: number | null) => {
      audio.se(v === null ? 'cancel' : 'ok');
      wrap.remove();
      resolve(v);
    };
    wrap.append(
      h(
        'div',
        { class: 'modal' },
        h('p', { class: 'modal-text' }, title),
        h('div', { class: 'num-row' }, h('button', { class: 'btn round', onClick: () => step(-10) }, '−10'), h('button', { class: 'btn round', onClick: () => step(-1) }, '−'), val, h('button', { class: 'btn round', onClick: () => step(1) }, '＋'), h('button', { class: 'btn round', onClick: () => step(10) }, '＋10')),
        price,
        h('div', { class: 'modal-btns' }, h('button', { class: 'btn ghost', onClick: () => done(null) }, 'やめる'), h('button', { class: 'btn primary', onClick: () => done(n) }, 'けってい')),
      ),
    );
    update();
    getLayer().append(wrap);
  });
}

export function isDialogOpen(): boolean {
  return !!layer && layer.childElementCount > 0;
}
