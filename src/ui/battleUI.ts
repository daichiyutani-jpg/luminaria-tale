/**
 * 戦闘の操作と進行。処理は src/logic/battle.ts、見た目は BattleScene、ここは両者をつなぐ。
 */
import type Phaser from 'phaser';
import { monsterImageUrl } from '../art/monsterArt';
import { audio } from '../audio/audio';
import { session } from '../core/session';
import type { MonsterInstance } from '../core/types';
import { effectiveness, ELEMENTS } from '../data/elements';
import { getItem, ITEM_ORDER } from '../data/items';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import type { TrainerDef } from '../data/trainers';
import {
  active,
  aiChooseMove,
  aiChooseSwitch,
  canCapture,
  canRun,
  createBattle,
  itemUsableOn,
  resolveTurn,
  STATUS_NAME,
  switchAfterFaint,
  usableMoves,
  type Action,
  type BattleEvent,
  type BattleKind,
  type BattleResult,
  type BattleState,
  type SideIndex,
} from '../logic/battle';
import { expForLevel } from '../logic/exp';
import { addMoney, itemCount, markSeen, removeItem } from '../logic/game';
import { displayName } from '../logic/monster';
import { mathRng } from '../logic/rng';
import { maxHp } from '../logic/stats';
import type { Backdrop, BattleScene } from '../scenes/BattleScene';
import { h, uiRoot } from './dom';
import { promptLearnMove } from './growth';

export interface BattleConfig {
  kind: Exclude<BattleKind, 'pvp'>;
  enemies: MonsterInstance[];
  trainer?: TrainerDef;
  backdrop: Backdrop;
  bgm: 'battle' | 'boss';
}

export interface BattleOutcome {
  result: BattleResult;
  captured?: MonsterInstance;
  money: number;
  leveledUp: string[];
}

const SPEED_MS: Record<1 | 2 | 3, number> = { 1: 1200, 2: 750, 3: 380 };

export async function runBattle(game: Phaser.Game, cfg: BattleConfig): Promise<BattleOutcome> {
  const save = session.data;
  const state = createBattle(cfg.kind, { name: save.playerName, party: save.party }, { name: cfg.trainer?.name ?? '', party: cfg.enemies });
  markSeen(save, active(state, 1).speciesId);

  // 見た目の準備
  game.scene.sleep('field');
  const fast = () => session.settings.skipAnimations || session.settings.battleSpeed === 3;
  await new Promise<void>((resolve) => {
    game.scene.run('battle', { backdrop: cfg.backdrop, enemyArt: getSpecies(active(state, 1).speciesId).art, playerArt: null, fast: fast(), onReady: resolve });
  });
  const scene = game.scene.getScene('battle') as BattleScene;
  audio.playBgm(cfg.bgm);
  const ui = new BattleView(state, scene);
  try {
    return await ui.run(cfg);
  } finally {
    ui.destroy();
    game.scene.stop('battle');
    game.scene.wake('field');
  }
}

class BattleView {
  private root: HTMLElement;
  private enemyPanel: HTMLElement;
  private playerPanel: HTMLElement;
  private msg: HTMLElement;
  private cmd: HTMLElement;
  private shown: [number, number] = [0, 0];
  private tapResolve: (() => void) | null = null;

  constructor(
    private state: BattleState,
    private scene: BattleScene,
  ) {
    this.enemyPanel = h('div', { class: 'bpanel enemy' });
    this.playerPanel = h('div', { class: 'bpanel player', style: 'top:40%' });
    this.msg = h('div', { class: 'bmsg' });
    this.cmd = h('div');
    const speedBtn = h('button', { class: 'btn small ghost skip-btn', onClick: () => this.cycleSpeed(speedBtn) }, this.speedLabel());
    this.root = h('div', { class: 'battle-ui' }, this.enemyPanel, this.playerPanel, speedBtn, h('div', { class: 'bbottom' }, this.msg, this.cmd));
    this.msg.addEventListener('pointerup', () => this.tapResolve?.());
    uiRoot().append(this.root);
    this.playerPanel.style.visibility = 'hidden';
    this.renderPanel(1);
  }

  private speedLabel(): string {
    return ['', '▶ ふつう', '⏩ はやい', '⏭ さいそく'][session.settings.battleSpeed];
  }

