/**
 * 画面の下の操作ボタン（十字キー・A・B・START・SELECT）。
 * プレイ画面とは分けて置き、DOM のボタンなので LINE などのアプリ内ブラウザでも確実に反応する。
 *
 * - フィールド：十字キーで歩く／A で話す・調べる／START でメニュー
 * - 会話：A か B で次へ
 * - メニューや戦闘のコマンド：十字キーで選ぶ（黄色の枠）→ A で決定／B でもどる
 * 画面のボタンを直接タップしても、これまでどおり操作できる。
 */
import { audio } from '../audio/audio';
import type { Facing } from '../core/types';
import { h, uiRoot } from './dom';

export interface DeckHost {
  /** フィールドを歩ける状態か（会話・メニュー・戦闘中でない） */
  fieldActive(): boolean;
  setWalk(dir: Facing | null): void;
  /** 一瞬だけ押された方向（離すのが速くても1歩進む） */
  tapWalk(dir: Facing): void;
  action(): void;
  start(): void;
  select(): void;
}

const BACK_WORDS = /^(やめる|もどる|とじる|閉じる|キャンセル|いいえ|← ?もどる|✕|×)/;

let focused: HTMLElement | null = null;
/** 十字キーでボタンを選んでいる途中か（画面をタップすると解除） */
let padMode = false;

/** 最初に選ぶボタン：戦闘ならコマンド、それ以外は先頭（速さ切り替えは後回し） */
function firstPreferred(list: HTMLElement[]): HTMLElement | undefined {
  return list.find((b) => b.closest('.bbottom')) ?? list.find((b) => !b.classList.contains('skip-btn'));
}

/** いちばん手前に出ている操作の場所（会話の選択肢 → メニュー画面 → 戦闘 → タイトルなど） */
function topLayer(): HTMLElement | null {
  const root = uiRoot();
  const dl = root.querySelector<HTMLElement>('.dialog-layer');
  const lastDialog = dl?.lastElementChild as HTMLElement | null;
  if (lastDialog && !lastDialog.classList.contains('msg-box')) return lastDialog;
  const screens = root.querySelectorAll<HTMLElement>('.screen');
  if (screens.length) return screens[screens.length - 1];
  const battle = root.querySelector<HTMLElement>('.battle-ui');
  if (battle) return battle;
  return root;
}

function visible(el: HTMLElement): boolean {
  if ((el as HTMLButtonElement).disabled) return false;
  if (el.closest('.hud')) return false;
  const r = el.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const cs = getComputedStyle(el);
  return cs.visibility !== 'hidden' && cs.display !== 'none';
}

function candidates(layer: HTMLElement): HTMLElement[] {
  return [...layer.querySelectorAll<HTMLElement>('button, input, select, [role="button"]')].filter(visible);
}

function setFocus(el: HTMLElement | null): void {
  focused?.classList.remove('pad-focus');
  focused = el;
  if (el) {
    el.classList.add('pad-focus');
    el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }
}

/** 十字キーの方向にある、いちばん近いボタンへ移る */
function moveFocus(dir: Facing): void {
  const layer = topLayer();
  if (!layer) return;
  const list = candidates(layer);
  if (!list.length) return;
  padMode = true;
  if (!focused || !list.includes(focused)) {
    setFocus(firstPreferred(list) ?? null);
    audio.se('cursor');
    return;
  }
  const a = focused.getBoundingClientRect();
  const ax = a.left + a.width / 2;
  const ay = a.top + a.height / 2;
  let best: HTMLElement | null = null;
  let bestScore = Infinity;
  for (const el of list) {
    if (el === focused) continue;
    const b = el.getBoundingClientRect();
    const dx = b.left + b.width / 2 - ax;
    const dy = b.top + b.height / 2 - ay;
    const main = dir === 'up' ? -dy : dir === 'down' ? dy : dir === 'left' ? -dx : dx;
    const side = dir === 'up' || dir === 'down' ? Math.abs(dx) : Math.abs(dy);
    if (main <= 4) continue;
    const score = main + side * 2.2;
    if (score < bestScore) {
      bestScore = score;
      best = el;
    }
  }
  // 端まで来たら、並び順で次（前）へ
  if (!best) {
    const i = list.indexOf(focused);
    best = dir === 'down' || dir === 'right' ? list[(i + 1) % list.length] : list[(i - 1 + list.length) % list.length];
  }
  setFocus(best);
  audio.se('cursor');
}

/** 会話ウィンドウが出ていれば次へ進める */
function advanceMessage(): boolean {
  const root = uiRoot();
  const box = root.querySelector<HTMLElement>('.dialog-layer > .msg-box');
  if (box) {
    box.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return true;
  }
  const bmsg = root.querySelector<HTMLElement>('.battle-ui .bmsg');
  const layer = topLayer();
  if (bmsg && layer?.classList.contains('battle-ui') && !candidates(layer).some((b) => b.closest('.bbottom'))) {
    bmsg.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return true;
  }
  return false;
}

