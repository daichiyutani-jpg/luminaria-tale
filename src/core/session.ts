/**
 * 遊んでいる最中の状態（今のセーブデータと設定）。画面はここから読み書きする。
 * 自動セーブ：重要な場面の後と、アプリが裏に回った時に保存する。
 */
import { audio } from '../audio/audio';
import { updateQuests } from '../logic/game';
import { QUESTS } from '../data/quests';
import { loadSettings, saveGame, saveSettings } from '../save/saveManager';
import { SaveError } from '../save/validate';
import { toast } from '../ui/dialog';
import type { SaveData, Settings } from './types';

class Session {
  save: SaveData | null = null;
  settings!: Settings;
  private lastTick = 0;
  private timer: number | null = null;
  private saving = false;
  lastSaveError: string | null = null;

  async init(): Promise<void> {
    this.settings = await loadSettings();
    audio.setSettings(this.settings);
    // アプリが裏に回った・閉じられる時に保存
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void this.autosave('hidden');
    });
    window.addEventListener('pagehide', () => void this.autosave('pagehide'));
  }

  get data(): SaveData {
    if (!this.save) throw new Error('ゲームが開始されていません');
    return this.save;
  }

  start(save: SaveData): void {
    this.save = save;
    this.lastTick = performance.now();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = window.setInterval(() => this.tickPlayTime(), 5000);
    this.checkQuests(false);
  }

  stop(): void {
    this.tickPlayTime();
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    this.save = null;
  }

  private tickPlayTime(): void {
    if (!this.save) return;
    const now = performance.now();
    if (!document.hidden) this.save.playTimeSec += Math.floor((now - this.lastTick) / 1000);
    this.lastTick = now - ((now - this.lastTick) % 1000);
  }

  /** セーブする。失敗してもゲームは止めず、理由を返す */
  async saveNow(): Promise<{ ok: boolean; message?: string }> {
    if (!this.save) return { ok: false, message: 'ゲームが開始されていません。' };
    this.tickPlayTime();
    try {
      this.saving = true;
      await saveGame(this.save);
      this.lastSaveError = null;
      return { ok: true };
    } catch (e) {
      const msg = e instanceof SaveError ? e.message : `保存に失敗しました（${(e as Error).message}）`;
      this.lastSaveError = msg;
      return { ok: false, message: msg };
    } finally {
      this.saving = false;
    }
  }

  async autosave(_reason: string): Promise<void> {
    if (!this.save || this.saving) return;
    const r = await this.saveNow();
    if (!r.ok && r.message && !document.hidden) toast(`⚠ ${r.message}`, 4000);
  }

  async updateSettings(patch: Partial<Settings>): Promise<void> {
    this.settings = { ...this.settings, ...patch };
    audio.setSettings(this.settings);
    await saveSettings(this.settings);
  }

  /** クエストの進み具合を更新し、変化があれば知らせる */
  checkQuests(notify = true): void {
    if (!this.save) return;
    const notices = updateQuests(this.save);
    if (!notify) return;
    for (const n of notices) {
      const q = QUESTS[n.questId];
      if (n.kind === 'started') toast(`📜 クエスト「${q.name}」が はじまった`);
      else {
        audio.se('item');
        toast(`🎉 クエスト「${q.name}」達成！${n.rewardText ? ` ほうしゅう：${n.rewardText}` : ''}`, 3800);
      }
    }
  }
}

export const session = new Session();
