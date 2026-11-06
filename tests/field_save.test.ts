import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAPS } from '../src/data/maps';
import { canStand, findPath, rollEncounter, trainerSpotting } from '../src/logic/field';
import { giveNewMonster, newGame } from '../src/logic/game';
import { fixedRng, seededRng } from '../src/logic/rng';
import { _resetDbForTest, deleteSlot, exportSave, listSlots, loadGame, parseImport, saveGame } from '../src/save/saveManager';
import { makeTransferCode, readTransferCode } from '../src/save/transferCode';
import { checkMonsterStrict, SaveError, validateSave } from '../src/save/validate';

function allFlags() {
  const s = newGame(1, 'テスト');
  for (const f of ['got_starter', 'rival1_done', 'mist_cleared', 'nono_asked', 'boss1_down', 'all_badges']) s.flags[f] = true;
  return s;
}

describe('フィールド', () => {
  it('すべてのマップで、ワープ・NPC・調べる物に歩いてたどり着ける', () => {
    const save = allFlags();
    for (const m of Object.values(MAPS)) {
      const start = m.warps[0];
      const from = { x: start.x, y: start.y };
      for (const wp of m.warps) expect(findPath(m, save, from, wp), `${m.id}: ワープ (${wp.x},${wp.y})`).not.toBeNull();
      for (const n of m.npcs) expect(findPath(m, save, from, n), `${m.id}: ${n.id}`).not.toBeNull();
      for (const o of m.objects) expect(findPath(m, save, from, o), `${m.id}: ${o.id}`).not.toBeNull();
    }
  });
  it('相棒をもらう前は村から草原へ出られない（見張りがふさぐ）', () => {
    const save = newGame(1, 'テスト');
    const v = MAPS.village;
    expect(findPath(v, save, { x: 8, y: 7 }, { x: 8, y: 0 })).toBeNull();
    expect(findPath(v, save, { x: 8, y: 7 }, { x: 9, y: 0 })).toBeNull();
    expect(canStand(v, save, 9, 1)).toBe(false);
    expect(canStand(v, save, 8, 1)).toBe(false);
    save.flags.got_starter = true;
    expect(findPath(v, save, { x: 8, y: 7 }, { x: 8, y: 0 })).not.toBeNull();
  });
  it('黒霞の壁はフラグで消える', () => {
    const save = allFlags();
    save.flags.mist_cleared = false;
    const f = MAPS.firefly_forest;
    expect(canStand(f, save, 9, 5)).toBe(false);
    expect(findPath(f, save, { x: 9, y: 26 }, { x: 9, y: 3 })).toBeNull();
    save.flags.mist_cleared = true;
    expect(findPath(f, save, { x: 9, y: 26 }, { x: 9, y: 3 })).not.toBeNull();
  });
  it('草むらでだけ野生の灯獣に出会う', () => {
    const g = MAPS.grassland;
    expect(rollEncounter(g, 9, 20, fixedRng([0]))).toBeNull(); // 道
    const e = rollEncounter(g, 2, 20, fixedRng([0, 0.1, 0.5]));
    expect(e).not.toBeNull();
    expect(e!.level).toBeGreaterThanOrEqual(3);
  });
  it('トレーナーの視線に入ると見つかる', () => {
    const save = allFlags();
    const g = MAPS.grassland;
    expect(trainerSpotting(g, save, 8, 22)?.trainerId).toBe('yu');
    expect(trainerSpotting(g, save, 8, 23)).toBeUndefined();
    save.defeatedTrainers.push('yu');
    expect(trainerSpotting(g, save, 8, 22)).toBeUndefined();
  });
});