function pressA(host: DeckHost): void {
  if (advanceMessage()) return;
  if (host.fieldActive()) return host.action();
  const layer = topLayer();
  if (!layer) return;
  const list = candidates(layer);
  const title = uiRoot().querySelector<HTMLElement>('.title-screen');
  if (title && title.querySelector('.tap-start')) {
    title.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    return;
  }
  if (focused && list.includes(focused)) {
    focused.click();
    if (focused instanceof HTMLInputElement) focused.focus();
    return;
  }
  // まだ何も選んでいなければ、まず最初のボタンを選ぶ
  padMode = true;
  const first = firstPreferred(list);
  if (first) {
    setFocus(first);
    audio.se('cursor');
  }
}

function pressB(host: DeckHost): void {
  if (advanceMessage()) return;
  if (host.fieldActive()) return;
  const layer = topLayer();
  if (!layer) return;
  const list = candidates(layer);
  const back = [...list].reverse().find((b) => BACK_WORDS.test((b.textContent ?? '').trim()) || b.classList.contains('back') || b.classList.contains('close'));
  if (back) back.click();
}

export function mountDeck(host: DeckHost): void {
  const deck = document.getElementById('deck');
  if (!deck || deck.childElementCount) return;
  let heldDir: Facing | null = null;
  let repeat: number | null = null;
  const stopRepeat = () => {
    if (repeat) window.clearTimeout(repeat);
    repeat = null;
  };
  const dirDown = (dir: Facing) => {
    heldDir = dir;
    stopRepeat();
    if (host.fieldActive()) {
      host.tapWalk(dir);
      host.setWalk(dir);
      return;
    }
    host.setWalk(null);
    moveFocus(dir);
    // 押しっぱなしで続けて動く
    const loop = (delay: number) => {
      repeat = window.setTimeout(() => {
        if (heldDir !== dir) return;
        if (host.fieldActive()) host.setWalk(dir);
        else moveFocus(dir);
        loop(140);
      }, delay);
    };
    loop(380);
  };
  const dirUp = () => {
    heldDir = null;
    stopRepeat();
    host.setWalk(null);
  };

  /** 押した瞬間に反応するボタン（指を離すまで pressed 表示） */
  const pressable = (el: HTMLElement, onDown: () => void, onUp?: () => void) => {
    el.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      audio.unlock();
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        /* 古いブラウザ */
      }
      el.classList.add('pressed');
      onDown();
    });
    const up = () => {
      if (!el.classList.contains('pressed')) return;
      el.classList.remove('pressed');
      onUp?.();
    };
    for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(ev, up);
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    return el;
  };

  const dirs: [Facing, string, string][] = [
    ['up', '▲', '上'],
    ['left', '◀', '左'],
    ['right', '▶', '右'],
    ['down', '▼', '下'],
  ];
  const dpad = h(
    'div',
    { class: 'gb-dpad' },
    ...dirs.map(([d, label, aria]) => pressable(h('button', { class: `gb-dir gb-${d}`, 'aria-label': aria }, label), () => dirDown(d), dirUp)),
    h('div', { class: 'gb-center' }),
  );
  const btnA = pressable(h('button', { class: 'gb-btn gb-a', 'aria-label': 'Aボタン' }, 'A', h('span', { class: 'lbl' }, 'けってい')), () => {
    dirUp();
    pressA(host);
  });
  const btnB = pressable(h('button', { class: 'gb-btn gb-b', 'aria-label': 'Bボタン' }, 'B', h('span', { class: 'lbl' }, 'もどる')), () => {
    dirUp();
    pressB(host);
  });
  const pill = (label: string, fn: () => void) =>
    h('div', { class: 'gb-pill-wrap' }, pressable(h('button', { class: 'gb-pill', 'aria-label': label }), fn), h('span', null, label));
  deck.append(
    h('div', { class: 'brand' }, 'LUMINARIA'),
    dpad,
    h('div', { class: 'gb-ab' }, btnB, btnA),
    h(
      'div',
      { class: 'gb-sys' },
      pill('SELECT', () => host.select()),
      pill('START', () => {
        dirUp();
        if (host.fieldActive()) host.start();
        else if (uiRoot().querySelector('.title-screen .tap-start')) pressA(host);
        else pressB(host);
      }),
    ),
  );
  window.addEventListener('blur', dirUp);
  // 画面を直接タップしたら、十字キーの選択枠は消す
  uiRoot().addEventListener(
    'pointerdown',
    () => {
      padMode = false;
      setFocus(null);
    },
    { capture: true },
  );
  // 十字キーで操作中に画面が切り替わったら（技の一覧が出た等）、新しい画面の最初のボタンを選び直す
  let pending = 0;
  new MutationObserver(() => {
    if (!padMode || pending) return;
    pending = window.setTimeout(() => {
      pending = 0;
      if (!padMode || host.fieldActive()) return;
      const layer = topLayer();
      const list = layer ? candidates(layer) : [];
      if (focused && list.includes(focused)) return;
      setFocus(firstPreferred(list) ?? null);
    }, 60);
  }).observe(uiRoot(), { childList: true, subtree: true });
}
