/**
 * 育成まわりの画面：技の入れ替え、進化先の選択、進化演出。
 */
import { monsterImageUrl } from '../art/monsterArt';
import { audio } from '../audio/audio';
import { session } from '../core/session';
import type { EvolutionDef, MonsterInstance, StatKey } from '../core/types';
import { ELEMENTS } from '../data/elements';
import { getMove } from '../data/moves';
import { getSpecies } from '../data/species';
import { markCaught } from '../logic/game';
import { displayName, evolve, learnMove, MAX_MOVES, movesOnEvolve, statsPreview } from '../logic/monster';
import { statsOf } from '../logic/stats';
import { choose, confirm, say } from './dialog';
import { h, uiRoot } from './dom';

const STAT_JP: Record<StatKey, string> = { hp: 'HP', atk: 'こうげき', def: 'ぼうぎょ', spa: 'とくこう', spd: 'とくぼう', spe: 'すばやさ' };
const ROLE_JP: Record<string, string> = { attacker: '物理アタッカー', tank: '守りの壁役', special: '特殊アタッカー', support: '回復・補助役', speed: 'スピード型', balanced: 'バランス型' };

export function elementChip(el: keyof typeof ELEMENTS) {
  const e = ELEMENTS[el];
  return h('span', { class: 'el', style: `background:${e.color}` }, e.name);
}

/** 新しい技を覚えるか、どの技と入れ替えるかを聞く */
export async function promptLearnMove(mon: MonsterInstance, moveId: string): Promise<void> {
  const mv = getMove(moveId);
  const name = displayName(mon);
  if (mon.moves.length < MAX_MOVES) {
    learnMove(mon, moveId, mon.moves.length);
    await say(`${name}は ${mv.name}を おぼえた！`);
    return;
  }
  await say(`${name}は ${mv.name}を おぼえたい……\nでも 技は ${MAX_MOVES}つまでしか おぼえられない。`);
  for (;;) {
    const idx = await choose<number>(
      `${mv.name}（${ELEMENTS[mv.element].name}・威力${mv.power || '—'}）\nどの技を わすれさせる？`,
      mon.moves.map((m, i) => {
        const d = getMove(m.id);
        return { label: d.name, sub: `${ELEMENTS[d.element].name}・威力${d.power || '—'}・${d.description}`, value: i };
      }),
      -1,
    );
    if (idx < 0) {
      if (await confirm(`${mv.name}を おぼえるのを あきらめますか？`)) {
        await say(`${name}は ${mv.name}を おぼえずに おわった。`);
        return;
      }
      continue;
    }
    const old = getMove(mon.moves[idx].id).name;
    learnMove(mon, moveId, idx);
    audio.se('ok');
    await say(`1、2の……ポカン！\n${name}は ${old}を わすれて ${mv.name}を おぼえた！`);
    return;
  }
}

function diffLine(mon: MonsterInstance, toId: string) {
  const now = statsOf(mon);
  const next = statsPreview(mon, toId);
  return h(
    'div',
    { class: 'diff' },
    (Object.keys(STAT_JP) as StatKey[]).map((k) => {
      const d = next[k] - now[k];
      return h('span', null, `${STAT_JP[k]} `, h('b', { class: d > 0 ? 'up' : d < 0 ? 'down' : '' }, d > 0 ? `+${d}` : `${d}`), '　');
    }),
  );
}

