/**
 * 戦闘画面の配置。灯獣の絵（Phaser）と HP 表示（DOM）が重ならないよう、両方がこの計算を使う。
 *
 *  ┌──────────────────────────┐
 *  │[敵のHP]        [速さ]    │
 *  │              ◆敵の灯獣   │  ← 敵：右上（HP は左上）
 *  │  ◆味方の灯獣             │
 *  │             [味方のHP]   │  ← 味方：左下（HP は右下）
 *  ├──────────────────────────┤
 *  │ メッセージ・コマンド     │  ← 下の箱（高さ固定）
 *  └──────────────────────────┘
 * 単位はすべて CSS ピクセル。
 */
export interface BattleLayout {
  /** 下の箱の高さ */
  boxH: number;
  /** 戦う場所（箱より上）の高さ */
  arenaH: number;
  /** 灯獣の足元の位置と、絵の一辺の大きさ */
  enemy: { x: number; y: number; size: number };
  player: { x: number; y: number; size: number };
  /** HP 表示の幅（画面幅に対する割合） */
  enemyPanelW: number;
  playerPanelW: number;
}

/** 絵（正方形）の中で、灯獣の体が入っている範囲：左右 3%〜97%、上 6%〜足元 90% */
const FEET = 0.9;
const TOP = 0.06;

export function battleLayout(W: number, H: number): BattleLayout {
  const boxH = Math.round(Math.min(Math.max(196, H * 0.42), H * 0.6));
  const arenaH = H - boxH;
  const enemyPanelW = 0.54;
  const playerPanelW = 0.5;
  // 敵：HP表示の右側（画面の 57%〜97%）に収める。上端は速さボタン（下端およそ 50px）より下
  const eFeet = arenaH * 0.5;
  const eSize = Math.max(40, Math.min(W * 0.4, (eFeet - 60) / (FEET - TOP)));
  const enemy = { x: W * 0.77, y: eFeet, size: eSize };
  // 味方：HP表示の左側（画面の 3%〜47%）に収める。足元は箱の少し上
  const pFeet = arenaH - 16;
  const pSize = Math.max(40, Math.min(W * 0.44, (pFeet - eFeet + 10) / (FEET - TOP)));
  const player = { x: W * 0.25, y: pFeet, size: pSize };
  return { boxH, arenaH, enemy, player, enemyPanelW, playerPanelW };
}
