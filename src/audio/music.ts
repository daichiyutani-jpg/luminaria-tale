/**
 * 【仮音源】BGMの譜面（このゲームのために書いたオリジナルの短いループ）。
 * WebAudio のシンセで鳴らすので、音声ファイルは不要（オフラインでもそのまま鳴る）。
 * 書式: "音名オクターブ:拍" をスペース区切り。"-" は休符。例 "C5:1 E5:0.5 -:0.5"
 */
export type Wave = 'sine' | 'square' | 'triangle' | 'sawtooth';

export interface Voice {
  wave: Wave;
  gain: number;
  notes: string;
  /** 音の切れ方 0〜1（1でレガート） */
  legato?: number;
  /** ドラム（ノイズ） */
  drum?: boolean;
}

export interface Track {
  bpm: number;
  loop: boolean;
  voices: Voice[];
}

const rep = (s: string, n: number) => Array(n).fill(s).join(' ');

export const TRACKS: Record<string, Track> = {
  title: {
    bpm: 84,
    loop: true,
    voices: [
      { wave: 'triangle', gain: 0.22, legato: 0.95, notes: 'E5:1 G5:1 A5:2 G5:1 E5:1 D5:2 C5:1 D5:1 E5:1 G5:1 E5:4 A5:1 C6:1 B5:2 A5:1 G5:1 E5:2 D5:1 E5:1 G5:1 D5:1 C5:4' },
      { wave: 'sine', gain: 0.16, legato: 1, notes: 'C3:4 A2:4 F2:4 G2:4 C3:4 E3:4 F3:4 G2:2 C3:2' },
      { wave: 'sine', gain: 0.07, legato: 0.5, notes: rep('C4:0.5 G4:0.5 E5:0.5 G4:0.5', 2) + ' ' + rep('A3:0.5 E4:0.5 C5:0.5 E4:0.5', 2) + ' ' + rep('F3:0.5 C4:0.5 A4:0.5 C4:0.5', 2) + ' ' + rep('G3:0.5 D4:0.5 B4:0.5 D4:0.5', 2) + ' ' + rep('C4:0.5 G4:0.5 E5:0.5 G4:0.5', 2) + ' ' + rep('E3:0.5 B3:0.5 G4:0.5 B3:0.5', 2) + ' ' + rep('F3:0.5 C4:0.5 A4:0.5 C4:0.5', 2) + ' ' + rep('G3:0.5 D4:0.5 B4:0.5 D4:0.5', 2) },
    ],
  },
  town: {
    bpm: 108,
    loop: true,
    voices: [
      { wave: 'square', gain: 0.07, legato: 0.7, notes: 'F5:1 A5:0.5 C6:0.5 A5:1 G5:1 F5:1 D5:1 C5:2 D5:1 F5:0.5 G5:0.5 A5:1 C6:1 A#5:1 A5:1 G5:2 F5:1 A5:0.5 C6:0.5 D6:1 C6:1 A#5:1 A5:1 G5:2 A5:1 G5:0.5 F5:0.5 E5:1 G5:1 F5:4' },
      { wave: 'triangle', gain: 0.2, legato: 0.6, notes: 'F3:1 C4:1 F3:1 C4:1 A#2:1 F3:1 A#2:1 F3:1 F3:1 C4:1 F3:1 C4:1 C3:1 G3:1 C3:1 G3:1 D3:1 A3:1 D3:1 A3:1 A#2:1 F3:1 A#2:1 F3:1 C3:1 G3:1 C3:1 G3:1 F3:2 C3:2' },
      { wave: 'square', gain: 0.03, drum: true, notes: rep('x:1 -:0.5 x:0.5', 16) },
    ],
  },
  indoor: {
    bpm: 92,
    loop: true,
    voices: [
      { wave: 'triangle', gain: 0.2, legato: 0.8, notes: 'G4:1 B4:1 D5:1 B4:1 C5:1 E5:1 D5:2 B4:1 G4:1 A4:1 B4:1 A4:4 G4:1 B4:1 D5:1 G5:1 E5:1 C5:1 D5:2 C5:1 B4:1 A4:1 F#4:1 G4:4' },
      { wave: 'sine', gain: 0.16, legato: 1, notes: 'G2:4 C3:4 G2:4 D3:4 E3:4 C3:4 D3:4 G2:4' },
    ],
  },
  field: {
    bpm: 132,
    loop: true,
    voices: [
      { wave: 'square', gain: 0.075, legato: 0.75, notes: 'G4:0.5 B4:0.5 D5:1 D5:0.5 E5:0.5 D5:1 B4:0.5 G4:0.5 A4:1 B4:1 C5:2 E5:0.5 D5:0.5 C5:1 B4:0.5 A4:0.5 G4:1 A4:0.5 B4:0.5 A4:1 D4:2 G4:0.5 B4:0.5 D5:1 G5:1 F#5:0.5 E5:0.5 D5:1 E5:0.5 C5:0.5 A4:1 B4:1 C5:1 D5:1 B4:0.5 G4:0.5 A4:1 F#4:1 G4:3' },
      { wave: 'triangle', gain: 0.2, legato: 0.5, notes: 'G2:1 D3:1 G2:1 D3:1 C3:1 G3:1 C3:1 G3:1 A2:1 E3:1 A2:1 E3:1 D3:1 A3:1 D3:1 F#3:1 G2:1 D3:1 G2:1 D3:1 E3:1 B3:1 C3:1 G3:1 A2:1 E3:1 D3:1 F#3:1 G2:2 D3:2' },
      { wave: 'square', gain: 0.035, drum: true, notes: rep('x:0.5 -:0.5 o:0.5 -:0.5', 16) },
    ],
  },
  forest: {
    bpm: 96,
    loop: true,
    voices: [
      { wave: 'triangle', gain: 0.2, legato: 0.9, notes: 'A4:1.5 C5:0.5 E5:1 D5:1 C5:1.5 B4:0.5 G4:2 A4:1.5 E4:0.5 G4:1 F#4:1 E4:4 C5:1.5 D5:0.5 E5:1 G5:1 F#5:1.5 E5:0.5 D5:2 C5:1 B4:1 A4:1 G4:1 A4:4' },
      { wave: 'sine', gain: 0.18, legato: 1, notes: 'A2:4 G2:4 F2:4 E2:4 A2:4 D3:4 F2:4 E2:2 A2:2' },
      { wave: 'sine', gain: 0.05, legato: 0.3, notes: rep('E6:0.5 -:1 B5:0.5 -:2', 8) },
    ],
  },
  battle: {
    bpm: 164,
    loop: true,
    voices: [
      { wave: 'square', gain: 0.075, legato: 0.6, notes: 'E5:0.5 E5:0.5 G5:0.5 E5:0.5 A5:1 G5:0.5 F#5:0.5 E5:0.5 D5:0.5 E5:0.5 B4:0.5 E5:2 E5:0.5 G5:0.5 B5:1 A5:0.5 G5:0.5 F#5:1 G5:0.5 A5:0.5 B5:0.5 A5:0.5 G5:0.5 F#5:0.5 E5:2 C6:1 B5:0.5 A5:0.5 G5:1 A5:0.5 B5:0.5 E5:1 F#5:1 G5:1 A5:1 B5:1.5 A5:0.5 G5:1 F#5:1 E5:4' },
      { wave: 'sawtooth', gain: 0.07, legato: 0.45, notes: rep('E2:0.5 E3:0.5', 8) + ' ' + rep('C2:0.5 C3:0.5', 4) + ' ' + rep('D2:0.5 D3:0.5', 4) + ' ' + rep('E2:0.5 E3:0.5', 4) + ' ' + rep('A1:0.5 A2:0.5', 4) + ' ' + rep('C2:0.5 C3:0.5', 4) + ' ' + rep('B1:0.5 B2:0.5', 4) },
      { wave: 'square', gain: 0.045, drum: true, notes: rep('x:0.5 o:0.5 x:0.25 x:0.25 o:0.5', 16) },
    ],
  },
  boss: {
    bpm: 150,
    loop: true,
    voices: [
      { wave: 'sawtooth', gain: 0.06, legato: 0.7, notes: 'D5:1 F5:0.5 E5:0.5 D5:1 A4:1 A#4:1 A4:0.5 G4:0.5 A4:2 D5:1 F5:0.5 G5:0.5 A5:1 C6:1 A#5:1 A5:0.5 G5:0.5 A5:2 F5:1 G5:0.5 A5:0.5 A#5:1 A5:1 G5:1 F5:0.5 E5:0.5 F5:2 E5:1 F5:0.5 E5:0.5 D5:1 C#5:1 D5:4' },
      { wave: 'square', gain: 0.07, legato: 0.4, notes: rep('D2:0.5 D2:0.5 D3:0.5 D2:0.5', 4) + ' ' + rep('A#1:0.5 A#1:0.5 A#2:0.5 A#1:0.5', 2) + ' ' + rep('A1:0.5 A1:0.5 A2:0.5 A1:0.5', 2) + ' ' + rep('G1:0.5 G1:0.5 G2:0.5 G1:0.5', 2) + ' ' + rep('A1:0.5 A1:0.5 A2:0.5 A1:0.5', 2) },
      { wave: 'square', gain: 0.05, drum: true, notes: rep('x:0.5 x:0.5 o:0.5 x:0.5', 16) },
    ],
  },
  evolution: {
    bpm: 100,
    loop: true,
    voices: [
      { wave: 'triangle', gain: 0.22, legato: 0.6, notes: rep('C5:0.5 E5:0.5 G5:0.5 C6:0.5 G5:0.5 E5:0.5', 2) + ' ' + rep('D5:0.5 F5:0.5 A5:0.5 D6:0.5 A5:0.5 F5:0.5', 2) },
      { wave: 'sine', gain: 0.15, legato: 1, notes: 'C3:6 D3:6' },
    ],
  },
  victory: {
    bpm: 140,
    loop: false,
    voices: [
      { wave: 'square', gain: 0.08, legato: 0.8, notes: 'G4:0.5 C5:0.5 E5:0.5 G5:1.5 E5:0.5 G5:3' },
      { wave: 'triangle', gain: 0.2, legato: 0.8, notes: 'C3:0.5 E3:0.5 G3:0.5 C4:1.5 G3:0.5 C3:3' },
    ],
  },
  ending: {
    bpm: 72,
    loop: true,
    voices: [
      { wave: 'triangle', gain: 0.22, legato: 0.95, notes: 'C5:2 E5:1 G5:1 F5:2 E5:1 D5:1 E5:2 C5:1 A4:1 G4:4 A4:2 C5:1 F5:1 E5:2 D5:1 C5:1 D5:2 G4:1 B4:1 C5:4' },
      { wave: 'sine', gain: 0.16, legato: 1, notes: 'C3:4 F3:4 C3:4 G2:4 F2:4 C3:4 G2:4 C3:4' },
    ],
  },
};

/** BGM一覧（設計上の13場面との対応）。まだ譜面が無い場面は近い曲で代用している */
export const BGM_PLAN: { scene: string; track: string; status: '実装' | '代用' }[] = [
  { scene: 'タイトル画面', track: 'title', status: '実装' },
  { scene: '通常の町', track: 'town', status: '実装' },
  { scene: '重要な町', track: 'town', status: '代用' },
  { scene: 'フィールド', track: 'field', status: '実装' },
  { scene: '森林', track: 'forest', status: '実装' },
  { scene: '洞窟', track: 'forest', status: '代用' },
  { scene: '通常戦闘', track: 'battle', status: '実装' },
  { scene: 'ボス戦', track: 'boss', status: '実装' },
  { scene: '伝説級の灯獣との戦闘', track: 'boss', status: '代用' },
  { scene: '進化', track: 'evolution', status: '実装' },
  { scene: '重要イベント', track: 'indoor', status: '代用' },
  { scene: 'エンディング', track: 'ending', status: '実装' },
  { scene: 'クリア後の高難易度', track: 'boss', status: '代用' },
];
