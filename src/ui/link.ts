/**
 * 「つうしん」画面：QRコードで ともだちと遊ぶ（サーバーなし・アカウントなし・お金なし）。
 *
 * - ちょくせつ たいせん／こうかん：2台を WebRTC で直接つなぐ。つなぐための情報は QR で見せ合う
 * - QRチーム たいせん：チームを QR にして見せ、読んだ人は そのチーム（CPU が操作）と たたかう
 *
 * この画面（とQRの部品）は、メニューの「つうしん」を開いた時だけ読みこまれる。
 * 画面を開いただけでは通信しない。通信は「へやを つくる／はいる」を押した時だけ。
 */
import type Phaser from 'phaser';
import { monsterImageUrl } from '../art/monsterArt';
import { audio } from '../audio/audio';
import { session } from '../core/session';
import type { MonsterInstance } from '../core/types';
import { getMap } from '../data/maps';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import { displayName } from '../logic/monster';
import { randomU32 } from '../net/codec';
import { aiOpponent, createMatch } from '../net/match';
import { CameraScanner, decodeImageFile, renderQr } from '../net/qr';
import { createRoom, joinRoom, webrtcAvailable, type PeerLink } from '../net/rtc';
import { decodeSignal, isSignalCode, type LinkMode } from '../net/sdp';
import { decodeTeam, encodeTeam, isTeamCode } from '../net/team';
import { applyTrade, canOffer, fromWire, toWire } from '../net/trade';
import { exchangeTeams, handshake, netOpponent, sharedSeed, type Hello } from '../net/versus';
import { runVersusBattle } from './battleUI';
import { alertBox, confirm, say, toast } from './dialog';
import { clear, h, uiRoot } from './dom';
import { elementChip } from './growth';
import './link.css';

const CAMERA_FAIL =
  'カメラが つかえませんでした。\nLINE などの アプリの中で ひらいている ときは、右上の メニューから「Safari（または ブラウザ）で ひらく」を えらんでね。\n「しゃしんから よみとる」や「コードを はりつける」でも だいじょうぶ。';
const CONNECT_FAIL =
  'つながりませんでした。\n・ふたりとも おなじ Wi‑Fiに つながっているか たしかめてね\n・はなれた ばしょなら「インターネットごしに つなぐ」に チェックを いれて、さいしょから やりなおしてね（けいたいの かいせんどうしでは つながらない ことも あります）';

// ── 画面の土台 ──────────────────────────
interface Sub {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
  done: Promise<void>;
  readonly closed: boolean;
  onClose: (fn: () => void) => void;
}

function openSub(title: string): Sub {
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const body = h('div', { class: 'screen-body' });
  const fns: (() => void)[] = [];
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    audio.se('cancel');
    el.remove();
    fns.splice(0).forEach((f) => f());
    resolve();
  };
  const el = h('div', { class: 'screen' }, h('div', { class: 'screen-head' }, h('button', { class: 'btn small ghost', onClick: () => close() }, '← もどる'), h('h2', null, title)), body);
  uiRoot().append(el);
  return {
    el,
    body,
    close,
    done,
    get closed() {
      return closed;
    },
    onClose: (fn) => (closed ? fn() : fns.push(fn)),
  };
}

function card(...children: (HTMLElement | string | null)[]): HTMLElement {
  return h('div', { class: 'card' }, ...children);
}

function getGame(): Phaser.Game | null {
  return (window as unknown as { __game?: { app?: { game?: Phaser.Game } } }).__game?.app?.game ?? null;
}

function restoreBgm(): void {
  try {
    audio.playBgm(getMap(session.data.location.mapId).bgm);
  } catch {
    /* マップが無い時はそのまま */
  }
}

/** 戦闘の間は、うしろの画面（メニューなど）を外しておく（十字キーの操作が戦闘に向くように） */
async function withScreensHidden<T>(fn: () => Promise<T>): Promise<T> {
  const screens = [...uiRoot().querySelectorAll<HTMLElement>(':scope > .screen')];
  const marks = screens.map((s) => {
    const c = document.createComment('screen');
    s.replaceWith(c);
    return c;
  });
  try {
    return await fn();
  } finally {
    marks.forEach((c, i) => c.replaceWith(screens[i]));
  }
}

function timeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, reject) => window.setTimeout(() => reject(new Error('timeout')), ms))]);
}

