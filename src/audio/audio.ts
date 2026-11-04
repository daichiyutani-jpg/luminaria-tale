/**
 * 音の管理。BGMは1曲だけを鳴らし、切り替え時は前の曲を必ず止める（重複再生しない）。
 * スマホのブラウザは「画面をさわった後」でないと音を出せないので、最初のタップで unlock() する。
 */
import type { Settings } from '../core/types';
import { TRACKS, type Track, type Voice } from './music';

const NOTE_INDEX: Record<string, number> = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };

function noteFreq(name: string): number | null {
  const m = /^([A-G]#?)(\d)$/.exec(name);
  if (!m) return null;
  const midi = (Number(m[2]) + 1) * 12 + NOTE_INDEX[m[1]];
  return 440 * 2 ** ((midi - 69) / 12);
}

interface ParsedNote {
  note: string;
  beats: number;
}
const parseCache = new Map<string, ParsedNote[]>();
function parse(notes: string): ParsedNote[] {
  let p = parseCache.get(notes);
  if (!p) {
    p = notes
      .trim()
      .split(/\s+/)
      .map((t) => {
        const [note, b] = t.split(':');
        return { note, beats: Number(b) || 1 };
      });
    parseCache.set(notes, p);
  }
  return p;
}

interface VoiceState {
  voice: Voice;
  notes: ParsedNote[];
  index: number;
  nextTime: number;
}

class AudioManager {
  private ctx: AudioContext | null = null;
  private bgmGain: GainNode | null = null;
  private seGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private settings: Settings = { bgmVolume: 0.6, seVolume: 0.8, bgmOn: true, seOn: true, battleSpeed: 2, skipAnimations: false };
  private current: string | null = null;
  private wanted: string | null = null;
  private voices: VoiceState[] = [];
  private track: Track | null = null;
  private trackGain: GainNode | null = null;
  private timer: number | null = null;
  private playToken = 0;

  get unlocked(): boolean {
    return !!this.ctx && this.ctx.state === 'running';
  }
  get currentBgm(): string | null {
    return this.current;
  }

  /** 最初のタップで呼ぶ */
  unlock(): void {
    try {
      if (!this.ctx) {
        const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctx) return;
        this.ctx = new Ctx();
        this.bgmGain = this.ctx.createGain();
        this.seGain = this.ctx.createGain();
        this.bgmGain.connect(this.ctx.destination);
        this.seGain.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 0.3;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const data = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        this.applyVolumes();
        document.addEventListener('visibilitychange', () => {
          if (!this.ctx) return;
          if (document.hidden) void this.ctx.suspend();
          else void this.ctx.resume();
        });
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      if (this.wanted && this.current !== this.wanted) this.startBgm(this.wanted);
    } catch {
      // 音が出せない端末でもゲームは続ける
    }
  }

  setSettings(s: Settings): void {
    this.settings = { ...s };
    this.applyVolumes();
    if (!s.bgmOn) this.stopBgm(false);
    else if (this.wanted && this.current !== this.wanted) this.startBgm(this.wanted);
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.bgmGain || !this.seGain) return;
    const t = this.ctx.currentTime;
    this.bgmGain.gain.setTargetAtTime(this.settings.bgmOn ? this.settings.bgmVolume : 0, t, 0.05);
    this.seGain.gain.setTargetAtTime(this.settings.seOn ? this.settings.seVolume : 0, t, 0.02);
  }

  /** BGMを切り替える。同じ曲なら何もしない */
  playBgm(id: string): void {
    this.wanted = id;
    if (this.current === id) return;
    this.startBgm(id);
  }

  private startBgm(id: string): void {
    this.stopBgm(true);
    const track = TRACKS[id];
    if (!track || !this.ctx || !this.bgmGain || !this.settings.bgmOn || this.ctx.state !== 'running') {
      this.current = null;
      return;
    }
    this.current = id;
    this.track = track;
    const token = ++this.playToken;
    this.trackGain = this.ctx.createGain();
    this.trackGain.gain.value = 0;
    this.trackGain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.15);
    this.trackGain.connect(this.bgmGain);
    const start = this.ctx.currentTime + 0.08;
    this.voices = track.voices.map((voice) => ({ voice, notes: parse(voice.notes), index: 0, nextTime: start }));
    const tick = () => {
      if (token !== this.playToken) return;
      this.schedule();
    };
    tick();
    this.timer = window.setInterval(tick, 60);
  }

  stopBgm(fade = true): void {
    this.playToken++;
    if (this.timer !== null) window.clearInterval(this.timer);
    this.timer = null;
    if (this.trackGain && this.ctx) {
      const g = this.trackGain;
      const t = this.ctx.currentTime;
      g.gain.cancelScheduledValues(t);
      g.gain.setTargetAtTime(0, t, fade ? 0.12 : 0.01);
      window.setTimeout(() => g.disconnect(), 800);
    }
    this.trackGain = null;
    this.voices = [];
    this.current = null;
  }

  private schedule(): void {
    if (!this.ctx || !this.track || !this.trackGain) return;
    const ahead = this.ctx.currentTime + 0.25;
    const spb = 60 / this.track.bpm;
    let allDone = true;
    for (const v of this.voices) {
      while (v.nextTime < ahead) {
        if (v.index >= v.notes.length) {
          if (!this.track.loop) break;
          v.index = 0;
        }
        const n = v.notes[v.index++];
        const dur = n.beats * spb;
        if (n.note !== '-') this.playNote(v.voice, n.note, v.nextTime, dur);
        v.nextTime += dur;
      }
      if (v.index < v.notes.length || this.track.loop) allDone = false;
    }
    if (allDone) {
      // ループしない曲（ファンファーレ）が終わった
      const token = this.playToken;
      window.setTimeout(() => {
        if (token === this.playToken) this.stopBgm(false);
      }, 500);
    }
  }

  private playNote(voice: Voice, note: string, time: number, dur: number): void {
    const ctx = this.ctx!;
    if (voice.drum) {
      if (!this.noise) return;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      const filt = ctx.createBiquadFilter();
      filt.type = note === 'o' ? 'lowpass' : 'highpass';
      filt.frequency.value = note === 'o' ? 300 : 6000;
      const g = ctx.createGain();
      g.gain.setValueAtTime(voice.gain * (note === 'o' ? 3 : 1), time);
      g.gain.exponentialRampToValueAtTime(0.0001, time + (note === 'o' ? 0.12 : 0.05));
      src.connect(filt).connect(g).connect(this.trackGain!);
      src.start(time);
      src.stop(time + 0.15);
      return;
    }
    const f = noteFreq(note);
    if (!f) return;
    const osc = ctx.createOscillator();
    osc.type = voice.wave;
    osc.frequency.value = f;
    const g = ctx.createGain();
    const len = Math.max(0.05, dur * (voice.legato ?? 0.8));
    g.gain.setValueAtTime(0, time);
    g.gain.linearRampToValueAtTime(voice.gain, time + 0.012);
    g.gain.setTargetAtTime(voice.gain * 0.6, time + 0.03, 0.08);
    g.gain.setTargetAtTime(0, time + len, 0.04);
    osc.connect(g).connect(this.trackGain!);
    osc.start(time);
    osc.stop(time + len + 0.3);
  }

  /** 効果音 */
  se(id: SeId): void {
    if (!this.ctx || !this.seGain || !this.settings.seOn || this.ctx.state !== 'running') return;
    const t = this.ctx.currentTime;
    const tone = (freq: number, start: number, dur: number, wave: OscillatorType = 'square', vol = 0.25, slideTo?: number) => {
      const o = this.ctx!.createOscillator();
      o.type = wave;
      o.frequency.setValueAtTime(freq, t + start);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + start + dur);
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      o.connect(g).connect(this.seGain!);
      o.start(t + start);
      o.stop(t + start + dur + 0.02);
    };
    const noise = (start: number, dur: number, vol = 0.3, freq = 1200) => {
      if (!this.noise) return;
      const s = this.ctx!.createBufferSource();
      s.buffer = this.noise;
      const f = this.ctx!.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = freq;
      const g = this.ctx!.createGain();
      g.gain.setValueAtTime(vol, t + start);
      g.gain.exponentialRampToValueAtTime(0.0001, t + start + dur);
      s.connect(f).connect(g).connect(this.seGain!);
      s.start(t + start);
      s.stop(t + start + dur + 0.02);
    };
    switch (id) {
      case 'cursor':
        tone(880, 0, 0.04, 'square', 0.08);
        break;
      case 'ok':
        tone(988, 0, 0.05, 'square', 0.12);
        tone(1318, 0.05, 0.07, 'square', 0.12);
        break;
      case 'cancel':
        tone(660, 0, 0.05, 'square', 0.1);
        tone(440, 0.05, 0.07, 'square', 0.1);
        break;
      case 'encounter':
        [523, 659, 784, 1046, 784, 1046].forEach((f, i) => tone(f, i * 0.06, 0.08, 'square', 0.12));
        break;
      case 'hit':
        noise(0, 0.12, 0.45, 900);
        tone(200, 0, 0.12, 'square', 0.15, 80);
        break;
      case 'superhit':
        noise(0, 0.2, 0.6, 1400);
        tone(320, 0, 0.18, 'sawtooth', 0.18, 60);
        break;
      case 'weakhit':
        noise(0, 0.08, 0.25, 600);
        break;
      case 'move':
        tone(400, 0, 0.15, 'triangle', 0.15, 900);
        break;
      case 'status':
        tone(300, 0, 0.1, 'sawtooth', 0.1, 600);
        tone(600, 0.1, 0.1, 'sawtooth', 0.1, 300);
        tone(300, 0.2, 0.12, 'sawtooth', 0.1, 600);
        break;
      case 'statup':
        [400, 500, 600, 800].forEach((f, i) => tone(f, i * 0.05, 0.06, 'triangle', 0.15));
        break;
      case 'statdown':
        [800, 600, 500, 400].forEach((f, i) => tone(f, i * 0.05, 0.06, 'triangle', 0.15));
        break;
      case 'faint':
        tone(500, 0, 0.5, 'triangle', 0.2, 80);
        break;
      case 'throw':
        tone(300, 0, 0.25, 'sine', 0.2, 1200);
        break;
      case 'shake':
        tone(220, 0, 0.08, 'square', 0.12);
        tone(180, 0.08, 0.08, 'square', 0.12);
        break;
      case 'catch':
        [784, 988, 1175, 1568].forEach((f, i) => tone(f, i * 0.09, 0.14, 'square', 0.13));
        break;
      case 'catchfail':
        tone(600, 0, 0.15, 'square', 0.12, 300);
        noise(0.05, 0.2, 0.3, 2000);
        break;
      case 'levelup':
        [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, i * 0.07, 0.12, 'square', 0.12));
        break;
      case 'evolve':
        [392, 523, 659, 784, 1046, 1318, 1568].forEach((f, i) => tone(f, i * 0.1, 0.2, 'triangle', 0.18));
        break;
      case 'item':
        tone(1046, 0, 0.08, 'sine', 0.2);
        tone(1318, 0.08, 0.08, 'sine', 0.2);
        tone(1568, 0.16, 0.16, 'sine', 0.2);
        break;
      case 'heal':
        [523, 659, 784, 659, 784, 1046].forEach((f, i) => tone(f, i * 0.1, 0.16, 'sine', 0.2));
        break;
      case 'trade':
        [659, 784, 988, 1318].forEach((f, i) => tone(f, i * 0.12, 0.2, 'triangle', 0.18));
        break;
      case 'win':
        [784, 784, 784, 1046].forEach((f, i) => tone(f, i * 0.12, i === 3 ? 0.4 : 0.1, 'square', 0.12));
        break;
      case 'lose':
        [392, 370, 349, 330].forEach((f, i) => tone(f, i * 0.2, 0.25, 'triangle', 0.2));
        break;
      case 'bump':
        tone(120, 0, 0.06, 'square', 0.08);
        break;
      case 'door':
        noise(0, 0.15, 0.2, 500);
        break;
      case 'spotted':
        tone(1318, 0, 0.08, 'square', 0.15);
        tone(1318, 0.12, 0.12, 'square', 0.15);
        break;
      case 'lantern':
        [659, 880, 1175].forEach((f, i) => tone(f, i * 0.1, 0.3, 'sine', 0.2));
        break;
    }
  }
}

export type SeId =
  | 'cursor' | 'ok' | 'cancel' | 'encounter' | 'hit' | 'superhit' | 'weakhit' | 'move' | 'status' | 'statup' | 'statdown' | 'faint'
  | 'throw' | 'shake' | 'catch' | 'catchfail' | 'levelup' | 'evolve' | 'item' | 'heal' | 'trade' | 'win' | 'lose' | 'bump' | 'door' | 'spotted' | 'lantern';

export const audio = new AudioManager();
