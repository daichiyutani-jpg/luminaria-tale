/**
 * メニュー画面いろいろ（なかま・ボックス・どうぐ・図鑑・相性表・クエスト・ショップ・セーブ・設定・通信）。
 * どの画面も open〜close を Promise で待てる。
 */
import { monsterImageUrl, silhouetteUrl } from '../art/monsterArt';
import { audio } from '../audio/audio';
import { BGM_PLAN } from '../audio/music';
import { session } from '../core/session';
import type { MonsterInstance, StatKey } from '../core/types';
import { checkCondition } from '../data/conditions';
import { effectiveness, ELEMENT_ORDER, ELEMENTS } from '../data/elements';
import { getItem, ITEM_ORDER } from '../data/items';
import { getMap } from '../data/maps';
import { getMove } from '../data/moves';
import { QUEST_ORDER, QUESTS } from '../data/quests';
import { SHOPS } from '../data/shops';
import { getSpecies, SPECIES_LIST } from '../data/species';
import { itemUsableOn, STATUS_NAME } from '../logic/battle';
import { expForLevel } from '../logic/exp';
import { buy, PARTY_MAX, dexCounts, itemCount, moveToBox, moveToParty, removeItem, reorderParty, sell, swapPartyBox } from '../logic/game';
import { availableEvolutions, displayName } from '../logic/monster';
import { maxHp, statsOf } from '../logic/stats';
import { exportSave, parseImport, requestPersistence, saveGame } from '../save/saveManager';
import { SaveError } from '../save/validate';
import { offlineStatus } from '../pwa';
import { alertBox, choose, chooseNumber, confirm, toast } from './dialog';
import { clear, formatTime, h, uiRoot } from './dom';
import { elementChip, offerEvolution } from './growth';

const STAT_JP: Record<StatKey, string> = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ' };

interface Screen {
  el: HTMLElement;
  body: HTMLElement;
  close: () => void;
  done: Promise<void>;
}

function openScreen(title: string, opts: { money?: boolean } = {}): Screen {
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const body = h('div', { class: 'screen-body' });
  const el = h(
    'div',
    { class: 'screen' },
    h('div', { class: 'screen-head' }, h('button', { class: 'btn small ghost', onClick: () => close() }, '← もどる'), h('h2', null, title), opts.money ? h('span', { class: 'money' }, `${session.data.money.toLocaleString()} ルクス`) : null),
    body,
  );
  const close = () => {
    audio.se('cancel');
    el.remove();
    resolve();
  };
  uiRoot().append(el);
  return { el, body, close, done };
}

function hpBar(mon: MonsterInstance) {
  const ratio = mon.hp / maxHp(mon);
  return h('div', { class: `hpbar ${ratio > 0.5 ? '' : ratio > 0.2 ? 'mid' : 'low'}` }, h('i', { style: `width:${ratio * 100}%` }));
}

function monCard(mon: MonsterInstance, onClick?: () => void, extra?: HTMLElement | null) {
  return h(
    'button',
    { class: `btn mon-card ${mon.hp <= 0 ? 'fainted' : ''}`, onClick },
    h('img', { src: monsterImageUrl(getSpecies(mon.speciesId).art), alt: '' }),
    h(
      'div',
      { class: 'grow' },
      h('div', { class: 'nm' }, displayName(mon), mon.status ? h('span', { class: `st ${mon.status}` }, STATUS_NAME[mon.status]) : null, mon.hp <= 0 ? h('span', { class: 'st sleep' }, 'ひんし') : null),
      h('div', { class: 'lv' }, `Lv${mon.level}　HP ${mon.hp}/${maxHp(mon)}`, ' ', getSpecies(mon.speciesId).elements.map((e) => elementChip(e))),
      hpBar(mon),
      extra ?? null,
    ),
  );
}

// ── メインメニュー ───────────────────────
export interface MenuActions {
  onSave: () => Promise<void>;
  onTitle: () => Promise<void>;
}