const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ── QR の表示と読み取り ─────────────────────
function codeView(code: string, label = 'QRが よめない ときは（コードで つたえる）'): HTMLElement {
  const ta = h('textarea', { class: 'link-code', readonly: true, rows: 3 });
  ta.value = code;
  const copy = h(
    'button',
    {
      class: 'btn small',
      onClick: async () => {
        try {
          await navigator.clipboard.writeText(code);
          toast('コードを コピーしました');
        } catch {
          ta.select();
          toast('コードを えらんで コピーしてね');
        }
      },
    },
    '📋 コードを コピー',
  );
  return h('div', null, h('div', { class: 'link-qr' }, renderQr(code)), h('details', null, h('summary', { class: 'note' }, label), ta, h('div', { class: 'row', style: 'margin-top:6px' }, copy, h('span', { class: 'note' }, `${code.length}もじ`))));
}

/** QR を読む画面。カメラ・写真・はりつけ の どれかで読めた文字列を返す（やめたら null） */
function scanCode(title: string, hint: string): Promise<string | null> {
  return new Promise((resolve) => {
    const s = openSub(title);
    let scanner: CameraScanner | null = null;
    let finished = false;
    const finish = (v: string | null) => {
      if (finished) return;
      finished = true;
      scanner?.stop();
      if (!s.closed) s.close();
      if (v) audio.se('ok');
      resolve(v);
    };
    s.onClose(() => finish(null));
    const video = h('video', { class: 'link-video', playsinline: true, muted: true, autoplay: true, style: 'display:none' });
    const status = h('div', { class: 'link-status' });
    const fail = (text: string) => {
      status.className = 'link-status err';
      status.textContent = text;
    };
    const camBtn = h(
      'button',
      {
        class: 'btn primary',
        onClick: async () => {
          if (scanner) return;
          if (!CameraScanner.available()) return fail(CAMERA_FAIL);
          scanner = new CameraScanner(video, (t) => finish(t));
          video.style.display = '';
          status.className = 'link-status';
          status.textContent = 'QRコードを カメラに うつしてね';
          try {
            await scanner.start();
          } catch {
            scanner.stop();
            scanner = null;
            video.style.display = 'none';
            fail(CAMERA_FAIL);
          }
        },
      },
      '📷 カメラで よむ',
    );
    const file = h('input', { type: 'file', accept: 'image/*', class: 'link-file' });
    file.addEventListener('change', async () => {
      const f = file.files?.[0];
      file.value = '';
      if (!f) return;
      status.className = 'link-status';
      status.textContent = 'しゃしんを しらべています…';
      try {
        const text = await decodeImageFile(f);
        if (text) finish(text);
        else fail('しゃしんから QRコードが みつかりませんでした。QRが おおきく はっきり うつった しゃしんを えらんでね。');
      } catch (e) {
        fail(errText(e));
      }
    });
    const photoBtn = h('button', { class: 'btn', onClick: () => file.click() }, '🖼 しゃしんから よみとる');
    const paste = h('textarea', { class: 'link-code', rows: 3, placeholder: 'ここに コードを はりつける', 'aria-label': 'コードを はりつける' });
    const pasteBtn = h(
      'button',
      {
        class: 'btn',
        onClick: () => {
          const t = paste.value.trim();
          if (t) finish(t);
          else fail('コードが からっぽです');
        },
      },
      '📝 はりつけた コードを よみこむ',
    );
    s.body.append(
      card(h('p', { class: 'note' }, hint), h('div', { class: 'link-btns' }, camBtn, video, status, photoBtn, file)),
      card(h('div', { class: 'link-step' }, 'コードを はりつける'), h('p', { class: 'note' }, 'QRの したの「コードを コピー」で おくってもらった もじを はりつけても よみこめます。'), paste, h('div', { class: 'link-btns', style: 'margin-top:6px' }, pasteBtn)),
    );
  });
}

