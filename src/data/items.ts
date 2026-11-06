import type { ItemDef } from '../core/types';

const list: ItemDef[] = [
  { id: 'potion', name: 'きずぐすり', description: 'HPを20回復する。', kind: 'heal', price: 200, healAmount: 20, usableInBattle: true, usableInField: true },
  { id: 'super_potion', name: 'いいきずぐすり', description: 'HPを60回復する。', kind: 'heal', price: 600, healAmount: 60, usableInBattle: true, usableInField: true },
  { id: 'max_potion', name: 'まんたんのくすり', description: 'HPを すべて回復する。', kind: 'heal', price: 2500, healAmount: 9999, usableInBattle: true, usableInField: true },
  { id: 'antidote', name: 'どくけしそう', description: 'どくを治す。', kind: 'cure', price: 100, cures: ['poison'], usableInBattle: true, usableInField: true },
  { id: 'cure_all', name: 'なんでもなおし', description: 'すべての状態異常を治す。', kind: 'cure', price: 350, cures: 'all', usableInBattle: true, usableInField: true },
  { id: 'revive_shard', name: 'げんきのかけら', description: 'たおれた灯獣をHP半分で復活させる。', kind: 'revive', price: 1200, reviveRatio: 0.5, usableInBattle: true, usableInField: true },
  { id: 'lantern', name: 'ともしびランタン', description: '弱った野生の灯獣を捕まえる灯籠。', kind: 'capture', price: 150, captureBonus: 1, usableInBattle: true, usableInField: false },
  { id: 'bright_lantern', name: 'あかりランタン', description: 'ともしびランタンより捕まえやすい。', kind: 'capture', price: 500, captureBonus: 1.5, usableInBattle: true, usableInField: false },
  { id: 'sun_lantern', name: 'たいようランタン', description: 'とても捕まえやすい貴重な灯籠。店では買えない。', kind: 'capture', price: 0, captureBonus: 2.2, usableInBattle: true, usableInField: false },
  { id: 'star_lantern', name: 'ほしのランタン', description: '星の光を閉じこめた灯籠。とても よく捕まえられる。ジムの報酬などで手に入る。', kind: 'capture', price: 0, captureBonus: 3, usableInBattle: true, usableInField: false },
  { id: 'power_tonic', name: 'ちからのエキス', description: '戦闘中、攻撃と特攻を1段階上げる。', kind: 'battle', price: 400, stages: { atk: 1, spa: 1 }, usableInBattle: true, usableInField: false },
  { id: 'guard_tonic', name: 'まもりのエキス', description: '戦闘中、防御と特防を1段階上げる。', kind: 'battle', price: 400, stages: { def: 1, spd: 1 }, usableInBattle: true, usableInField: false },
  { id: 'dawn_stone', name: 'あかつきの石', description: '夜明けの光を閉じこめた石。ある灯獣を光に染める。', kind: 'evolve', price: 0, usableInBattle: false, usableInField: true },
  { id: 'lotion', name: 'ローション', description: 'とろりとした ふしぎな液体。チョンボに 使うと 進化するという。さいはて諸島の 道具屋で 売っている。', kind: 'evolve', price: 100000, usableInBattle: false, usableInField: true },
  { id: 'firefly_wing', name: 'ほたるのはね', description: 'ほたる森の主の灯が残る羽。森の奥の黒霞を晴らせるかもしれない。', kind: 'key', price: 0, usableInBattle: false, usableInField: false },
  { id: 'dex_device', name: 'ともしび図鑑', description: '出会った灯獣を記録する端末。', kind: 'key', price: 0, usableInBattle: false, usableInField: false },
];

export const ITEMS: Record<string, ItemDef> = Object.fromEntries(list.map((i) => [i.id, i]));
export const ITEM_ORDER = list.map((i) => i.id);

export function getItem(id: string): ItemDef | undefined {
  return ITEMS[id];
}