export async function openMainMenu(actions: MenuActions): Promise<void> {
  const save = session.data;
  const s = openScreen('メニュー', { money: true });
  const dex = dexCounts(save);
  const tile = (ico: string, label: string, sub: string, fn: () => Promise<void>) =>
    h('button', { class: 'btn menu-tile', onClick: async () => { audio.se('ok'); s.el.style.display = 'none'; await fn(); s.el.style.display = ''; render(); } }, h('span', { class: 'ico' }, ico), label, h('small', null, sub));
  const render = () => {
    clear(s.body);
    s.body.append(
      h('div', { class: 'card' }, h('div', { class: 'row' }, h('b', { class: 'grow' }, `${save.playerName}`), h('span', { class: 'muted' }, `プレイ ${formatTime(save.playTimeSec)}`)), h('div', { class: 'muted' }, `${getMap(save.location.mapId).name}　図鑑 ${dex.caught}/${dex.total}`)),
      h(
        'div',
        { class: 'menu-grid' },
        tile('🐾', 'なかま', `${save.party.length}/${PARTY_MAX}体`, () => openParty()),
        tile('🎒', 'どうぐ', 'アイテム', () => openBag()),
        tile('📖', 'ずかん', `${dex.seen}種 発見`, () => openDex()),
        tile('📜', 'クエスト', '依頼と目標', () => openQuests()),
        tile('💾', 'レポート', 'セーブ・書き出し', async () => actions.onSave()),
        tile('⚙', 'せってい', '音・速さ・データ', () => openSettings()),
        tile('📡', 'つうしん', '対戦・交換', () => openOnline()),
        tile('🏠', 'タイトルへ', 'セーブして戻る', async () => actions.onTitle()),
      ),
    );
  };
  render();
  await s.done;
}

// ── なかま ─────────────────────────────
export async function openParty(): Promise<void> {
  const save = session.data;
  const s = openScreen('なかま');
  const render = () => {
    clear(s.body);
    s.body.append(
      ...save.party.map((m, i) => monCard(m, async () => { audio.se('ok'); await openMonster(m, { partyIndex: i }); render(); })),
      h('div', { class: 'row', style: 'margin-top:6px' }, h('button', { class: 'btn blue grow', onClick: async () => { audio.se('ok'); await openBox(); render(); } }, `📦 ボックス（${save.box.length}体）`)),
      h('p', { class: 'note' }, 'つれて歩けるのは6体まで。7体目からは ボックスに 入ります。いちばん上の なかまが 最初に戦います。'),
    );
  };
  render();
  await s.done;
}