  private cycleSpeed(btn: HTMLElement): void {
    const next = ((session.settings.battleSpeed % 3) + 1) as 1 | 2 | 3;
    void session.updateSettings({ battleSpeed: next });
    this.scene.setFast(session.settings.skipAnimations || next === 3);
    btn.textContent = this.speedLabel();
    audio.se('cursor');
  }

  destroy(): void {
    this.root.remove();
  }

  // ── 表示 ───────────────────────────
  private renderPanel(side: SideIndex, hpOverride?: number): void {
    const mon = active(this.state, side);
    const sp = getSpecies(mon.speciesId);
    const max = maxHp(mon);
    const hp = hpOverride ?? mon.hp;
    this.shown[side] = hp;
    const ratio = Math.max(0, Math.min(1, hp / max));
    const cls = ratio > 0.5 ? '' : ratio > 0.2 ? 'mid' : 'low';
    const panel = side === 0 ? this.playerPanel : this.enemyPanel;
    const caught = side === 1 && session.data.dex[mon.speciesId] === 'caught';
    panel.replaceChildren(
      h(
        'div',
        { class: 'nm' },
        caught ? h('span', { title: 'つかまえたことがある', style: 'color:#ef8a3a' }, '●') : null,
        displayName(mon),
        mon.status ? h('span', { class: `st ${mon.status}` }, STATUS_NAME[mon.status]) : null,
        h('span', { class: 'lv' }, `Lv${mon.level}`),
      ),
      h('div', null, sp.elements.map((e) => h('span', { class: 'el', style: `background:${ELEMENTS[e].color};font-size:10px;padding:0 6px` }, ELEMENTS[e].name))),
      h('div', { class: `hpbar ${cls}` }, h('i', { style: `width:${ratio * 100}%` })),
      side === 0 ? h('div', { class: 'hpnum' }, `${hp} / ${max}`) : '',
      side === 0 ? h('div', { class: 'expbar' }, h('i', { style: `width:${this.expRatio(mon) * 100}%` })) : '',
    );
  }

  private expRatio(mon: MonsterInstance): number {
    const a = expForLevel(mon.level);
    const b = expForLevel(mon.level + 1);
    return b > a ? Math.max(0, Math.min(1, (mon.exp - a) / (b - a))) : 1;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((r) => window.setTimeout(r, ms));
  }

  /** メッセージを出して、時間経過かタップで次へ */
  private message(text: string, extraWait = 0): Promise<void> {
    this.msg.textContent = text;
    const ms = SPEED_MS[session.settings.battleSpeed] + extraWait;
    return new Promise((resolve) => {
      const t = window.setTimeout(done, ms);
      function done() {
        window.clearTimeout(t);
        resolve();
      }
      this.tapResolve = () => {
        this.tapResolve = null;
        done();
      };
    });
  }

  private async play(events: BattleEvent[]): Promise<void> {
    for (const e of events) {
      switch (e.t) {
        case 'msg':
          await this.message(e.text);
          break;
        case 'move': {
          const mv = getMove(e.moveId);
          audio.se('move');
          if (mv.target === 'enemy') await this.scene.attack(e.side);
          break;
        }
        case 'hp': {
          const before = this.shown[e.side];
          if (e.hp < before) {
            const other: SideIndex = e.side === 0 ? 1 : 0;
            void other;
            audio.se(e.eff && e.eff > 1 ? 'superhit' : e.eff && e.eff < 1 ? 'weakhit' : 'hit');
            await this.scene.hit(e.side, e.eff ?? 1);
          } else if (e.hp > before) {
            audio.se('heal');
            await this.scene.heal(e.side);
          }
          this.renderPanel(e.side, e.hp);
          await this.wait(250);
          break;
        }
        case 'faint':
          audio.se('faint');
          await this.scene.faint(e.side);
          break;
        case 'send':
          this.renderPanel(e.side);
          if (e.side === 0) this.playerPanel.style.visibility = 'visible';
          await this.scene.sendOut(e.side, getSpecies(active(this.state, e.side).speciesId).art);
          if (e.side === 1) markSeen(session.data, active(this.state, 1).speciesId);
          break;
        case 'status':
          if (e.status) {
            audio.se('status');
            await this.scene.statusFx(e.side, e.status);
          }
          this.renderPanel(e.side, this.shown[e.side]);
          break;
        case 'stage':
          audio.se(e.delta > 0 ? 'statup' : 'statdown');
          await this.scene.statFx(e.side, e.delta > 0);
          break;
        case 'capture':
          audio.se('throw');
          await this.scene.throwLantern();
          for (let i = 0; i < e.shakes; i++) {
            audio.se('shake');
            await this.scene.shakeLantern();
          }
          audio.se(e.success ? 'catch' : 'catchfail');
          await this.scene.captureResult(e.success);
          if (!e.success) this.renderPanel(1);
          break;
        case 'exp':
          if (active(this.state, 0).uid === e.uid) this.renderPanel(0, this.shown[0]);
          break;
        case 'levelup':
          audio.se('levelup');
          if (active(this.state, 0).uid === e.uid) this.renderPanel(0);
          break;
        case 'end':
          break;
      }
    }
  }

