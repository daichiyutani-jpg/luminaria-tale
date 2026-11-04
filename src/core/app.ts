/**
 * ゲーム全体の進行役：タイトル → フィールド ⇄ 戦闘・メニュー。
 */
import Phaser from 'phaser';
import { monsterImageUrl } from '../art/monsterArt';
import { audio } from '../audio/audio';
import { getItem } from '../data/items';
import { getMap, type MapDef, type NpcDef, type ObjectDef } from '../data/maps';
import { getSpecies } from '../data/species';
import { rivalStarterFor, TRAINERS } from '../data/trainers';
import { addItem, addMonster, newGame } from '../logic/game';
import { availableEvolutions, createMonster, displayName, healFully, issueUid } from '../logic/monster';
import { mathRng } from '../logic/rng';
import { maxHp } from '../logic/stats';
import { deleteSlot, listSlots, loadGame, SLOT_COUNT, type SlotSummary } from '../save/saveManager';
import { SaveError } from '../save/validate';
import { applyUpdate, onUpdateReady, updateWaiting } from '../pwa';
import { BattleScene } from '../scenes/BattleScene';
import { BootScene } from '../scenes/BootScene';
import { FieldScene, type FieldHost } from '../scenes/FieldScene';
import { TitleScene } from '../scenes/TitleScene';
import { runBattle, type BattleConfig } from '../ui/battleUI';
import { alertBox, choose, confirm, say, toast } from '../ui/dialog';
import { clear, formatTime, h, uiRoot } from '../ui/dom';
import { offerEvolution } from '../ui/growth';
import { runScript, type ScriptHost } from '../ui/scriptRunner';
import { openBox, openMainMenu, openReport, openSettings, openShop } from '../ui/screens';
import { session } from './session';
import type { Facing } from './types';

/** ボスの素質（難易度調整：tests/balance.test.ts のシミュレーションで確認済み） */
const BOSS_IVS = { hp: 12, atk: 12, def: 12, spa: 12, spd: 12, spe: 12 };

class App implements FieldHost {
  game!: Phaser.Game;
  private hud: HTMLElement | null = null;
  private field: FieldScene | null = null;

