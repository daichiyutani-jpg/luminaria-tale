import type { QuestDef } from '../core/types';

const list: QuestDef[] = [
  {
    id: 'main_1', name: 'はじめての灯獣', kind: 'main',
    description: 'ソラネ博士の研究所で相棒の灯獣を選び、カイトと勝負しよう。',
    goal: { kind: 'flag', flag: 'rival1_done' }, reward: { items: [['potion', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'main_2', name: 'ほたる森の異変', kind: 'main', startFlag: 'rival1_done',
    description: '北のほたる森に黒霞が広がっている。森の3つの灯籠柱に灯をともし、森の奥を調べよう。',
    goal: { kind: 'flag', flag: 'boss1_down' }, reward: { money: 1500, items: [['bright_lantern', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'main_3', name: '10の灯章', kind: 'main', startFlag: 'boss1_down',
    description: '島の10の町には それぞれ ジムがある。ジムリーダーに 勝って、灯章を 10個 集めよう。（ひだまり村 → こもれび町 → … → ルミナリア都）',
    goal: { kind: 'flag', flag: 'all_badges' }, reward: { items: [['star_lantern', 2], ['max_potion', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'main_4', name: '夜明けの灯', kind: 'main', startFlag: 'all_badges',
    description: 'ルミナリア都の 北、黒霞の洞窟の 最奥で、静夜団の ヨルが トコヨノヤミ（Lv70）を 目ざめさせた。島に 夜明けを 取りもどそう。',
    goal: { kind: 'flag', flag: 'final_boss_down' }, reward: { money: 20000, items: [['star_lantern', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'main_5', name: 'きらめく灯章', kind: 'main', startFlag: 'final_boss_down',
    description: '各地の ジムリーダーが 本気のチームで 待っている。きらめく灯章を 10個 そろえると、黒霞の洞窟の 最奥で 何かが 起こるらしい。',
    goal: { kind: 'flag', flag: 'final_boss2_down' }, reward: { money: 30000, items: [['star_lantern', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'main_6', name: 'さいはての灯', kind: 'main', startFlag: 'final_boss2_down',
    description: '灯の渡し舟で さいはて諸島へ。5つの町を ぬけて、さいはての灯台の 最上階に いる 主（Lv100）に 会いに行こう。',
    goal: { kind: 'flag', flag: 'isle_boss_down' }, reward: { money: 100000, items: [['star_lantern', 5]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'sub_lost_fuwamo', name: 'まいごのモコ', kind: 'sub', startFlag: 'nono_asked',
    description: 'そよかぜ草原のノノが、フワモの「モコ」を探している。草原のどこかにいるらしい。',
    goal: { kind: 'flag', flag: 'moco_returned' }, reward: { items: [['dawn_stone', 1]] }, reportTo: 'ノノ',
  },
  {
    id: 'sub_dex5', name: '図鑑づくりの第一歩', kind: 'sub', startFlag: 'got_starter',
    description: 'ちがう種類の灯獣を5種類つかまえて、図鑑に記録しよう。',
    goal: { kind: 'dexCaught', count: 5 }, reward: { items: [['bright_lantern', 3]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'sub_dex10', name: '灯獣はかせへの道', kind: 'sub', startFlag: 'got_starter',
    description: 'ちがう種類の灯獣を10種類つかまえよう。進化させても記録される。',
    goal: { kind: 'dexCaught', count: 10 }, reward: { items: [['sun_lantern', 2], ['revive_shard', 2]] }, reportTo: 'ソラネ博士',
  },
  {
    id: 'sub_trainers', name: '草原のうでじまん', kind: 'sub', startFlag: 'got_starter',
    description: 'そよかぜ草原にいる3人の灯守（ユウ・ミオ・ゲン）全員に勝とう。',
    goal: { kind: 'defeatTrainers', trainerIds: ['yu', 'mio', 'gen'] }, reward: { money: 1000, items: [['super_potion', 2]] },
  },
  {
    id: 'sub_yoiyami', name: 'よるの蛾のなぞ', kind: 'sub', startFlag: 'luka_asked',
    description: '研究員ルカは、ほたる森から追い出されたヨイヤミを調べたい。ヨイヤミをつかまえて見せてあげよう。',
    goal: { kind: 'ownSpecies', speciesId: 'yoiyami' }, reward: { items: [['revive_shard', 1], ['guard_tonic', 2]] }, reportTo: '研究員ルカ',
  },
  {
    id: 'sub_fuwamo_future', name: 'フワモの3つの未来', kind: 'sub', startFlag: 'heard_fuwamo',
    description: 'フワモは育て方で3つの姿に分かれるらしい。どれか1つの姿に進化させてみよう。',
    goal: { kind: 'flag', flag: 'evolved_fuwamo' }, reward: { items: [['sun_lantern', 1], ['power_tonic', 2]] }, reportTo: '助手のリンネ',
  },
];

export const QUESTS: Record<string, QuestDef> = Object.fromEntries(list.map((q) => [q.id, q]));
export const QUEST_ORDER = list.map((q) => q.id);