  // ── 入力 ───────────────────────────
  private setCmd(...children: HTMLElement[]): void {
    this.cmd.replaceChildren(...children);
  }

  private mainCommand(): Promise<Action | 'back'> {
    return new Promise((resolve) => {
      const mon = active(this.state, 0);
      this.msg.textContent = `${displayName(mon)}は どうする？`;
      const pick = (fn: () => Promise<Action | 'back'>) => async () => {
        audio.se('ok');
        const r = await fn();
        if (r === 'back') resolve(await this.mainCommand());
        else resolve(r);
      };
      const wild = canCapture(this.state);
      this.setCmd(
        h(
          'div',
          { class: 'bcmd' },
          h('button', { class: 'btn primary wide', onClick: pick(() => this.moveMenu()) }, '⚔ たたかう'),
          h('button', { class: 'btn blue', onClick: pick(() => this.partyMenu(false)) }, '🔄 なかま'),
          h('button', { class: 'btn', onClick: pick(() => this.bagMenu()) }, '🎒 どうぐ'),
          wild ? h('button', { class: 'btn', onClick: pick(() => this.captureMenu()) }, '🏮 つかまえる') : null,
          h('button', { class: 'btn ghost', disabled: !canRun(this.state), onClick: () => { audio.se('ok'); resolve({ type: 'run' }); } }, canRun(this.state) ? '🏃 にげる' : 'にげられない'),
        ),
      );
    });
  }

  private moveMenu(): Promise<Action | 'back'> {
    return new Promise((resolve) => {
      const mon = active(this.state, 0);
      const foe = active(this.state, 1);
      const foeEls = getSpecies(foe.speciesId).elements;
      const usable = usableMoves(mon);
      if (usable.length === 0) {
        resolve({ type: 'move', index: 0 });
        return;
      }
      this.msg.textContent = 'どの技を つかう？';
      const btns = mon.moves.map((m, i) => {
        const d = getMove(m.id);
        const eff = d.category === 'status' ? 1 : effectiveness(d.element, foeEls);
        const effLabel = d.category === 'status' ? '補助' : eff > 1 ? 'ばつぐん！' : eff < 1 ? 'いまひとつ' : '';
        return h(
          'button',
          { class: 'btn bmove', style: `border-left-color:${ELEMENTS[d.element].color}`, disabled: m.pp <= 0, onClick: () => { audio.se('ok'); resolve({ type: 'move', index: i }); } },
          h('span', { class: 'mn' }, d.name),
          h('span', { class: 'mi' }, h('span', null, ELEMENTS[d.element].name), h('span', null, `PP ${m.pp}/${d.pp}`), d.power ? h('span', null, `威力${d.power}`) : ''),
          effLabel ? h('span', { class: `eff ${eff > 1 ? 'good' : eff < 1 ? 'bad' : ''}` }, effLabel) : '',
        );
      });
      this.setCmd(h('div', { class: 'bcmd' }, ...btns, h('button', { class: 'btn ghost wide', onClick: () => { audio.se('cancel'); resolve('back'); } }, 'もどる')));
    });
  }