export async function openMonster(mon: MonsterInstance, ctx: { partyIndex?: number; boxIndex?: number } = {}): Promise<void> {
  const save = session.data;
  const s = openScreen(displayName(mon));
  const render = () => {
    clear(s.body);
    const sp = getSpecies(mon.speciesId);
    const st = statsOf(mon);
    const a = expForLevel(mon.level);
    const b = expForLevel(mon.level + 1);
    const evo = availableEvolutions(mon, { mapId: save.location.mapId, completedQuests: Object.keys(save.quests).filter((q) => save.quests[q].state === 'claimed') });
    s.body.append(
      h(
        'div',
        { class: 'card', style: 'text-align:center' },
        h('img', { src: monsterImageUrl(sp.art), alt: '', style: 'width:160px;height:160px' }),
        h('div', { style: 'font-size:20px;font-weight:800' }, displayName(mon), ' ', h('span', { class: 'muted' }, `Lv${mon.level}`)),
        h('div', null, sp.elements.map((e) => elementChip(e)), mon.status ? h('span', { class: `st ${mon.status}` }, STATUS_NAME[mon.status]) : null),
        h('div', { class: 'muted', style: 'margin-top:4px' }, `HP ${mon.hp}/${maxHp(mon)}　つぎのLvまで ${Math.max(0, b - mon.exp)}`),
        h('div', { class: 'expbar' }, h('i', { style: `width:${b > a ? ((mon.exp - a) / (b - a)) * 100 : 100}%` })),
        evo.length ? h('button', { class: 'btn primary', style: 'margin-top:10px;width:100%', onClick: async () => { if (await offerEvolution(mon, evo)) render(); } }, '✨ 進化できる！') : null,
      ),
      h('div', { class: 'card' }, h('h3', null, 'のうりょく'), (Object.keys(STAT_JP) as StatKey[]).map((k) => h('div', { class: 'stat-row' }, h('span', { class: 'k' }, STAT_JP[k]), h('span', { class: 'v' }, st[k]), h('span', { class: 'bar' }, h('i', { style: `width:${Math.min(100, (st[k] / (k === 'hp' ? 200 : 150)) * 100)}%` }))))),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'わざ'),
        mon.moves.map((m) => {
          const d = getMove(m.id);
          return h('div', { class: 'move-row' }, h('div', { class: 'row' }, h('span', { class: 'mn grow' }, d.name), elementChip(d.element), h('span', { class: 'muted' }, `PP ${m.pp}/${d.pp}`)), h('div', { class: 'md' }, `${d.category === 'status' ? '補助' : d.category === 'physical' ? '物理' : '特殊'}・威力 ${d.power || '—'}・命中 ${d.accuracy > 100 ? '必中' : d.accuracy}　${d.description}`));
        }),
      ),
      h('div', { class: 'card' }, h('h3', null, 'きろく'), h('div', { class: 'muted' }, `出会った場所：${mon.caughtAt}（Lv${mon.caughtLevel}）`), h('div', { class: 'muted' }, `進化の記録：${mon.history.map((x) => getSpecies(x).name).join(' → ')}`)),
      ctx.partyIndex !== undefined
        ? h(
            'div',
            { class: 'row' },
            h('button', { class: 'btn grow', disabled: ctx.partyIndex === 0, onClick: () => { reorderParty(save, ctx.partyIndex!, 0); ctx.partyIndex = 0; audio.se('ok'); toast('先頭に しました'); } }, '先頭にする'),
            h('button', { class: 'btn ghost grow', onClick: async () => { const r = moveToBox(save, ctx.partyIndex!); if (!r.ok) await alertBox(r.reason ?? 'できません'); else { toast('ボックスに あずけました'); s.close(); } } }, 'ボックスへ'),
          )
        : '',
      ctx.boxIndex !== undefined ? h('button', { class: 'btn blue', style: 'width:100%', onClick: async () => { const r = moveToParty(save, ctx.boxIndex!); if (!r.ok) await alertBox(r.reason ?? 'できません'); else { toast('パーティーに くわえました'); s.close(); } } }, 'パーティーに くわえる') : '',
    );
  };
  render();
  await s.done;
}

export async function openBox(): Promise<void> {
  const save = session.data;
  const s = openScreen('ボックス');
  const render = () => {
    clear(s.body);
    if (save.box.length === 0) s.body.append(h('p', { class: 'muted', style: 'color:#ddd' }, 'ボックスは からっぽです。4体目からの なかまは ここに 入ります。'));
    save.box.forEach((m, i) =>
      s.body.append(
        monCard(m, async () => {
          audio.se('ok');
          const opts = [
            { label: 'ようすを見る', value: 'view' },
            { label: 'パーティーに くわえる', value: 'add', disabled: save.party.length >= PARTY_MAX },
            ...save.party.map((p, pi) => ({ label: `${displayName(p)} と いれかえる`, value: `swap${pi}` })),
          ];
          const v = await choose<string>(`${displayName(m)}を どうする？`, opts, 'cancel');
          if (v === 'view') await openMonster(m, { boxIndex: i });
          else if (v === 'add') {
            const r = moveToParty(save, i);
            if (!r.ok) await alertBox(r.reason ?? '');
          } else if (v.startsWith('swap')) {
            const r = swapPartyBox(save, Number(v.slice(4)), i);
            if (!r.ok) await alertBox(r.reason ?? '');
            else toast('いれかえました');
          }
          render();
        }),
      ),
    );
  };
  render();
  await s.done;
}

// ── どうぐ ─────────────────────────────
export async function openBag(): Promise<void> {
  const save = session.data;
  const s = openScreen('どうぐ', { money: true });
  const render = () => {
    clear(s.body);
    const ids = ITEM_ORDER.filter((id) => itemCount(save, id) > 0);
    if (ids.length === 0) s.body.append(h('p', { class: 'muted', style: 'color:#ddd' }, 'なにも もっていない。'));
    for (const id of ids) {
      const it = getItem(id)!;
      s.body.append(
        h(
          'div',
          { class: 'card' },
          h('div', { class: 'row' }, h('b', { class: 'grow' }, it.name), h('span', null, `×${itemCount(save, id)}`)),
          h('div', { class: 'muted' }, it.description),
          it.usableInField ? h('button', { class: 'btn small', style: 'margin-top:8px', onClick: async () => { await useItemInField(id); render(); } }, 'つかう') : null,
        ),
      );
    }
  };
  render();
  await s.done;
}

