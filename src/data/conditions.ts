import type { QuestProgress, SaveData } from '../core/types';

/** NPCの表示・会話の分岐・クエストの受注に使う条件 */
export type Condition =
  | { flag: string }
  | { notFlag: string }
  | { questState: [string, QuestProgress['state']] }
  | { defeated: string }
  | { hasSpecies: string }
  | { all: Condition[] }
  | { any: Condition[] };

export function checkCondition(save: SaveData, c: Condition | undefined): boolean {
  if (!c) return true;
  if ('flag' in c) return !!save.flags[c.flag];
  if ('notFlag' in c) return !save.flags[c.notFlag];
  if ('questState' in c) return save.quests[c.questState[0]]?.state === c.questState[1];
  if ('defeated' in c) return save.defeatedTrainers.includes(c.defeated);
  if ('hasSpecies' in c) return [...save.party, ...save.box].some((m) => m.speciesId === c.hasSpecies);
  if ('all' in c) return c.all.every((x) => checkCondition(save, x));
  if ('any' in c) return c.any.some((x) => checkCondition(save, x));
  return false;
}