  private partyMenu(forced: boolean): Promise<Action | 'back'> {
    return new Promise((resolve) => {
      const party = this.state.sides[0].party;
      this.msg.textContent = forced ? 'つぎに だす なかまを えらんでください' : 'だれと こうたいする？';
      const list = h(
        'div',
        { class: 'blist' },
        party.map((m, i) => {
          const isActive = i === this.state.sides[0].active;
          const max = maxHp(m);
          const ratio = m.hp / max;
          return h(
            'button',
            {
              class: `btn mon-card ${m.hp <= 0 ? 'fainted' : ''}`,
              disabled: m.hp <= 0 || isActive,
              onClick: () => { audio.se('ok'); resolve({ type: 'switch', to: i }); },
            },
            h('img', { src: monsterImageUrl(getSpecies(m.speciesId).art), alt: '' }),
            h(
              'div',
              { class: 'grow' },
              h('div', { class: 'nm' }, displayName(m), m.status ? h('span', { class: `st ${m.status}` }, STATUS_NAME[m.status]) : null, isActive ? h('span', { class: 'muted' }, '（たたかっている）') : null),
              h('div', { class: 'lv' }, `Lv${m.level}　HP ${m.hp}/${max}`),
              h('div', { class: `hpbar ${ratio > 0.5 ? '' : ratio > 0.2 ? 'mid' : 'low'}` }, h('i', { style: `width:${ratio * 100}%` })),
            ),
          );
        }),
      );
      this.setCmd(list, forced ? h('span') : h('button', { class: 'btn ghost', style: 'width:100%', onClick: () => { audio.se('cancel'); resolve('back'); } }, 'もどる'));
    });
  }

  private bagMenu(): Promise<Action | 'back'> {
    return new Promise((resolve) => {
      const save = session.data;
      const items = ITEM_ORDER.filter((id) => {
        const it = getItem(id)!;
        return it.usableInBattle && it.kind !== 'capture' && itemCount(save, id) > 0;
      });
      this.msg.textContent = items.length ? 'どの どうぐを つかう？' : 'つかえる どうぐを もっていない。';
      const list = h(
        'div',
        { class: 'blist' },
        items.map((id) => {
          const it = getItem(id)!;
          return h(
            'button',
            {
              class: 'btn choice',
              onClick: async () => {
                audio.se('ok');
                const target = await this.itemTarget(id);
                if (target === null) resolve(await this.bagMenu());
                else {
                  removeItem(save, id, 1);
                  resolve({ type: 'item', itemId: id, target });
                }
              },
            },
            h('span', null, `${it.name}　×${itemCount(save, id)}`),
            h('small', null, it.description),
          );
        }),
      );
      this.setCmd(list, h('button', { class: 'btn ghost', style: 'width:100%', onClick: () => { audio.se('cancel'); resolve('back'); } }, 'もどる'));
    });
  }

  private itemTarget(itemId: string): Promise<number | null> {
    return new Promise((resolve) => {
      const party = this.state.sides[0].party;
      const it = getItem(itemId)!;
      if (it.kind === 'battle') {
        resolve(this.state.sides[0].active);
        return;
      }
      this.msg.textContent = `${it.name}を だれに つかう？`;
      const list = h(
        'div',
        { class: 'blist' },
        party.map((m, i) => {
          const ok = itemUsableOn(itemId, m, i === this.state.sides[0].active);
          return h(
            'button',
            { class: `btn mon-card ${m.hp <= 0 ? 'fainted' : ''}`, disabled: !ok, onClick: () => { audio.se('ok'); resolve(i); } },
            h('img', { src: monsterImageUrl(getSpecies(m.speciesId).art), alt: '' }),
            h('div', { class: 'grow' }, h('div', { class: 'nm' }, displayName(m), m.status ? h('span', { class: `st ${m.status}` }, STATUS_NAME[m.status]) : null), h('div', { class: 'lv' }, `HP ${m.hp}/${maxHp(m)}`), ok ? null : h('div', { class: 'muted' }, 'つかっても こうかがない')),
          );
        }),
      );
      this.setCmd(list, h('button', { class: 'btn ghost', style: 'width:100%', onClick: () => { audio.se('cancel'); resolve(null); } }, 'もどる'));
    });
  }