// ── 入口 ───────────────────────────────
export async function openLink(): Promise<void> {
  const s = openSub('つうしん');
  const internet = h('input', { type: 'checkbox', 'aria-label': 'インターネットごしに つなぐ' });
  const direct = (mode: LinkMode) => async () => {
    audio.se('ok');
    if (!webrtcAvailable()) return alertBox('この ブラウザでは ちょくせつ つなぐことが できません。Safari か Chrome で ひらいてね。');
    await hostFlow(mode, internet.checked);
  };
  s.body.append(
    card(
      h('h3', null, '⚔ ちょくせつ たいせん・🔁 こうかん'),
      h('p', { class: 'note' }, 'ちかくの ともだちと 2台を つなぎます。ひとりが へやを つくって QRを みせ、もうひとりが よみとります。そのあと もういちど、こんどは ぎゃくに QRを よみとると つながります。'),
      h('label', { class: 'link-check' }, internet, h('span', null, 'インターネットごしに つなぐ（Googleの 公開サーバーを つかう）', h('br'), h('small', { class: 'note' }, 'はなれた ばしょの ときだけ チェック。けいたいの かいせんでは つながらない ことも あります。チェックしなければ おなじ Wi‑Fiの 中だけで つながり、外には なにも おくりません。'))),
      h('div', { class: 'link-btns' }, h('button', { class: 'btn primary', onClick: direct('battle') }, '⚔ たいせんの へやを つくる'), h('button', { class: 'btn blue', onClick: direct('trade') }, '🔁 こうかんの へやを つくる'), h('button', { class: 'btn', onClick: () => readFriendQr(internet.checked) }, '📷 ともだちの QRを よむ')),
    ),
    card(
      h('h3', null, '🪪 QRチーム たいせん'),
      h('p', { class: 'note' }, 'じぶんの チームを QRに して みせます。よみとった ともだちは、あなたの チーム（CPUが うごかします）と たたかえます。つながらなくても あそべます。'),
      h('div', { class: 'link-btns' }, h('button', { class: 'btn', onClick: () => showMyTeam() }, '🪪 じぶんの チームQRを みせる'), h('button', { class: 'btn', onClick: () => readFriendQr(internet.checked) }, '📷 チームQRを よんで たたかう')),
    ),
    h('p', { class: 'note', style: 'color:#ccc' }, 'この画面を ひらいただけでは どこにも つながりません。たいせん・QRチーム たいせんでは けいけんちや おかねは ふえず、なかまの HPも もとどおりです。'),
  );
  await s.done;
}

async function readFriendQr(internet: boolean): Promise<void> {
  audio.se('ok');
  const text = await scanCode('ともだちの QRを よむ', 'ともだちの「へやの QR」か「チームQR」を よみとってね。');
  if (!text) return;
  if (isTeamCode(text)) return ghostBattle(text);
  const kind = isSignalCode(text);
  if (kind === 'offer') {
    if (!webrtcAvailable()) return alertBox('この ブラウザでは ちょくせつ つなぐことが できません。Safari か Chrome で ひらいてね。');
    return guestFlow(text, internet);
  }
  if (kind === 'answer') return alertBox('これは「へんじの QR」です。へやを つくった がわの がめんで よみとってね。');
  return alertBox('この ゲームの QRコードでは ありません。');
}

// ── へやを つくる（ホスト） ────────────────────
async function hostFlow(mode: LinkMode, internet: boolean): Promise<void> {
  const s = openSub(mode === 'battle' ? 'たいせんの へや' : 'こうかんの へや');
  const status = h('div', { class: 'link-status' }, 'じゅんびしています…');
  s.body.append(status);
  let room: Awaited<ReturnType<typeof createRoom>>;
  try {
    room = await createRoom(mode, internet);
  } catch (e) {
    status.className = 'link-status err';
    status.textContent = `へやを つくれませんでした（${errText(e)}）`;
    return s.done;
  }
  if (s.closed) {
    room.link.close('やめました');
    return;
  }
  s.onClose(() => room.link.close('やめました', true));
  status.textContent = '';
  const readBtn = h('button', { class: 'btn primary', style: 'width:100%' }, '📷 ともだちの「へんじの QR」を よむ');
  readBtn.addEventListener('click', async () => {
    audio.se('ok');
    const text = await scanCode('へんじの QRを よむ', 'ともだちの がめんに でている「へんじの QR」を よみとってね。');
    if (!text || s.closed) return;
    try {
      await room.accept(text);
    } catch (e) {
      return alertBox(errText(e).includes('InvalidState') ? 'もう いちど へやを つくりなおしてね。' : errText(e));
    }
    readBtn.disabled = true;
    status.className = 'link-status';
    status.textContent = 'つないでいます…';
    try {
      await timeout(room.link.opened, 20000);
    } catch {
      if (s.closed) return;
      await alertBox(CONNECT_FAIL);
      s.close();
      return;
    }
    if (!s.closed) await startSession(s, room.link);
  });
  s.body.append(
    card(h('div', { class: 'link-step' }, '① この QRを ともだちに よんでもらってね'), h('p', { class: 'note' }, 'ともだちは メニュー →「つうしん」→「ともだちの QRを よむ」で よみとります。'), codeView(room.code)),
    card(h('div', { class: 'link-step' }, '② ともだちの がめんに でた QRを よむ'), readBtn),
    status,
  );
  await s.done;
}