describe('セーブとロード', () => {
  beforeEach(async () => {
    await _resetDbForTest();
    indexedDB.deleteDatabase('luminaria-tale');
  });

  it('新規ゲームを保存し、読み込める', async () => {
    const s = newGame(1, 'アカリ');
    giveNewMonster(s, 'hinokoro', 5, seededRng(1), 'ひだまり村');
    s.items.potion = 3;
    s.flags.got_starter = true;
    await saveGame(s);
    await _resetDbForTest(); // 再起動を想定
    const r = await loadGame(1);
    expect(r?.fromBackup).toBe(false);
    expect(r?.data.playerName).toBe('アカリ');
    expect(r?.data.party[0].speciesId).toBe('hinokoro');
    expect(r?.data.items.potion).toBe(3);
    expect(r?.data.dex.hinokoro).toBe('caught');
  });

  it('本体が壊れていたらバックアップから復元する', async () => {
    const s = newGame(2, 'アカリ');
    s.money = 111;
    await saveGame(s);
    s.money = 222;
    await saveGame(s);
    // 本体を壊す
    const db = await new Promise<IDBDatabase>((res) => {
      const r = indexedDB.open('luminaria-tale', 1);
      r.onsuccess = () => res(r.result);
    });
    await new Promise<void>((res) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ checksum: 'xxxx', json: '{"broken":' }, 'slot:2');
      tx.oncomplete = () => res();
    });
    db.close();
    const r = await loadGame(2);
    expect(r?.fromBackup).toBe(true);
    expect(r?.data.money).toBe(111);
  });

  it('スロット一覧と削除', async () => {
    await saveGame(newGame(3, 'ミナ'));
    const list = await listSlots();
    expect(list.find((x) => x.slot === 3)?.playerName).toBe('ミナ');
    expect(list.find((x) => x.slot === 1)?.exists).toBe(false);
    await deleteSlot(3);
    expect(await loadGame(3)).toBeNull();
  });

  it('連続でセーブしても最後の内容が残る', async () => {
    const s = newGame(1, 'アカリ');
    const jobs: Promise<void>[] = [];
    for (let i = 0; i < 10; i++) {
      s.money = i;
      jobs.push(saveGame(structuredClone(s)));
    }
    await Promise.all(jobs);
    expect((await loadGame(1))?.data.money).toBe(9);
  });

  it('エクスポートしたデータをインポートできる', () => {
    const s = newGame(1, 'アカリ');
    giveNewMonster(s, 'fuwamo', 6, seededRng(3), 'そよかぜ草原');
    const text = exportSave(s);
    const back = parseImport(text, 2);
    expect(back.slot).toBe(2);
    expect(back.party[0].speciesId).toBe('fuwamo');
  });

  it('引き継ぎコード（圧縮した文字）で 別のスロットへ 移せる・改行がまざっても読める・壊れたコードは拒否する', async () => {
    const s = newGame(1, 'アカリ');
    for (let i = 0; i < 40; i++) giveNewMonster(s, 'fuwamo', 6 + (i % 5), seededRng(i), 'そよかぜ草原');
    const code = await makeTransferCode(s);
    expect(code.startsWith('LUMI1-')).toBe(true);
    expect(code).toMatch(/^LUMI1-[A-Za-z0-9_-]+$/);
    // 圧縮で 書き出しファイルより ずっと短い
    expect(code.length).toBeLessThan(exportSave(s).length / 2);
    const back = await readTransferCode(code, 3);
    expect(back.slot).toBe(3);
    expect(back.party.length + back.box.length).toBe(40);
    const wrapped = code.replace(/(.{60})/g, '$1\n ');
    expect((await readTransferCode(`  ${wrapped}  `, 2)).playerName).toBe('アカリ');
    // 書き出したファイルの中身も そのまま 貼り付けられる
    expect((await readTransferCode(exportSave(s), 1)).playerName).toBe('アカリ');
    await expect(readTransferCode(code.slice(0, code.length - 30), 1)).rejects.toThrow(SaveError);
    await expect(readTransferCode('こんにちは', 1)).rejects.toThrow(/引き継ぎコード/);
  });

  it('書きかえられたファイルや不正な灯獣は拒否する', () => {
    const s = newGame(1, 'アカリ');
    giveNewMonster(s, 'fuwamo', 6, seededRng(3), 'そよかぜ草原');
    const text = exportSave(s);
    const tampered = text.replace('"level\\":6', '"level\\":60');
    expect(() => parseImport(tampered, 1)).toThrow(SaveError);
    // チェックサムまで合わせた改ざん（レベル60・経験値はそのまま）も中身の検査で拒否
    const evil = structuredClone(s);
    evil.party[0].level = 60;
    expect(() => parseImport(exportSave(evil), 1)).toThrow(/ふせい/);
    expect(() => parseImport('not json', 1)).toThrow(SaveError);
  });

  it('不正なモンスターを検出する', () => {
    const s = newGame(1, 'アカリ');
    const m = giveNewMonster(s, 'piricchi', 10, seededRng(3), 'x');
    expect(checkMonsterStrict(m).ok).toBe(true);
    expect(checkMonsterStrict({ ...m, ivs: { ...m.ivs, atk: 99 } }).ok).toBe(false);
    expect(checkMonsterStrict({ ...m, moves: [{ id: 'storm_bolt', pp: 10 }] }).ok).toBe(false); // まだ覚えない技
    expect(checkMonsterStrict({ ...m, speciesId: 'hotarunoou', history: ['hotarunoou'] }).ok).toBe(false);
    expect(checkMonsterStrict({ ...m, hp: 9999 }).ok).toBe(false);
    expect(checkMonsterStrict({ ...m, history: ['fuwamo', 'piricchi'] }).ok).toBe(false);
  });

  it('壊れた値は読み込み時に修復される', () => {
    const s = newGame(1, 'アカリ') as unknown as Record<string, unknown>;
    s.money = -50;
    s.location = { mapId: 'nowhere', x: 0, y: 0, facing: 'up' };
    const fixed = validateSave(s);
    expect(fixed.money).toBe(0);
    expect(fixed.location.mapId).toBe('village');
  });

  it('新しい版のセーブは読み込みを拒否する', () => {
    const s = newGame(1, 'アカリ') as unknown as Record<string, unknown>;
    s.version = 999;
    expect(() => validateSave(s)).toThrow(/新しい版/);
  });
});