  private captureMenu(): Promise<Action | 'back'> {
    return new Promise((resolve) => {
      const save = session.data;
      const lanterns = ITEM_ORDER.filter((id) => getItem(id)!.kind === 'capture');
      const has = lanterns.filter((id) => itemCount(save, id) > 0);
      this.msg.textContent = has.length ? 'どの ランタンを つかう？' : 'ランタンを もっていない！ 灯の家で 買えるよ。';
      const list = h(
        'div',
        { class: 'blist' },
        lanterns.map((id) => {
          const it = getItem(id)!;
          const n = itemCount(save, id);
          return h(
            'button',
            { class: 'btn choice', disabled: n <= 0, onClick: () => { removeItem(save, id, 1); audio.se('ok'); resolve({ type: 'capture', itemId: id }); } },
            h('span', null, `${it.name}　×${n}`),
            h('small', null, it.description),
          );
        }),
      );
      this.setCmd(list, h('button', { class: 'btn ghost', style: 'width:100%', onClick: () => { audio.se('cancel'); resolve('back'); } }, 'もどる'));
    });
  }

  // ── 進行 ───────────────────────────
  async run(cfg: BattleConfig): Promise<BattleOutcome> {
    const st = this.state;
    const enemy = active(st, 1);
    this.setCmd();
    if (cfg.kind === 'wild') {
      audio.se('encounter');
      await this.message(`あっ！ やせいの ${displayName(enemy)}が とびだしてきた！`);
    } else if (cfg.kind === 'boss') {
      await this.message(`${displayName(enemy)}が おそいかかってきた！`, 300);
    } else if (cfg.trainer) {
      await this.message(`${cfg.trainer.title}の ${cfg.trainer.name}が 勝負を しかけてきた！`);
      await this.message(`「${cfg.trainer.intro}」`, 400);
      await this.message(`${cfg.trainer.name}は ${displayName(enemy)}を くりだした！`);
    }
    await this.play([{ t: 'send', side: 0, index: st.sides[0].active }]);
    await this.message(`いけっ、${displayName(active(st, 0))}！`);

    while (!st.result) {
      if (st.needsSwitch[1]) {
        const to = aiChooseSwitch(st, 1);
        await this.play(switchAfterFaint(st, 1, to));
        continue;
      }
      if (st.needsSwitch[0]) {
        const a = (await this.partyMenu(true)) as Action;
        this.setCmd();
        if (a.type === 'switch') await this.play(switchAfterFaint(st, 0, a.to));
        continue;
      }
      const action = await this.mainCommand();
      if (action === 'back') continue;
      this.setCmd();
      const enemyAction = aiChooseMove(st, 1, mathRng, cfg.trainer?.smart ?? (cfg.kind === 'boss' ? 0.8 : 0.35));
      await this.play(resolveTurn(st, [action, enemyAction], mathRng));
    }
    return this.finish(cfg);
  }

  private async finish(cfg: BattleConfig): Promise<BattleOutcome> {
    const st = this.state;
    const save = session.data;
    let money = 0;
    this.setCmd();
    if (st.result === 'win') {
      audio.playBgm('victory');
      save.stats.battlesWon++;
      if (cfg.trainer) {
        await this.message(`${cfg.trainer.title}の ${cfg.trainer.name}との 勝負に かった！`);
        await this.message(`「${cfg.trainer.defeat}」`, 300);
        money = cfg.trainer.reward;
      } else if (cfg.kind === 'boss') {
        await this.message('激しい 戦いに 勝った！', 300);
      } else {
        money = Math.max(5, Math.floor(cfg.enemies.reduce((a, m) => a + m.level, 0) * 4));
      }
      if (money > 0) {
        addMoney(save, money);
        await this.message(`${money} ルクスを 手に入れた！`);
      }
    } else if (st.result === 'lose') {
      audio.se('lose');
      await this.message('たたかえる なかまが いなくなった……', 300);
    } else if (st.result === 'run') {
      // メッセージは戦闘処理の中で出ている
    }
    // 戦闘中に覚えられなかった技
    for (const p of st.pendingMoves) {
      const mon = save.party.find((m) => m.uid === p.uid);
      if (mon) await promptLearnMove(mon, p.moveId);
    }
    return { result: st.result!, captured: st.captured ?? undefined, money, leveledUp: st.leveledUp };
  }
}