// ── へやに はいる（ゲスト） ────────────────────
async function guestFlow(offerCode: string, internet: boolean): Promise<void> {
  let mode: LinkMode;
  try {
    mode = decodeSignal(offerCode).mode ?? 'battle';
  } catch (e) {
    return alertBox(errText(e));
  }
  const s = openSub(mode === 'battle' ? 'たいせんの へやに はいる' : 'こうかんの へやに はいる');
  const status = h('div', { class: 'link-status' }, 'じゅんびしています…');
  s.body.append(status);
  let joined: Awaited<ReturnType<typeof joinRoom>>;
  try {
    joined = await joinRoom(offerCode, internet);
  } catch (e) {
    status.className = 'link-status err';
    status.textContent = `へやに はいれませんでした（${errText(e)}）`;
    return s.done;
  }
  if (s.closed) {
    joined.link.close('やめました');
    return;
  }
  s.onClose(() => joined.link.close('やめました', true));
  status.textContent = 'ともだちが よみとって つながるのを まっています…';
  s.body.prepend(card(h('div', { class: 'link-step' }, 'この「へんじの QR」を、へやを つくった ともだちに よんでもらってね'), codeView(joined.code)));
  try {
    await timeout(joined.link.opened, 180000);
  } catch {
    if (s.closed) return;
    await alertBox(CONNECT_FAIL);
    s.close();
    return;
  }
  if (!s.closed) await startSession(s, joined.link);
  await s.done;
}

// ── つながった後 ──────────────────────────
async function startSession(s: Sub, link: PeerLink): Promise<void> {
  clear(s.body);
  const status = h('div', { class: 'link-status' }, 'つながりました！');
  s.body.append(status);
  audio.se('ok');
  let hello: { me: Hello; them: Hello };
  try {
    hello = await handshake(link, link.mode, session.data.playerName);
  } catch (e) {
    link.close('おわり', true);
    if (!s.closed) {
      await alertBox(errText(e));
      s.close();
    }
    return;
  }
  link.onClose((reason) => {
    if (!s.closed) status.textContent = reason;
  });
  if (link.mode === 'battle') await pvpSession(s, link, hello);
  else await tradeSession(s, link, hello);
}

async function pvpSession(s: Sub, link: PeerLink, hello: { me: Hello; them: Hello }): Promise<void> {
  const save = session.data;
  const end = async (text: string) => {
    link.close('おわり', true);
    if (!s.closed) {
      await alertBox(text);
      s.close();
    }
  };
  const mine = encodeTeam(save.playerName, save.party);
  if (!mine.ok) return end(`じぶんの チームに たいせんに だせない 灯獣が います（${mine.reason}）`);
  s.body.append(h('p', { class: 'note', style: 'text-align:center' }, `${hello.them.name}と チームを みせあっています…`));
  let theirCode: string;
  try {
    theirCode = await exchangeTeams(link, mine.code);
  } catch (e) {
    return end(errText(e));
  }
  const isHost = link.role === 'host';
  const host = decodeTeam(isHost ? mine.code : theirCode, 'a');
  const guest = decodeTeam(isHost ? theirCode : mine.code, 'b');
  if (!host.ok || !guest.ok) return end(`あいての チームに たいせんに だせない 灯獣が います（${!host.ok ? host.reason : !guest.ok ? guest.reason : ''}）`);
  const game = getGame();
  if (!game) return end('たいせんの じゅんびが できませんでした');
  const seed = isHost ? sharedSeed(hello.me.nonce, hello.them.nonce) : sharedSeed(hello.them.nonce, hello.me.nonce);
  const match = createMatch(host.team, guest.team, isHost ? 0 : 1, seed);
  const opponent = netOpponent(link, match, hello.them.name);
  try {
    await withScreensHidden(() => runVersusBattle(game, { driver: match, opponent, backdrop: 'field', intro: `${hello.them.name}が 勝負を しかけてきた！` }));
  } finally {
    link.close('たいせんが おわりました', true);
    restoreBgm();
  }
  if (!s.closed) s.close();
}

