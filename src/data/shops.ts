import type { Condition } from './conditions';

export interface ShopDef {
  id: string;
  name: string;
  stock: { itemId: string; showIf?: Condition }[];
}

export const SHOPS: Record<string, ShopDef> = {
  village: {
    id: 'village',
    name: 'トトの道具屋',
    stock: [
      { itemId: 'potion' },
      { itemId: 'super_potion', showIf: { flag: 'rival1_done' } },
      { itemId: 'antidote' },
      { itemId: 'cure_all', showIf: { flag: 'rival1_done' } },
      { itemId: 'lantern' },
      { itemId: 'bright_lantern', showIf: { flag: 'rival1_done' } },
      { itemId: 'revive_shard', showIf: { flag: 'boss1_down' } },
      { itemId: 'power_tonic' },
      { itemId: 'guard_tonic' },
    ],
  },
  town: {
    id: 'town',
    name: '灯の家の道具屋',
    stock: [
      { itemId: 'potion' },
      { itemId: 'super_potion' },
      { itemId: 'max_potion', showIf: { flag: 'badge_5' } },
      { itemId: 'antidote' },
      { itemId: 'cure_all' },
      { itemId: 'revive_shard' },
      { itemId: 'lantern' },
      { itemId: 'bright_lantern' },
      { itemId: 'power_tonic' },
      { itemId: 'guard_tonic' },
    ],
  },
};

/** 売値は買値の半分（売れないものは0） */
export function sellPrice(price: number): number {
  return Math.floor(price / 2);
}