async function useItemInField(itemId: string): Promise<void> {
  const save = session.data;
  const it = getItem(itemId)!;
  const opts = save.party.map((m, i) => {
    let ok: boolean;
    if (it.kind === 'evolve') ok = availableEvolutions(m, { mapId: save.location.mapId, itemId }).length > 0;
    else ok = itemUsableOn(itemId, m, false);
    return { label: `${displayName(m)}（Lv${m.level} HP${m.hp}/${maxHp(m)}）`, value: i, disabled: !ok, sub: ok ? undefined : 'つかえない' };
  });
  const idx = await choose<number>(`${it.name}を だれに つかう？`, opts, -1);
  if (idx < 0) return;
  const mon = save.party[idx];
  if (it.kind === 'evolve') {
    const evo = availableEvolutions(mon, { mapId: save.location.mapId, itemId });
    if (await offerEvolution(mon, evo)) removeItem(save, itemId, 1);
    return;
  }
  removeItem(save, itemId, 1);
  const max = maxHp(mon);
  if (it.kind === 'heal') mon.hp = Math.min(max, mon.hp + (it.healAmount ?? 0));
  else if (it.kind === 'cure') mon.status = null;
  else if (it.kind === 'revive') {
    mon.hp = Math.max(1, Math.floor(max * (it.reviveRatio ?? 0.5)));
    mon.status = null;
  }
  audio.se('heal');
  toast(`${displayName(mon)}に ${it.name}を つかった`);
}

// ── 図鑑 ─────────────────────────────
export async function openDex(): Promise<void> {
  const save = session.data;
  const s = openScreen('ともしび図鑑');
  const c = dexCounts(save);
  s.body.append(
    h('div', { class: 'card row' }, h('div', { class: 'grow' }, h('b', null, `つかまえた ${c.caught} / 見つけた ${c.seen} / ぜんぶで ${c.total}`), h('div', { class: 'note' }, '図鑑を うめると クエストの ほうしゅうが もらえます。')), h('button', { class: 'btn small', onClick: () => void openTypeChart() }, '相性表')),
    h(
      'div',
      { class: 'dex-grid' },
      SPECIES_LIST.map((sp) => {
        const st = save.dex[sp.id] ?? 'unknown';
        return h(
          'button',
          { class: 'btn dex-cell', onClick: () => { audio.se('ok'); void openDexEntry(sp.id); } },
          h('span', { class: 'no' }, `No.${String(sp.dexNo).padStart(3, '0')}`),
          h('img', { src: st === 'unknown' ? silhouetteUrl(sp.art) : monsterImageUrl(sp.art), alt: '', style: st === 'unknown' ? 'opacity:.5' : '' }),
          h('span', { class: st === 'caught' ? 'caught' : '' }, st === 'unknown' ? '？？？' : `${st === 'caught' ? '● ' : ''}${sp.name}`),
        );
      }),
    ),
  );
  await s.done;
}

function evoConditionText(c: NonNullable<ReturnType<typeof getSpecies>['evolutions']>[number]['condition']): string {
  switch (c.kind) {
    case 'level':
      return `Lv${c.level}`;
    case 'item':
      return `${getItem(c.itemId)?.name ?? c.itemId}を使う`;
    case 'levelAtLocation':
      return `${getMap(c.mapId).name}で Lv${c.level}以上`;
    case 'levelKnowsMove':
      return `「${getMove(c.moveId).name}」を覚えて Lv${c.level}以上`;
    case 'quest':
      return `クエスト「${QUESTS[c.questId]?.name}」達成後 Lv${c.level}`;
  }
}

