/**
 * フィールドの移動・当たり判定・経路探索・遭遇判定（画面とは独立）。
 */
import type { Facing, SaveData } from '../core/types';
import { checkCondition } from '../data/conditions';
import { isWalkableTile, tileAt, type EncounterEntry, type MapDef, type NpcDef, type ObjectDef } from '../data/maps';
import { randInt, type Rng } from './rng';

export interface Pos {
  x: number;
  y: number;
}

export const DIRS: Record<Facing, Pos> = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } };

export function visibleNpcs(map: MapDef, save: SaveData): NpcDef[] {
  return map.npcs.filter((n) => checkCondition(save, n.showIf));
}

export function barrierOpen(map: MapDef, save: SaveData): boolean {
  return !map.barrierFlag || !!save.flags[map.barrierFlag];
}

/** 調べられる物（隠しアイテムは取った後は消える） */
export function activeObjects(map: MapDef, save: SaveData): ObjectDef[] {
  return map.objects.filter((o) => !(o.kind === 'hidden' && save.openedChests.includes(`${map.id}:${o.id}`)));
}

export function npcAt(map: MapDef, save: SaveData, x: number, y: number): NpcDef | undefined {
  return visibleNpcs(map, save).find((n) => n.x === x && n.y === y);
}

export function objectAt(map: MapDef, save: SaveData, x: number, y: number): ObjectDef | undefined {
  return activeObjects(map, save).find((o) => o.x === x && o.y === y);
}

/** そのマスに立てるか */
export function canStand(map: MapDef, save: SaveData, x: number, y: number): boolean {
  if (!isWalkableTile(tileAt(map, x, y), barrierOpen(map, save))) return false;
  if (npcAt(map, save, x, y)) return false;
  const obj = objectAt(map, save, x, y);
  if (obj && obj.kind !== 'hidden') return false;
  return true;
}

export function facingTo(from: Pos, to: Pos): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'down' : 'up';
}

/**
 * タップした場所までの最短経路（4方向）。
 * 目的地に立てない（NPC・宝箱など）場合は、その隣までの経路を返し、interact に対象を入れる。
 */
export function findPath(map: MapDef, save: SaveData, from: Pos, to: Pos, maxNodes = 4000): { path: Pos[]; interact?: Pos } | null {
  const w = map.tiles[0].length;
  const h = map.tiles.length;
  if (to.x < 0 || to.y < 0 || to.x >= w || to.y >= h) return null;
  const goalStandable = canStand(map, save, to.x, to.y);
  const goals: Pos[] = goalStandable ? [to] : Object.values(DIRS).map((d) => ({ x: to.x + d.x, y: to.y + d.y }));
  const isGoal = (x: number, y: number) => goals.some((g) => g.x === x && g.y === y);
  const key = (x: number, y: number) => y * w + x;
  const prev = new Map<number, number>();
  prev.set(key(from.x, from.y), -1);
  const queue: Pos[] = [from];
  let found: Pos | null = isGoal(from.x, from.y) ? from : null;
  let visited = 0;
  while (queue.length && !found && visited++ < maxNodes) {
    const cur = queue.shift()!;
    for (const d of Object.values(DIRS)) {
      const nx = cur.x + d.x;
      const ny = cur.y + d.y;
      const k = key(nx, ny);
      if (prev.has(k) || !canStand(map, save, nx, ny)) continue;
      prev.set(k, key(cur.x, cur.y));
      if (isGoal(nx, ny)) {
        found = { x: nx, y: ny };
        break;
      }
      queue.push({ x: nx, y: ny });
    }
  }
  if (!found) return null;
  const path: Pos[] = [];
  let k = key(found.x, found.y);
  while (k !== key(from.x, from.y)) {
    path.unshift({ x: k % w, y: Math.floor(k / w) });
    k = prev.get(k)!;
  }
  return { path, interact: goalStandable ? undefined : to };
}

export function isGrass(map: MapDef, x: number, y: number): boolean {
  return tileAt(map, x, y) === '"';
}

/** 草むらで1歩進んだ時の遭遇判定 */
export function rollEncounter(map: MapDef, x: number, y: number, rng: Rng): { speciesId: string; level: number } | null {
  if (!map.encounters || !isGrass(map, x, y)) return null;
  if (rng.next() * 100 >= map.encounters.rate) return null;
  return pickEncounter(map.encounters.table, rng);
}

export function pickEncounter(table: EncounterEntry[], rng: Rng): { speciesId: string; level: number } {
  const total = table.reduce((a, e) => a + e.weight, 0);
  let r = rng.next() * total;
  for (const e of table) {
    r -= e.weight;
    if (r < 0) return { speciesId: e.speciesId, level: randInt(rng, e.minLevel, e.maxLevel) };
  }
  const e = table[table.length - 1];
  return { speciesId: e.speciesId, level: e.minLevel };
}

/**
 * トレーナーの視線に入ったか。向いている方向に sight マス以内で、間に障害物がなければ発見される。
 */
export function trainerSpotting(map: MapDef, save: SaveData, px: number, py: number): NpcDef | undefined {
  for (const npc of visibleNpcs(map, save)) {
    if (!npc.trainerId || save.defeatedTrainers.includes(npc.trainerId)) continue;
    const d = DIRS[npc.facing];
    for (let i = 1; i <= (npc.sight ?? 3); i++) {
      const x = npc.x + d.x * i;
      const y = npc.y + d.y * i;
      if (x === px && y === py) return npc;
      if (!canStand(map, save, x, y)) break;
    }
  }
  return undefined;
}

/** NPCが主人公の隣まで歩いてくる経路（視線上なので一直線） */
export function approachPath(npc: NpcDef, px: number, py: number): Pos[] {
  const d = DIRS[npc.facing];
  const out: Pos[] = [];
  let x = npc.x;
  let y = npc.y;
  while (Math.abs(px - (x + d.x)) + Math.abs(py - (y + d.y)) >= 1 && !(x + d.x === px && y + d.y === py)) {
    x += d.x;
    y += d.y;
    out.push({ x, y });
    if (out.length > 10) break;
  }
  return out;
}