  async start(): Promise<void> {
    await session.init();
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: 'game',
      backgroundColor: '#1d1630',
      scale: {
        mode: Phaser.Scale.FIT,
        width: Math.round(window.innerWidth * dpr),
        height: Math.round(window.innerHeight * dpr),
        autoCenter: Phaser.Scale.NO_CENTER,
      },
      render: { antialias: true, roundPixels: false },
      input: { activePointers: 2 },
      scene: [BootScene, TitleScene, FieldScene, BattleScene],
      fps: { target: 60 },
      disableContextMenu: true,
      banner: false,
    });
    const resize = () => {
      const d = Math.min(2, window.devicePixelRatio || 1);
      this.game.scale.setGameSize(Math.round(window.innerWidth * d), Math.round(window.innerHeight * d));
    };
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    // LINE などのアプリ内ブラウザでは、ツールバーの出し入れで画面の位置が変わってもイベントが来ないことがある。
    // タッチの直前に画面の位置を測り直して、タップした場所がずれないようにする。
    const refreshBounds = () => this.game.scale.updateBounds();
    window.addEventListener('touchstart', refreshBounds, { capture: true, passive: true });
    window.addEventListener('pointerdown', refreshBounds, { capture: true, passive: true });
    window.visualViewport?.addEventListener('scroll', refreshBounds);
    await new Promise<void>((r) => this.game.events.once('boot-ready', r));
    (window as unknown as { __game: unknown }).__game = { app: this, session };
    this.showTitle();
  }

  // ── タイトル ───────────────────────────
  showTitle(): void {
    this.removeHud();
    clear(uiRoot());
    this.game.scene.getScenes(true).forEach((s) => {
      if (s.scene.key !== 'title') this.game.scene.stop(s.scene.key);
    });
    this.game.scene.start('title');
    audio.playBgm('title');
    const root = h('div', { class: 'title-screen' });
    const logo = h('div', { class: 'title-logo' }, h('div', { class: 'sub' }, '～ 灯獣の島 ～'), h('h1', null, 'ルミナリア', h('br'), 'テイル'), h('div', { class: 'tag' }, 'ともしびけものと 旅をする RPG'));
    root.append(logo);
    uiRoot().append(root);
    // 音はタップ後でないと鳴らせないので、まず「タップしてスタート」
    if (!audio.unlocked) {
      const tap = h('div', { class: 'tap-start' }, '— タップして はじめる —');
      root.append(tap);
      root.addEventListener(
        'pointerup',
        () => {
          audio.unlock();
          audio.playBgm('title');
          tap.remove();
          void this.titleMenu(root);
        },
        { once: true },
      );
    } else void this.titleMenu(root);
  }

  private async titleMenu(root: HTMLElement): Promise<void> {
    let slots: SlotSummary[] = [];
    try {
      slots = await listSlots();
    } catch (e) {
      await alertBox(`セーブデータを 読み込めませんでした。\n${(e as Error).message}\n（この状態でも 新しく 始めることはできます）`);
      slots = [1, 2, 3].map((slot) => ({ slot, exists: false }));
    }
    const any = slots.some((s) => s.exists && !s.broken);
    const btns = h(
      'div',
      { class: 'title-btns' },
      updateWaiting() ? h('button', { class: 'btn blue', onClick: () => applyUpdate() }, '⬆ 新しい版に 更新する') : null,
      any ? h('button', { class: 'btn primary', onClick: () => void this.pickSlot('continue', slots) }, 'つづきから') : null,
      h('button', { class: `btn ${any ? '' : 'primary'}`, onClick: () => void this.pickSlot('new', slots) }, 'はじめから'),
      h('button', { class: 'btn ghost', onClick: () => void openSettings({ inTitle: true, onDeleteAll: () => this.deleteFlow() }) }, 'せってい'),
    );
    const foot = h('div', { class: 'title-foot' }, '※ 試作版です。絵・音楽は仮素材です。', h('br'), 'セーブはこの端末のブラウザ内に保存されます。');
    root.append(btns, foot);
    onUpdateReady(() => {
      if (!btns.isConnected || btns.querySelector('.btn.blue')) return;
      btns.prepend(h('button', { class: 'btn blue', onClick: () => applyUpdate() }, '⬆ 新しい版に 更新する'));
    });
  }

  private slotLabel(s: SlotSummary): { label: string; sub: string } {
    if (!s.exists) return { label: `スロット${s.slot}：（からっぽ）`, sub: '' };
    if (s.broken) return { label: `スロット${s.slot}：⚠ 読み込めないデータ`, sub: 'データが こわれています' };
    return { label: `スロット${s.slot}：${s.playerName}`, sub: `${getMap(s.location!).name}　図鑑 ${s.dexCaught}種　プレイ ${formatTime(s.playTimeSec ?? 0)}` };
  }

  private async pickSlot(mode: 'new' | 'continue', slots: SlotSummary[]): Promise<void> {
    audio.unlock();
    const opts = slots.map((s) => ({ ...this.slotLabel(s), value: s.slot, disabled: mode === 'continue' && (!s.exists || !!s.broken) }));
    const slot = await choose<number>(mode === 'new' ? 'どのスロットで はじめる？' : 'どの冒険の つづきを する？', opts, 0);
    if (!slot) return;
    const info = slots.find((s) => s.slot === slot)!;
    if (mode === 'new') {
      if (info.exists && !(await confirm(`スロット${slot}には「${info.playerName ?? 'こわれたデータ'}」の 冒険が あります。\n消して 新しく 始めますか？（元に もどせません）`, '消して始める', 'やめる', true))) return;
      const name = await this.askName();
      if (!name) return;
      const save = newGame(slot, name);
      session.start(save);
      await session.saveNow();
      await this.enterField(true);
    } else {
      try {
        const r = await loadGame(slot);
        if (!r) return;
        if (r.fromBackup) await alertBox('最新の セーブデータが こわれていたため、1つ前の セーブから 再開します。');
        session.start(r.data);
        await this.enterField(false);
      } catch (e) {
        await alertBox(`読み込めませんでした。\n${e instanceof SaveError ? e.message : (e as Error).message}`);
      }
    }
  }

  private askName(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = h('input', { type: 'text', maxlength: '8', value: 'アカリ', style: 'width:100%;font-size:20px;padding:10px;border-radius:12px;border:3px solid #2b2233;font-family:inherit' }) as HTMLInputElement;
      const wrap = h('div', { class: 'modal-wrap' });
      const done = (v: string | null) => {
        wrap.remove();
        resolve(v);
      };
      wrap.append(
        h(
          'div',
          { class: 'modal' },
          h('p', { class: 'modal-text' }, 'あなたの 名前を おしえてください（8文字まで）'),
          input,
          h('div', { class: 'modal-btns', style: 'margin-top:14px' }, h('button', { class: 'btn ghost', onClick: () => { audio.se('cancel'); done(null); } }, 'もどる'), h('button', { class: 'btn primary', onClick: () => { audio.se('ok'); done(input.value.trim().slice(0, 8) || 'アカリ'); } }, 'けってい')),
        ),
      );
      uiRoot().append(wrap);
      input.select();
    });
  }

  private async deleteFlow(): Promise<void> {
    const slots = await listSlots();
    const slot = await choose<number>('どのスロットを 消しますか？', slots.map((s) => ({ ...this.slotLabel(s), value: s.slot, disabled: !s.exists })), 0);
    if (!slot) return;
    if (!(await confirm(`スロット${slot}の セーブデータを 消します。\n本当に よろしいですか？`, '消す', 'やめる', true))) return;
    if (!(await confirm('もう一度 確認します。消したデータは 元に もどせません。', '完全に消す', 'やめる', true))) return;
    await deleteSlot(slot);
    toast(`スロット${slot}を 消しました`);
    this.showTitle();
  }

  // ── フィールド ─────────────────────────
  async enterField(isNew: boolean): Promise<void> {
    clear(uiRoot());
    this.game.scene.stop('title');
    const save = session.data;
    const loc = save.location;
    this.game.scene.start('field', { mapId: loc.mapId, x: loc.x, y: loc.y, facing: loc.facing, host: this });
    this.showHud();
    if (isNew) {
      await new Promise((r) => window.setTimeout(r, 400));
      this.field!.busy = true;
      await say(`${save.playerName}は 群島ルミナリアの「ひだまり村」で 生まれ育った。`);
      await say('この島の 灯獣（ともしびけもの）は、胸に 小さな「灯」を 宿している。');
      await say('そして 今日、あなたは 灯守（ひもり）として 旅立つ日を むかえた——。');
      await say('（左下の 十字ボタンで 歩きます。人や物の前で「しらべる」を押すと 話したり 調べたりできます。行きたい場所を 直接タップしても 歩けます）');
      this.field!.busy = false;
    }
  }

  private showHud(): void {
    this.removeHud();
    const save = session.data;
    const place = h('div', { class: 'hud-place' });
    const party = h('div', { class: 'hud-party' });
    const menuBtn = h('button', { class: 'btn primary hud-menu', onClick: () => void this.openMenu() }, h('span', { class: 'ico' }, '☰'), 'メニュー');
    this.hud = h('div', { class: 'hud' }, place, party, this.makePad(), menuBtn);
    uiRoot().prepend(this.hud);
    this.updateHud();
    void save;
  }

  /**
   * 画面の十字ボタンと「しらべる」ボタン。
   * キャンバスのタップに頼らず DOM のボタンで操作できるので、LINE などのアプリ内ブラウザでも確実に動く。
   */
  private makePad(): HTMLElement {
    const dirs: [Facing, string][] = [['up', '▲'], ['left', '◀'], ['right', '▶'], ['down', '▼']];
    let active: { dir: Facing; id: number } | null = null;
    const release = (id?: number) => {
      if (!active || (id !== undefined && id !== active.id)) return;
      active = null;
      if (this.field) this.field.padDir = null;
      pad.querySelectorAll('.pressed').forEach((b) => b.classList.remove('pressed'));
    };
    const buttons = dirs.map(([dir, label]) => {
      const b = h('button', { class: `pad-btn pad-${dir}`, 'aria-label': { up: '上', down: '下', left: '左', right: '右' }[dir] }, label);
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        audio.unlock();
        try {
          b.setPointerCapture(e.pointerId);
        } catch {
          /* 古いブラウザ */
        }
        pad.querySelectorAll('.pressed').forEach((x) => x.classList.remove('pressed'));
        b.classList.add('pressed');
        active = { dir, id: e.pointerId };
        if (this.field) {
          this.field.padDir = dir;
          this.field.padTap = dir;
        }
      });
      for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) b.addEventListener(ev, (e) => release(e.pointerId));
      b.addEventListener('contextmenu', (e) => e.preventDefault());
      return b;
    });
    const pad = h('div', { class: 'dpad' }, ...buttons);
    const action = h('button', { class: 'pad-a', 'aria-label': 'しらべる・はなす' }, 'しらべる');
    action.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      release();
      this.field?.pressAction();
    });
    // 画面が隠れた・会話が始まった時に押しっぱなしにならないように
    window.addEventListener('blur', () => release());
    return h('div', { class: 'pad-wrap' }, pad, action);
  }

  updateHud(): void {
    if (!this.hud || !session.save) return;
    const save = session.data;
    const [place, party] = [this.hud.querySelector('.hud-place')!, this.hud.querySelector('.hud-party')!];
    place.textContent = getMap(save.location.mapId).name;
    party.replaceChildren(
      ...save.party.map((m) => h('div', { class: `mini ${m.hp <= 0 ? 'ko' : ''}` }, h('img', { src: monsterImageUrl(getSpecies(m.speciesId).art), alt: '' }), h('i', { style: `width:${(m.hp / maxHp(m)) * 100}%` }))),
    );
  }

  private removeHud(): void {
    this.hud?.remove();
    this.hud = null;
  }

  private async openMenu(): Promise<void> {
    if (!this.field || this.field.busy) return;
    audio.se('ok');
    this.field.busy = true;
    if (this.hud) this.hud.style.display = 'none';
    try {
      await openMainMenu({
        onSave: () => openReport(),
        onTitle: async () => {
          if (!(await confirm('セーブして タイトル画面に もどりますか？'))) return;
          const r = await session.saveNow();
          if (!r.ok && !(await confirm(`セーブできませんでした（${r.message}）。\nそれでも もどりますか？`, 'もどる', 'やめる', true))) return;
          session.stop();
          this.showTitle();
          throw new Error('__to_title__');
        },
      });
    } catch (e) {
      if ((e as Error).message === '__to_title__') return;
      throw e;
    } finally {
      if (this.hud) this.hud.style.display = '';
    }
    if (this.field) {
      this.field.busy = false;
      this.field.refresh();
    }
    this.updateHud();
    await this.checkFieldEvolutions();
  }

  /** メニューで並べ替えた後や、レベルが上がった後に、その場所で進化できる仲間がいれば知らせる */
  private async checkFieldEvolutions(onlyUids?: string[]): Promise<void> {
    const save = session.data;
    for (const mon of save.party) {
      if (onlyUids && !onlyUids.includes(mon.uid)) continue;
      const evo = availableEvolutions(mon, { mapId: save.location.mapId, completedQuests: Object.keys(save.quests).filter((q) => save.quests[q].state === 'claimed') });
      if (evo.length && onlyUids) {
        if (this.field) this.field.busy = true;
        await offerEvolution(mon, evo);
        if (this.field) this.field.busy = false;
      }
    }
    this.updateHud();
  }

  // FieldHost
  async onEnterMap(scene: FieldScene, map: MapDef): Promise<void> {
    this.field = scene;
    this.updateHud();
    toast(map.name, 1500);
    void session.autosave('map');
    for (const ev of map.onEnter ?? []) {
      if (!checkConditionSafe(ev.if)) continue;
      scene.busy = true;
      await runScript(ev.script, this.scriptHost(scene));
      scene.busy = false;
      break;
    }
  }

  onStep(): void {
    // 歩くたびの処理（今は無し。毒の歩行ダメージなどを入れる場合はここ）
  }

  async onInteractNpc(scene: FieldScene, npc: NpcDef): Promise<void> {
    const save = session.data;
    if (npc.trainerId && !save.defeatedTrainers.includes(npc.trainerId)) {
      await this.onTrainerSpotted(scene, npc);
      return;
    }
    const talk = npc.talk.find((t) => checkConditionSafe(t.if));
    if (talk) await runScript(talk.script, this.scriptHost(scene));
    session.checkQuests();
    this.updateHud();
    scene.refresh();
    void session.autosave('talk');
  }

  async onInteractObject(scene: FieldScene, obj: ObjectDef): Promise<void> {
    const save = session.data;
    const key = `${scene.map.id}:${obj.id}`;
    switch (obj.kind) {
      case 'sign':
        await say(obj.text ?? '');
        break;
      case 'chest':
      case 'hidden': {
        if (save.openedChests.includes(key)) {
          if (obj.kind === 'chest') await say('宝箱は からっぽだ。');
          break;
        }
        const [itemId, n] = obj.item!;
        save.openedChests.push(key);
        addItem(save, itemId, n);
        audio.se('item');
        await say(obj.kind === 'chest' ? `宝箱を あけた！\n${getItem(itemId)?.name}を ${n}こ 手に入れた！` : `おや？ 足もとで 何かが 光っている……\n${getItem(itemId)?.name}を ${n}こ 見つけた！`);
        scene.refresh();
        break;
      }
      case 'lantern': {
        const f = obj.flag!;
        if (save.flags[f]) {
          await say('灯籠柱に あたたかい 灯が ともっている。');
          break;
        }
        save.flags[f] = true;
        audio.se('lantern');
        const lit = scene.map.objects.filter((o) => o.kind === 'lantern' && o.flag && save.flags[o.flag]).length;
        const total = scene.map.objects.filter((o) => o.kind === 'lantern').length;
        await say(`消えかけた 灯籠柱に 手をかざすと、灯が ふたたび ともった！（${lit}/${total}）`);
        if (lit >= total && scene.map.barrierFlag) {
          save.flags[scene.map.barrierFlag] = true;
          scene.refresh();
          audio.se('evolve');
          await say('3つの灯が 森じゅうに ひびきあい……\n奥をふさいでいた 黒霞が 晴れていく！');
        } else scene.refresh();
        break;
      }
      case 'heal':
        for (const m of save.party) healFully(m);
        save.respawn = { mapId: scene.map.id, x: scene.pos.x, y: scene.pos.y };
        audio.se('heal');
        await say(obj.text || 'なかまの 灯が あたたかく ともった。');
        await say('なかまは すっかり 元気になった！');
        break;
      case 'box':
        await say('灯獣の 保管機だ。ボックスの なかまを 入れかえられる。');
        await openBox();
        break;
      case 'pedestal':
        if (obj.script) await runScript(obj.script, this.scriptHost(scene));
        break;
    }
    this.updateHud();
    session.checkQuests();
    void session.autosave('object');
  }

  async onWildEncounter(scene: FieldScene, speciesId: string, level: number): Promise<void> {
    const save = session.data;
    if (save.party.every((m) => m.hp <= 0) || save.party.length === 0) return;
    const enemy = createMonster(speciesId, level, mathRng, { uid: issueUid(save), caughtAt: scene.map.name });
    await this.battle(scene, { kind: 'wild', enemies: [enemy], backdrop: scene.map.kind === 'dungeon' ? 'forest' : scene.map.kind === 'town' ? 'town' : 'field', bgm: 'battle' });
  }

  async onTrainerSpotted(scene: FieldScene, npc: NpcDef): Promise<void> {
    const host = this.scriptHost(scene);
    const r = await host.trainerBattle(npc.trainerId!);
    if (r === 'win') {
      const after = npc.talk.find((t) => checkConditionSafe(t.if));
      if (after && after.script !== 'trainer_generic') await runScript(after.script, host);
    }
    scene.refresh();
  }

  private scriptHost(scene: FieldScene): ScriptHost {
    return {
      trainerBattle: async (trainerId) => {
        const save = session.data;
        const t = TRAINERS[trainerId];
        const enemies = t.party.map((p) => {
          const sp = p.speciesId === '__rival_starter' ? rivalStarterFor(Object.keys(save.flags).find((k) => k.startsWith('starter_'))?.slice(8) ?? 'hinokoro') : p.speciesId;
          return createMonster(sp, p.level, mathRng, { uid: issueUid(save), caughtAt: t.name });
        });
        const res = await this.battle(scene, { kind: 'trainer', enemies, trainer: t, backdrop: scene.map.kind === 'indoor' ? 'indoor' : scene.map.kind === 'dungeon' ? 'forest' : 'field', bgm: 'battle' }, !!t.loseOk);
        if (res === 'win') {
          if (!save.defeatedTrainers.includes(trainerId)) save.defeatedTrainers.push(trainerId);
          session.checkQuests();
          return 'win';
        }
        if (t.loseOk) {
          if (!save.defeatedTrainers.includes(trainerId)) save.defeatedTrainers.push(trainerId);
          return 'lose-ok';
        }
        return 'lose';
      },
      bossBattle: async (speciesId, level) => {
        const save = session.data;
        const boss = createMonster(speciesId, level, mathRng, { uid: issueUid(save), caughtAt: scene.map.name, ivs: BOSS_IVS });
        const res = await this.battle(scene, { kind: 'boss', enemies: [boss], backdrop: 'boss', bgm: 'boss' });
        return res === 'win' ? 'win' : 'lose';
      },
      openShop: (id) => openShop(id),
      openBox: () => openBox(),
      refresh: () => {
        scene.refresh();
        this.updateHud();
      },
      mapName: () => scene.map.name,
      setRespawn: () => {
        session.data.respawn = { mapId: scene.map.id, x: scene.pos.x, y: scene.pos.y };
      },
      chapterClear: () => this.chapterClear(),
    };
  }

  /** 戦闘して、捕獲・進化・全滅まで処理する */
  private async battle(scene: FieldScene, cfg: BattleConfig, loseOk = false): Promise<'win' | 'lose' | 'run' | 'captured'> {
    const save = session.data;
    scene.busy = true;
    if (this.hud) this.hud.style.display = 'none';
    const outcome = await runBattle(this.game, cfg);
    if (this.hud) this.hud.style.display = '';
    audio.playBgm(scene.map.bgm);
    // 捕獲
    if (outcome.result === 'captured' && outcome.captured) {
      const mon = outcome.captured;
      mon.uid = issueUid(save);
      mon.caughtAt = scene.map.name;
      mon.caughtLevel = mon.level;
      mon.obtainedAt = new Date().toISOString();
      const first = save.dex[mon.speciesId] !== 'caught';
      const where = addMonster(save, mon);
      save.stats.captures++;
      if (first) await say(`${getSpecies(mon.speciesId).name}の データが 図鑑に 登録された！`);
      if (where === 'box') await say(`パーティーが いっぱいなので、${displayName(mon)}は ボックスに 送られた。\n（メニューの なかま → ボックス で 入れかえられます）`);
      else if (where === 'full') await say('ボックスも いっぱいで 連れていけなかった……。');
    }
    // 全滅
    if (outcome.result === 'lose') {
      if (loseOk) {
        for (const m of save.party) healFully(m);
      } else {
        const lost = Math.floor(save.money / 4);
        save.money -= lost;
        await say(`目の前が まっくらに なった……\n（${lost} ルクスを 落としてしまった）`);
        for (const m of save.party) healFully(m);
        const r = save.respawn;
        save.location = { mapId: r.mapId, x: r.x, y: r.y, facing: 'down' };
        await session.saveNow();
        scene.warpTo(r.mapId, r.x, r.y, 'down');
        scene.busy = false;
        return 'lose';
      }
    }
    // レベルが上がった仲間の進化
    if (outcome.leveledUp.length) await this.checkFieldEvolutions(outcome.leveledUp);
    session.checkQuests();
    this.updateHud();
    scene.refresh();
    void session.autosave('battle');
    scene.busy = false;
    return outcome.result;
  }

  private async chapterClear(): Promise<void> {
    const save = session.data;
    save.flags.chapter1_clear = true;
    await session.saveNow();
    audio.playBgm('ending');
    await new Promise<void>((resolve) => {
      const el = h(
        'div',
        { class: 'ending' },
        h('div', { style: 'font-size:14px;letter-spacing:.3em' }, 'CHAPTER 1'),
        h('h2', null, 'ほたる森の 灯'),
        h('p', null, `${save.playerName}と なかまたちは、黒霞に おおわれた ほたる森に 灯を 取りもどした。`),
        h('p', null, 'けれど 静夜団と「ヨル」、そして 夜明けの獣の なぞは まだ 海の向こうに ねむっている——。'),
        h('p', { style: 'font-size:13px;opacity:.9' }, `プレイ時間 ${formatTime(save.playTimeSec)}　図鑑 ${Object.values(save.dex).filter((v) => v === 'caught').length}種`),
        h('p', { style: 'font-size:13px;opacity:.9' }, '試作版は ここまでです。このあとも 草原と森で 灯獣あつめ・育成・サブクエストを 続けられます。'),
        h('button', { class: 'btn primary', onClick: () => { audio.se('ok'); el.remove(); resolve(); } }, '冒険を つづける'),
      );
      uiRoot().append(el);
    });
    audio.playBgm(this.field?.map.bgm ?? 'town');
  }
}

import { checkCondition, type Condition } from '../data/conditions';
function checkConditionSafe(c: Condition | undefined): boolean {
  return checkCondition(session.data, c);
}

export const app = new App();

// テスト・デバッグ用に公開
export const _debug = { SLOT_COUNT, getSpecies, addItem };