async function openDexEntry(id: string): Promise<void> {
  const save = session.data;
  const sp = getSpecies(id);
  const st = save.dex[id] ?? 'unknown';
  const s = openScreen(`No.${String(sp.dexNo).padStart(3, '0')}`);
  if (st === 'unknown') {
    s.body.append(h('div', { class: 'card', style: 'text-align:center' }, h('img', { src: silhouetteUrl(sp.art), alt: '', style: 'width:160px;height:160px;opacity:.5' }), h('p', null, 'まだ 出会っていない 灯獣。'), h('p', { class: 'muted' }, `生息地のヒント：${sp.habitat}`)));
    await s.done;
    return;
  }
  const known = (x: string) => (save.dex[x] ?? 'unknown') !== 'unknown';
  // 進化の流れ（前→この種→後）
  const root = (() => {
    let r = sp;
    while (r.evolvesFrom) r = getSpecies(r.evolvesFrom);
    return r;
  })();
  const chain = h('div', { class: 'card' }, h('h3', null, '進化'));
  const drawLine = (from: typeof sp, depth: number) => {
    const evos = from.evolutions ?? [];
    for (const e of evos) {
      const to = getSpecies(e.to);
      chain.append(
        h('div', { class: 'row', style: `margin-left:${depth * 12}px;margin-top:6px` }, h('img', { src: known(from.id) ? monsterImageUrl(from.art) : silhouetteUrl(from.art), style: 'width:44px;height:44px' }), h('span', null, '→'), h('img', { src: known(to.id) ? monsterImageUrl(to.art) : silhouetteUrl(to.art), style: 'width:44px;height:44px' }), h('div', { class: 'grow' }, h('b', null, known(to.id) ? to.name : '？？？'), h('div', { class: 'note' }, `${evoConditionText(e.condition)}　${e.hint}`))),
      );
      drawLine(to, depth + 1);
    }
  };
  drawLine(root, 0);
  if (chain.childElementCount === 1) chain.append(h('div', { class: 'muted' }, '進化しない灯獣のようだ。'));
  s.body.append(
    h('div', { class: 'card', style: 'text-align:center' }, h('img', { src: monsterImageUrl(sp.art), alt: '', style: 'width:170px;height:170px' }), h('div', { style: 'font-size:20px;font-weight:800' }, sp.name), h('div', { class: 'muted' }, `${sp.category}　${st === 'caught' ? '● つかまえた' : '見つけた'}`), h('div', { style: 'margin-top:6px' }, sp.elements.map((e) => elementChip(e)))),
    h('div', { class: 'card' }, h('p', { style: 'margin:0 0 8px' }, sp.description), st === 'caught' ? h('p', { class: 'muted', style: 'margin:0' }, sp.ecology) : h('p', { class: 'muted', style: 'margin:0' }, 'つかまえると くわしい 生態が わかる。'), h('p', { class: 'muted' }, `すみか：${sp.habitat}`)),
    st === 'caught' ? h('div', { class: 'card' }, h('h3', null, '種族の とくちょう'), (Object.keys(STAT_JP) as StatKey[]).map((k) => h('div', { class: 'stat-row' }, h('span', { class: 'k' }, STAT_JP[k]), h('span', { class: 'v' }, sp.baseStats[k]), h('span', { class: 'bar' }, h('i', { style: `width:${Math.min(100, sp.baseStats[k] / 1.2)}%` }))))) : '',
    chain,
  );
  await s.done;
}

export async function openTypeChart(): Promise<void> {
  const s = openScreen('属性の相性');
  const table = h(
    'table',
    { class: 'chart' },
    h('tr', null, h('th', null, '攻＼防'), ELEMENT_ORDER.map((d) => h('th', { style: `color:${ELEMENTS[d].color}` }, ELEMENTS[d].name.slice(0, 2)))),
    ELEMENT_ORDER.map((a) =>
      h(
        'tr',
        null,
        h('th', { class: 'att', style: `color:${ELEMENTS[a].color}` }, ELEMENTS[a].name),
        ELEMENT_ORDER.map((d) => {
          const m = effectiveness(a, [d]);
          return h('td', { class: m > 1 ? 'x2' : m < 1 ? 'x05' : '' }, m > 1 ? '◎' : m < 1 ? '△' : '');
        }),
      ),
    ),
  );
  s.body.append(
    h('div', { class: 'card' }, table, h('p', { class: 'note' }, '◎＝ばつぐん（2倍）　△＝いまひとつ（0.5倍）　空白＝ふつう。2つの属性を持つ相手には 倍率が かけ算になります。自分と同じ属性の技は 1.25倍。効果が まったく無い組み合わせは ありません。')),
    ...ELEMENT_ORDER.map((e) => h('div', { class: 'card' }, h('div', null, elementChip(e)), h('div', { class: 'note' }, ELEMENTS[e].role))),
  );
  await s.done;
}