// ── こうかん ─────────────────────────────
function monSummary(mon: MonsterInstance, sub?: string): HTMLElement {
  return h(
    'div',
    { class: 'row' },
    h('img', { src: monsterImageUrl(getSpecies(mon.speciesId).art), alt: '', style: 'width:64px;height:64px' }),
    h(
      'div',
      { class: 'grow' },
      h('div', { class: 'nm' }, h('b', null, displayName(mon)), ' ', h('span', { class: 'muted' }, `Lv${mon.level}`)),
      h('div', null, getSpecies(mon.speciesId).elements.map((e) => elementChip(e))),
      h('div', { class: 'link-moves' }, mon.moves.map((m) => h('span', null, getMove(m.id).name))),
      sub ? h('div', { class: 'note' }, sub) : null,
    ),
  );
}

function pickMonster(): Promise<MonsterInstance | null> {
  return new Promise((resolve) => {
    const save = session.data;
    const s = openSub('こうかんに だす 灯獣');
    let picked: MonsterInstance | null = null;
    s.onClose(() => resolve(picked));
    const item = (mon: MonsterInstance, where: string) => {
      const can = canOffer(save, mon.uid);
      return h(
        'button',
        {
          class: 'btn mon-card',
          disabled: !can.ok,
          onClick: () => {
            audio.se('ok');
            picked = mon;
            s.close();
          },
        },
        h('img', { src: monsterImageUrl(getSpecies(mon.speciesId).art), alt: '' }),
        h('div', { class: 'grow' }, h('div', { class: 'nm' }, displayName(mon)), h('div', { class: 'lv' }, `Lv${mon.level}　${where}`), can.ok ? null : h('div', { class: 'muted' }, can.reason ?? '')),
      );
    };
    s.body.append(
      h('div', { class: 'link-step' }, 'パーティー'),
      ...save.party.map((m) => item(m, 'パーティー')),
      save.box.length ? h('div', { class: 'link-step', style: 'margin-top:10px' }, 'ボックス') : '',
      ...save.box.map((m) => item(m, 'ボックス')),
    );
  });
}

async function tradeSession(s: Sub, link: PeerLink, hello: { me: Hello; them: Hello }): Promise<void> {
  const save = session.data;
  const partner = hello.them.name;
  let myOffer: { id: number; mon: MonsterInstance } | null = null;
  let theirOffer: { id: number; mon: MonsterInstance } | null = null;
  let myOk = false;
  let theirOk: { mine: number; theirs: number } | null = null;
  let busy = false;
  let notice = '';

  const myBox = h('div', { class: 'link-offer' });
  const theirBox = h('div', { class: 'link-offer' });
  const pickBtn = h('button', { class: 'btn', style: 'width:100%;margin-top:6px' }, '🐾 だす 灯獣を えらぶ');
  const okBtn = h('button', { class: 'btn primary', style: 'width:100%' }, '🤝 この ないようで こうかんする');
  const status = h('div', { class: 'link-status' });
  clear(s.body);
  s.body.append(
    h('p', { class: 'note' }, `${partner}と つながっています。おたがいに 灯獣を えらんで、ふたりとも「こうかんする」を おすと こうかんします。どちらかが えらびなおすと、OKは とりけしに なります。`),
    card(h('div', { class: 'link-step' }, 'あなたが だす 灯獣'), myBox, pickBtn),
    card(h('div', { class: 'link-step' }, `${partner}が だす 灯獣`), theirBox),
    okBtn,
    status,
  );

  const render = () => {
    myBox.replaceChildren(myOffer ? monSummary(myOffer.mon) : h('div', { class: 'muted' }, 'まだ えらんでいません'));
    theirBox.replaceChildren(theirOffer ? monSummary(theirOffer.mon, theirOffer.mon.originalTrainer ? `もとの おや：${theirOffer.mon.originalTrainer}` : undefined) : h('div', { class: 'muted' }, `${partner}が えらんでいます…`));
    okBtn.disabled = !myOffer || !theirOffer || myOk || busy || !!link.closed;
    pickBtn.disabled = busy || !!link.closed;
    const okText = myOk && theirOk ? '' : myOk ? `${partner}の OKを まっています…` : theirOk ? `${partner}は OK！ あとは あなたが おすだけ` : '';
    status.textContent = link.closed ? link.closed : notice || okText;
  };

  const resetOk = () => {
    myOk = false;
    theirOk = null;
  };

  const tryCommit = async () => {
    if (!myOk || !theirOk || !myOffer || !theirOffer) return;
    if (theirOk.mine !== theirOffer.id || theirOk.theirs !== myOffer.id) return;
    busy = true;
    const giving = myOffer.mon;
    const r = applyTrade(save, giving.uid, theirOffer.mon, partner);
    myOffer = null;
    theirOffer = null;
    resetOk();
    if (!r.ok) {
      busy = false;
      notice = `こうかん できませんでした（${r.reason}）`;
      render();
      return;
    }
    session.checkQuests();
    const saved = await session.saveNow();
    link.send({ t: 'done' });
    audio.se('levelup');
    notice = '';
    render();
    await say(`${displayName(r.given)}を ${partner}に おくった。\n${partner}から ${displayName(r.received)}を うけとった！`);
    if (!saved.ok) toast(`⚠ セーブできませんでした（${saved.message}）`, 4000);
    busy = false;
    render();
  };

  link.on('offer', (m) => {
    const id = typeof m.id === 'number' ? m.id : -1;
    resetOk();
    if (m.mon === null) {
      theirOffer = null;
      return render();
    }
    const r = fromWire(m.mon);
    if (!r.ok) {
      theirOffer = null;
      notice = `${partner}の 灯獣は うけとれません（${r.reason}）`;
      link.send({ t: 'nope', reason: r.reason });
    } else {
      theirOffer = { id, mon: r.mon };
      notice = '';
    }
    render();
  });
  link.on('nope', (m) => {
    notice = `あなたの 灯獣は こうかんに だせません（${typeof m.reason === 'string' ? m.reason.slice(0, 40) : ''}）`;
    myOffer = null;
    resetOk();
    render();
  });
  link.on('ok', (m) => {
    if (typeof m.mine !== 'number' || typeof m.theirs !== 'number') return;
    theirOk = { mine: m.mine, theirs: m.theirs };
    render();
    void tryCommit();
  });
  link.on('done', () => {});
  link.onClose(() => render());

  pickBtn.addEventListener('click', async () => {
    audio.se('ok');
    const mon = await pickMonster();
    if (!mon || link.closed) return;
    myOffer = { id: randomU32(), mon };
    resetOk();
    notice = '';
    link.send({ t: 'offer', id: myOffer.id, mon: toWire(mon) });
    render();
  });
  okBtn.addEventListener('click', async () => {
    if (!myOffer || !theirOffer) return;
    if (!(await confirm(`${displayName(myOffer.mon)}を おくって、${displayName(theirOffer.mon)}を うけとります。いいですか？`, 'こうかんする', 'やめる'))) return;
    if (!myOffer || !theirOffer) return;
    myOk = true;
    link.send({ t: 'ok', mine: myOffer.id, theirs: theirOffer.id });
    render();
    void tryCommit();
  });
  render();
  await s.done;
}

