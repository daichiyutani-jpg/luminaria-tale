/**
 * 会話・イベント台本（src/data/scripts.ts）の実行。
 */
import { monsterImageUrl } from '../art/monsterArt';
import { audio, type SeId } from '../audio/audio';
import { session } from '../core/session';
import { checkCondition } from '../data/conditions';
import { getItem } from '../data/items';
import { SCRIPTS, type Cmd } from '../data/scripts';
import { getSpecies, STARTERS } from '../data/species';
import { addItem, addMoney, giveNewMonster } from '../logic/game';
import { healFully } from '../logic/monster';
import { mathRng } from '../logic/rng';
import { choose, confirm, say } from './dialog';
import { h, uiRoot } from './dom';
import { elementChip } from './growth';

export interface ScriptHost {
  trainerBattle(trainerId: string): Promise<'win' | 'lose' | 'lose-ok'>;
  bossBattle(speciesId: string, level: number): Promise<'win' | 'lose'>;
  legendBattle(speciesId: string, level: number): Promise<'captured' | 'win' | 'run' | 'lose'>;
  openShop(id: string): Promise<void>;
  openBox(): Promise<void>;
  refresh(): void;
  mapName(): string;
  setRespawn(): void;
  chapterClear(): Promise<void>;
}

export function partnerName(): string {
  const save = session.data;
  const key = Object.keys(save.flags).find((k) => k.startsWith('starter_') && save.flags[k]);
  return key ? getSpecies(key.slice('starter_'.length)).name : (save.party[0] ? getSpecies(save.party[0].speciesId).name : '相棒');
}

function fmt(text: string): string {
  return text.replaceAll('{player}', session.data.playerName).replaceAll('{partner}', partnerName());
}

/** 戻り値 false は「途中で中断（全滅など）」 */
export async function runScript(id: string, host: ScriptHost): Promise<boolean> {
  const cmds = SCRIPTS[id];
  if (!cmds) {
    await say('……。');
    return true;
  }
  return runCmds(cmds, host);
}

async function runCmds(cmds: Cmd[], host: ScriptHost): Promise<boolean> {
  const save = session.data;
  for (const c of cmds) {
    if ('say' in c) await say(fmt(c.say), c.who);
    else if ('choice' in c) {
      const idx = await choose<number>(fmt(c.choice), c.options.map((o, i) => ({ label: o.label, value: i })));
      if (!(await runCmds(c.options[idx].then, host))) return false;
    } else if ('setFlag' in c) {
      save.flags[c.setFlag] = true;
      host.refresh();
      session.checkQuests();
    } else if ('give' in c) {
      const [itemId, n] = c.give;
      addItem(save, itemId, n);
      audio.se('item');
      await say(`${getItem(itemId)?.name ?? itemId}${n > 1 ? `を ${n}こ` : 'を'} 手に入れた！`);
    } else if ('money' in c) {
      addMoney(save, c.money);
      await say(`${c.money} ルクスを 手に入れた！`);
    } else if ('heal' in c) {
      for (const m of save.party) healFully(m);
      if (c.respawn) host.setRespawn();
      audio.se('heal');
    } else if ('chooseStarter' in c) {
      await chooseStarter();
      host.refresh();
    } else if ('trainer' in c) {
      const r = await host.trainerBattle(c.trainer);
      if (r === 'win') {
        if (c.win && !(await runCmds(c.win, host))) return false;
      } else if (r === 'lose-ok') {
        if (c.lose && !(await runCmds(c.lose, host))) return false;
      } else return false;
    } else if ('boss' in c) {
      const r = await host.bossBattle(c.boss.speciesId, c.boss.level);
      if (r === 'win') {
        if (c.win && !(await runCmds(c.win, host))) return false;
      } else return false;
    } else if ('legend' in c) {
      const r = await host.legendBattle(c.legend.speciesId, c.legend.level);
      if (r === 'lose') return false;
      const next = r === 'captured' ? c.caught : r === 'win' ? c.win : c.run;
      if (next && !(await runCmds(next, host))) return false;
    } else if ('shop' in c) await host.openShop(c.shop);
    else if ('box' in c) await host.openBox();
    else if ('if' in c) {
      if (!(await runCmds(checkCondition(save, c.if) ? c.then : (c.else ?? []), host))) return false;
    } else if ('se' in c) audio.se(c.se as SeId);
    else if ('chapterClear' in c) await host.chapterClear();
  }
  return true;
}

/** 最初の相棒を選ぶ */
function chooseStarter(): Promise<void> {
  return new Promise((resolve) => {
    const save = session.data;
    const wrap = h('div', { class: 'screen', style: 'z-index:65' });
    const body = h('div', { class: 'screen-body' });
    wrap.append(h('div', { class: 'screen-head' }, h('h2', null, '相棒を えらぼう')), body);
    for (const id of STARTERS) {
      const sp = getSpecies(id);
      body.append(
        h(
          'button',
          {
            class: 'btn mon-card',
            style: 'width:100%;margin-bottom:10px;min-height:120px',
            onClick: async () => {
              audio.se('ok');
              if (!(await confirm(`${sp.name}（${sp.category}）に しますか？\n${sp.description}`, 'この子にする', 'まよう'))) return;
              giveNewMonster(save, id, 5, mathRng, 'ソラネ灯獣研究所');
              save.flags[`starter_${id}`] = true;
              wrap.remove();
              audio.se('catch');
              await say(`${sp.name}が なかまに なった！`);
              resolve();
            },
          },
          h('img', { src: monsterImageUrl(sp.art), alt: '', style: 'width:96px;height:96px' }),
          h('div', { class: 'grow' }, h('div', { class: 'nm' }, sp.name, ' ', sp.elements.map((e) => elementChip(e))), h('div', { class: 'muted', style: 'font-weight:400' }, sp.description), h('div', { class: 'note' }, `とくい：${sp.evolutions?.[0]?.hint ?? ''}`)),
        ),
      );
    }
    body.append(h('p', { class: 'note', style: 'color:#ddd' }, 'ほむらは めぶきに、めぶきは しおに、しおは ほむらに 強い。3匹は おたがいに 得意・苦手が あります。ほかの2匹も 島のどこかで 出会えるかも。'));
    uiRoot().append(wrap);
  });
}