// ── クエスト ───────────────────────────
export async function openQuests(): Promise<void> {
  const save = session.data;
  const s = openScreen('クエスト');
  session.checkQuests();
  const ids = QUEST_ORDER.filter((id) => save.quests[id]);
  const active = ids.filter((id) => save.quests[id].state === 'active');
  const done = ids.filter((id) => save.quests[id].state !== 'active');
  const card = (id: string) => {
    const q = QUESTS[id];
    const st = save.quests[id].state;
    const rw = [q.reward.money ? `${q.reward.money}ルクス` : '', ...(q.reward.items ?? []).map(([i, n]) => `${getItem(i)?.name}×${n}`)].filter(Boolean).join('、');
    return h('div', { class: 'card', style: st !== 'active' ? 'opacity:.7' : '' }, h('div', { class: 'row' }, h('span', { class: 'el', style: `background:${q.kind === 'main' ? '#ef8a3a' : '#4a7fc0'}` }, q.kind === 'main' ? 'メイン' : 'サブ'), h('b', { class: 'grow' }, q.name), st !== 'active' ? h('span', { style: 'color:#4cae4f;font-weight:800' }, '✔ 達成') : null), h('p', { class: 'muted', style: 'margin:6px 0' }, q.description), h('div', { class: 'note' }, `ほうしゅう：${rw || 'なし'}${q.reportTo ? `　/　依頼人：${q.reportTo}` : ''}`));
  };
  s.body.append(h('h3', { style: 'color:#fff;margin:4px 0 8px' }, `すすめているクエスト（${active.length}）`), ...active.map(card), h('h3', { style: 'color:#fff;margin:14px 0 8px' }, `達成したクエスト（${done.length}）`), ...done.map(card));
  if (ids.length === 0) s.body.append(h('p', { style: 'color:#ddd' }, 'まだ クエストは ありません。'));
  await s.done;
}

// ── ショップ ───────────────────────────
export async function openShop(shopId: string): Promise<void> {
  const save = session.data;
  const shop = SHOPS[shopId];
  const s = openScreen(shop.name, { money: true });
  let tab: 'buy' | 'sell' = 'buy';
  const money = s.el.querySelector('.money') as HTMLElement;
  const render = () => {
    clear(s.body);
    money.textContent = `${save.money.toLocaleString()} ルクス`;
    s.body.append(h('div', { class: 'tabs' }, h('button', { class: `btn ${tab === 'buy' ? 'on' : ''}`, onClick: () => { tab = 'buy'; audio.se('cursor'); render(); } }, 'かう'), h('button', { class: `btn ${tab === 'sell' ? 'on' : ''}`, onClick: () => { tab = 'sell'; audio.se('cursor'); render(); } }, 'うる')));
    if (tab === 'buy') {
      for (const st of shop.stock.filter((x) => checkCondition(save, x.showIf))) {
        const it = getItem(st.itemId)!;
        s.body.append(
          h(
            'button',
            {
              class: 'btn choice',
              style: 'width:100%;margin-bottom:8px',
              disabled: save.money < it.price,
              onClick: async () => {
                const max = Math.max(1, Math.min(99 - itemCount(save, it.id), Math.floor(save.money / it.price)));
                const n = await chooseNumber(`${it.name}を いくつ 買う？（いま ${itemCount(save, it.id)}こ）`, 1, max, it.price);
                if (!n) return;
                if (!(await confirm(`${it.name}を ${n}こ、${(it.price * n).toLocaleString()} ルクスで 買いますか？`))) return;
                const r = buy(save, it.id, n);
                if (!r.ok) await alertBox(r.reason ?? '');
                else {
                  audio.se('item');
                  toast(`${it.name}を ${n}こ 買った`);
                }
                render();
              },
            },
            h('span', null, `${it.name}　${it.price.toLocaleString()} ルクス`),
            h('small', null, `${it.description}（もっている：${itemCount(save, it.id)}）`),
          ),
        );
      }
    } else {
      const ids = ITEM_ORDER.filter((id) => itemCount(save, id) > 0 && getItem(id)!.price > 0 && getItem(id)!.kind !== 'key');
      if (!ids.length) s.body.append(h('p', { style: 'color:#ddd' }, '売れる どうぐが ありません。'));
      for (const id of ids) {
        const it = getItem(id)!;
        const price = Math.floor(it.price / 2);
        s.body.append(
          h(
            'button',
            {
              class: 'btn choice',
              style: 'width:100%;margin-bottom:8px',
              onClick: async () => {
                const n = await chooseNumber(`${it.name}を いくつ 売る？`, 1, itemCount(save, id), price);
                if (!n) return;
                if (!(await confirm(`${it.name}を ${n}こ、${(price * n).toLocaleString()} ルクスで 売りますか？`))) return;
                sell(save, id, n);
                audio.se('item');
                render();
              },
            },
            h('span', null, `${it.name}　売値 ${price} ルクス`),
            h('small', null, `もっている：${itemCount(save, id)}`),
          ),
        );
      }
    }
  };
  render();
  await s.done;
}