// ── QRチーム たいせん ───────────────────────
async function showMyTeam(): Promise<void> {
  audio.se('ok');
  const save = session.data;
  const enc = encodeTeam(save.playerName, save.party);
  if (!enc.ok) return alertBox(`QRに できない 灯獣が います（${enc.reason}）`);
  const s = openSub('じぶんの チームQR');
  s.body.append(
    card(h('p', { class: 'note' }, 'ともだちに この QRを よんでもらうと、あなたの チームと たたかえます（あいての がめんでは CPUが うごかします）。'), codeView(enc.code, 'コードで おくる（LINEなどに はりつけ）')),
    card(h('div', { class: 'link-step' }, `${save.playerName}の チーム`), ...save.party.map((m) => monSummary(m))),
  );
  await s.done;
}

async function ghostBattle(code: string): Promise<void> {
  const save = session.data;
  const theirs = decodeTeam(code, 'g');
  if (!theirs.ok) return alertBox(`この チームQRでは たたかえません（${theirs.reason}）`);
  const enc = encodeTeam(save.playerName, save.party);
  if (!enc.ok) return alertBox(`じぶんの チームに たいせんに だせない 灯獣が います（${enc.reason}）`);
  const mine = decodeTeam(enc.code, 'm');
  if (!mine.ok) return alertBox(mine.reason);
  const t = theirs.team;
  const list = t.party.map((m) => `${displayName(m)} Lv${m.level}`).join('、');
  if (!(await confirm(`${t.name}の チーム（${list}）と たたかいますか？`, 'たたかう', 'やめる'))) return;
  const game = getGame();
  if (!game) return alertBox('たいせんの じゅんびが できませんでした');
  const match = createMatch(mine.team, t, 0, randomU32());
  try {
    await withScreensHidden(() => runVersusBattle(game, { driver: match, opponent: aiOpponent(t.name, 0.8), backdrop: 'field', intro: `${t.name}の チーム（QR）が 勝負を しかけてきた！` }));
  } finally {
    restoreBgm();
  }
}
