export interface TrainerDef {
  id: string;
  name: string;
  /** 肩書き（「見習い灯守」など） */
  title: string;
  party: { speciesId: string; level: number }[];
  reward: number;
  intro: string;
  defeat: string;
  /** 負けても話が進む戦い（ライバル初戦など） */
  loseOk?: boolean;
  kind?: 'trainer' | 'boss';
  bgm?: 'battle' | 'boss';
  /** 技選びの賢さ 0〜1 */
  smart?: number;
}

const list: TrainerDef[] = [
  {
    id: 'rival1', name: 'カイト', title: 'ライバル', party: [{ speciesId: '__rival_starter', level: 4 }], reward: 300,
    intro: 'せっかくだし、オレと勝負しようぜ！ どっちの灯が明るいか、たしかめてやる！',
    defeat: 'ちぇっ、負けたか……。でも、次はぜったい負けないからな！', loseOk: true, smart: 0.5,
  },
  {
    id: 'yu', name: 'ユウ', title: '見習い灯守', party: [{ speciesId: 'piricchi', level: 3 }, { speciesId: 'kazamidori', level: 3 }], reward: 260,
    intro: '目が合ったら勝負！ それが灯守のルールだよ！', defeat: 'うわー、強いなあ！', smart: 0.5,
  },
  {
    id: 'mio', name: 'ミオ', title: '花屋', party: [{ speciesId: 'fuwamo', level: 6 }, { speciesId: 'mebukin', level: 7 }], reward: 340,
    intro: 'お花のように かわいい子たちの実力、見せてあげる！', defeat: 'あらあら、しおれちゃった。', smart: 0.6,
  },
  {
    id: 'gen', name: 'ゲン', title: '釣り人', party: [{ speciesId: 'shizukun', level: 7 }, { speciesId: 'koishimo', level: 7 }], reward: 380,
    intro: '釣りの合間に ひと勝負といこうか。', defeat: '大物を逃した気分だ……。', smart: 0.6,
  },
  {
    id: 'grunt1', name: 'したっぱ', title: '静夜団', party: [{ speciesId: 'yoiyami', level: 9 }, { speciesId: 'koishimo', level: 10 }], reward: 520,
    intro: '静夜団の じゃまを するな！ 灯なんて 消えてしまえば いいんだ！', defeat: 'くっ……ヨル様に 報告しなければ……。', smart: 0.7,
  },
  {
    id: 'grunt2', name: 'したっぱ', title: '静夜団', party: [{ speciesId: 'piricchi', level: 10 }, { speciesId: 'yoiyami', level: 11 }], reward: 560,
    intro: 'この灯籠柱には さわらせないよ！', defeat: 'ああ、灯がともってしまう……！', smart: 0.7,
  },
];

export const TRAINERS: Record<string, TrainerDef> = Object.fromEntries(list.map((t) => [t.id, t]));

/** ライバルは、主人公の相棒に強い相棒を選ぶ */
export function rivalStarterFor(playerStarter: string): string {
  return { hinokoro: 'shizukun', shizukun: 'mebukin', mebukin: 'hinokoro' }[playerStarter] ?? 'shizukun';
}