// ── レポート（セーブ） ─────────────────────
export async function openReport(): Promise<void> {
  const save = session.data;
  const s = openScreen('レポート');
  const status = h('div', { class: 'muted' });
  const render = () => {
    clear(s.body);
    s.body.append(
      h(
        'div',
        { class: 'card' },
        h('h3', null, `スロット${save.slot}：${save.playerName}`),
        h('div', { class: 'muted' }, `プレイ時間 ${formatTime(save.playTimeSec)}　最後のセーブ ${new Date(save.savedAt).toLocaleString('ja-JP')}`),
        status,
        h(
          'button',
          {
            class: 'btn primary',
            style: 'width:100%;margin-top:10px',
            onClick: async () => {
              if (!(await confirm('今の 冒険を セーブしますか？\n（前のセーブは 上書きされます。1つ前の セーブは 予備として のこります）'))) return;
              const r = await session.saveNow();
              if (r.ok) {
                audio.se('item');
                toast('セーブしました');
              } else await alertBox(`セーブできませんでした。\n${r.message}`);
              render();
            },
          },
          '💾 セーブする',
        ),
        h('p', { class: 'note' }, 'このゲームは 建物の出入り・戦闘のあと・アプリを閉じた時にも 自動でセーブします。'),
      ),
      h(
        'div',
        { class: 'card' },
        h('h3', null, 'データの書き出し・読み込み'),
        h('p', { class: 'note' }, 'セーブデータは この端末のブラウザの中だけに あります。ブラウザの「履歴とデータの削除」や、ホーム画面のアイコンを消すと セーブが消えることがあります。大事なデータは ときどき 書き出して 保管してください。'),
        h('div', { class: 'row' }, h('button', { class: 'btn grow', onClick: () => doExport() }, '⬇ 書き出す'), h('button', { class: 'btn ghost grow', onClick: () => doImport() }, '⬆ 読み込む')),
      ),
    );
  };
  const doExport = async () => {
    await session.saveNow();
    const text = exportSave(save);
    const blob = new Blob([text], { type: 'application/json' });
    const a = h('a', { href: URL.createObjectURL(blob), download: `luminaria-save-slot${save.slot}-${new Date().toISOString().slice(0, 10)}.json` });
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('セーブデータを 書き出しました');
  };
  const doImport = async () => {
    const input = h('input', { type: 'file', accept: 'application/json,.json' });
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = parseImport(text, save.slot);
        const ok = await confirm(`「${data.playerName}」（プレイ ${formatTime(data.playTimeSec)}）の データを 読み込みます。\n今の スロット${save.slot}の 冒険は 上書きされます。よろしいですか？`, '上書きする', 'やめる', true);
        if (!ok) return;
        await saveGame(data);
        await alertBox('読み込みました。タイトル画面に もどります。');
        location.reload();
      } catch (e) {
        await alertBox(`読み込めませんでした。\n${e instanceof SaveError ? e.message : (e as Error).message}`);
      }
    });
    input.click();
  };
  render();
  await s.done;
}