/** 複数の進化先から選ぶ（違いが分かるように能力の増減と役割を見せる） */
export function chooseEvolution(mon: MonsterInstance, options: EvolutionDef[]): Promise<string | null> {
  return new Promise((resolve) => {
    const wrap = h('div', { class: 'evo-screen' });
    const close = (v: string | null) => {
      audio.se(v ? 'ok' : 'cancel');
      wrap.remove();
      resolve(v);
    };
    wrap.append(
      h('div', { class: 'evo-text' }, `${displayName(mon)}の 灯が ゆらいでいる……\nどの姿へ 進化させる？`),
      h(
        'div',
        { class: 'evo-choice' },
        options.map((o) => {
          const sp = getSpecies(o.to);
          return h(
            'button',
            { class: 'btn evo-option', onClick: () => close(o.to) },
            h('img', { src: monsterImageUrl(sp.art), alt: '' }),
            h(
              'div',
              { class: 'grow' },
              h('div', null, sp.name, ' ', sp.elements.map((e) => elementChip(e))),
              h('div', { class: 'muted' }, `${ROLE_JP[sp.role] ?? ''}：${o.hint}`),
              diffLine(mon, o.to),
            ),
          );
        }),
        h('button', { class: 'btn ghost', onClick: () => close(null) }, '今は 進化させない'),
      ),
    );
    uiRoot().append(wrap);
  });
}

/** 進化演出。途中で「やめる」を押すと進化しない。進化したら true */
export function playEvolution(mon: MonsterInstance, toId: string): Promise<boolean> {
  return new Promise((resolve) => {
    const from = getSpecies(mon.speciesId);
    const to = getSpecies(toId);
    const name = displayName(mon);
    const imgA = h('img', { src: monsterImageUrl(from.art), alt: '' });
    const imgB = h('img', { src: monsterImageUrl(to.art), alt: '', style: 'opacity:0' });
    const text = h('div', { class: 'evo-text' }, `おや……？ ${name}の 様子が……！`);
    let cancelled = false;
    const stopBtn = h('button', { class: 'btn ghost', onClick: () => { cancelled = true; } }, '進化を やめる');
    const wrap = h('div', { class: 'evo-screen' }, h('div', { class: 'evo-stage' }, imgA, imgB), text, stopBtn);
    uiRoot().append(wrap);
    const prev = audio.currentBgm;
    audio.playBgm('evolution');
    let t = 0;
    const steps = 22;
    const tick = () => {
      if (cancelled) {
        imgA.style.opacity = '1';
        imgA.style.filter = '';
        imgB.style.opacity = '0';
        text.textContent = `あれ……？ ${name}の 変化が 止まった！`;
        audio.se('cancel');
        stopBtn.remove();
        window.setTimeout(() => {
          wrap.remove();
          if (prev) audio.playBgm(prev);
          resolve(false);
        }, 1400);
        return;
      }
      t++;
      const showB = t % 2 === 0 && t > steps / 3;
      const bright = `brightness(${3 + t * 0.2}) saturate(0)`;
      imgA.style.filter = bright;
      imgB.style.filter = bright;
      imgA.style.opacity = showB ? '0' : '1';
      imgB.style.opacity = showB ? '1' : '0';
      if (t < steps) window.setTimeout(tick, Math.max(90, 420 - t * 16));
      else {
        stopBtn.remove();
        imgA.style.opacity = '0';
        imgB.style.opacity = '1';
        imgB.style.filter = '';
        imgB.style.transform = 'scale(1.08)';
        audio.se('evolve');
        const save = session.data;
        evolve(mon, toId);
        markCaught(save, toId);
        save.stats.evolutions++;
        if (from.id === 'fuwamo') save.flags.evolved_fuwamo = true;
        text.textContent = `おめでとう！ ${name}は ${to.name}に 進化した！`;
        window.setTimeout(async () => {
          wrap.remove();
          if (prev) audio.playBgm(prev);
          for (const mv of movesOnEvolve(mon)) await promptLearnMove(mon, mv);
          session.checkQuests();
          resolve(true);
        }, 2200);
      }
    };
    window.setTimeout(tick, 1400);
  });
}

/** 進化の確認から演出まで（分岐なら選択） */
export async function offerEvolution(mon: MonsterInstance, options: EvolutionDef[]): Promise<boolean> {
  if (options.length === 0) return false;
  let target: string | null;
  if (options.length === 1) {
    const sp = getSpecies(options[0].to);
    target = (await confirm(`${displayName(mon)}は ${sp.name}に 進化できる！\n進化させますか？`, '進化させる', 'あとで')) ? sp.id : null;
  } else target = await chooseEvolution(mon, options);
  if (!target) return false;
  return playEvolution(mon, target);
}