// ── 設定 ─────────────────────────────
export async function openSettings(opts: { inTitle?: boolean; onDeleteAll?: () => Promise<void> } = {}): Promise<void> {
  const s = openScreen('せってい');
  const set = session.settings;
  const slider = (label: string, key: 'bgmVolume' | 'seVolume') => {
    const input = h('input', { type: 'range', min: '0', max: '1', step: '0.05', value: String(set[key]), class: 'slider' }) as HTMLInputElement;
    input.addEventListener('change', () => {
      void session.updateSettings({ [key]: Number(input.value) });
      if (key === 'seVolume') audio.se('ok');
    });
    return h('div', null, h('div', { class: 'muted' }, label), input);
  };
  const toggle = (label: string, key: 'bgmOn' | 'seOn' | 'skipAnimations') => {
    const btn = h('button', { class: 'btn small' }, '');
    const upd = () => {
      btn.textContent = session.settings[key] ? 'ON' : 'OFF';
      btn.className = `btn small ${session.settings[key] ? 'primary' : 'ghost'}`;
    };
    btn.addEventListener('click', async () => {
      await session.updateSettings({ [key]: !session.settings[key] });
      audio.se('cursor');
      upd();
    });
    upd();
    return h('div', { class: 'switch-row' }, h('span', null, label), btn);
  };
  const speed = h('div', { class: 'tabs' });
  const drawSpeed = () => {
    speed.replaceChildren(
      ...([1, 2, 3] as const).map((v) =>
        h('button', { class: `btn ${session.settings.battleSpeed === v ? 'on' : ''}`, onClick: async () => { await session.updateSettings({ battleSpeed: v }); audio.se('cursor'); drawSpeed(); } }, ['', 'ふつう', 'はやい', 'さいそく'][v]),
      ),
    );
  };
  drawSpeed();
  const off = h('div', { class: 'muted' }, 'しらべています……');
  void offlineStatus().then((st) => {
    off.textContent = st.message;
    off.style.color = st.ready ? '#2e8b3a' : '#b5651d';
  });
  s.body.append(
    h('div', { class: 'card' }, h('h3', null, 'おと'), toggle('BGM', 'bgmOn'), slider('BGMの 音量', 'bgmVolume'), toggle('効果音', 'seOn'), slider('効果音の 音量', 'seVolume')),
    h('div', { class: 'card' }, h('h3', null, '戦闘'), h('div', { class: 'muted' }, 'メッセージの はやさ'), speed, toggle('アニメーションを 短くする', 'skipAnimations')),
    h(
      'div',
      { class: 'card' },
      h('h3', null, 'オフラインで あそぶ'),
      off,
      h('p', { class: 'note' }, '一度 インターネットにつないで 開くと、必要なファイルが この端末に保存され、そのあとは 電波がなくても 遊べます。ホーム画面に追加すると アプリのように 起動できます。'),
      h('button', { class: 'btn small', onClick: async () => { const ok = await requestPersistence(); toast(ok ? 'データを消されにくい設定に しました' : 'このブラウザでは 設定できませんでした'); } }, 'セーブデータを 消されにくくする'),
    ),
    h(
      'div',
      { class: 'card' },
      h('h3', null, 'このゲームについて'),
      h('p', { class: 'note' }, `ルミナリア・テイル ～灯獣の島～　バージョン ${typeof __APP_VERSION__ === 'string' ? __APP_VERSION__ : ''}`),
      h('p', { class: 'note' }, '開発中の試作版です。灯獣の絵・BGM・効果音は すべて仮素材（プログラムで描画・演奏）です。'),
      h('details', null, h('summary', { class: 'note' }, 'BGMの対応表（開発用）'), h('ul', { class: 'note' }, BGM_PLAN.map((b) => h('li', null, `${b.scene}：${b.track}（${b.status}）`)))),
    ),
    opts.onDeleteAll ? h('div', { class: 'card' }, h('h3', null, 'データの削除'), h('button', { class: 'btn danger small', onClick: () => opts.onDeleteAll!() }, 'セーブデータを 消す…')) : '',
  );
  await s.done;
}

declare const __APP_VERSION__: string;

// ── 通信（QRコードで ともだちと遊ぶ。中身は src/ui/link.ts、開いた時だけ読みこむ） ─────
export async function openOnline(): Promise<void> {
  let mod: typeof import('./link');
  try {
    mod = await import('./link');
  } catch {
    await alertBox('「つうしん」を よみこめませんでした。いちど インターネットに つないで ゲームを ひらきなおしてね。');
    return;
  }
  await mod.openLink();
}

