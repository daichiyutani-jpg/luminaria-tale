# ルミナリア・テイル ～灯獣の島～（試作版 0.1.0）

スマホ縦画面で遊ぶ、オリジナルのモンスター育成RPG（PWA）です。
「灯獣（ともしびけもの）」を捕まえ、育て、進化させながら、群島ルミナリアを旅します。

- 技術：TypeScript + Phaser 4 + Vite（Unity は使っていません）
- ひとりで遊ぶ部分は **完全オフライン**（サーバーと一切通信しません）
- 通信対戦・交換は **設計のみ・未実装**（[docs/ONLINE_DESIGN.md](docs/ONLINE_DESIGN.md)）
- 絵・BGM・効果音は **すべて仮素材**（プログラムで描画・演奏。[docs/ASSETS.md](docs/ASSETS.md)）

## 起動のしかた（Windows）

PowerShell では `npm` が動かないことがあるので `npm.cmd` を使うか、コマンドプロンプトで実行してください。

```bat
cd monster-rpg
npm.cmd install
npm.cmd run dev
```

ブラウザで http://localhost:5173 を開きます（開発サーバーではオフライン機能は無効です）。

### 公開版と同じ状態で確かめる

```bat
npm.cmd run build
npm.cmd run preview
```

`dist/` が公開用のファイル一式です。どのフォルダに置いても動きます（相対パス）。
GitHub Pages などの静的ホスティングにそのまま置けます（`.nojekyll` 同梱）。

## スマホで確かめる

1. `dist/` を HTTPS のサーバーに置く（GitHub Pages など。Service Worker は HTTPS か localhost でしか動きません）
2. スマホのブラウザで開き、しばらく待つ（設定画面の「オフラインで あそぶ」に「✔ オフラインで 遊べます」と出れば準備完了）
3. iPhone：Safari の共有ボタン →「ホーム画面に追加」／Android：Chrome のメニュー →「アプリをインストール」
4. 機内モードにしてホーム画面のアイコンから起動 → 遊べることを確認

※ 同じ Wi-Fi のスマホから見るだけなら、`npm.cmd run dev` の画面に出る `Network: http://192.168.x.x:5173/` を開けば表示できます（操作感の確認用）。HTTP のためオフライン機能とホーム画面への追加は確認できません。

## テスト

```bat
npm.cmd test            ← ロジックの自動テスト（vitest・47件）
npm.cmd run typecheck   ← 型チェック
npm.cmd run build
npm.cmd run test:e2e    ← 本番ビルドをブラウザ（Edge/Chrome）で動かす総合テスト
```

- `tests/logic.test.ts`：データの整合性、相性、経験値、進化と分岐進化、戦闘、捕獲確率、なかま管理、ショップ、クエスト
- `tests/field_save.test.ts`：全マップの到達可能性、通行止め、出会い、トレーナーの視線、セーブ／ロード、バックアップ復元、書き出し／読み込み、改ざん検出
- `tests/balance.test.ts`：難易度のシミュレーション（最初のトレーナー・ライバル・森の主の勝率）
- `scripts/e2e.mjs`：サブディレクトリ配信 → キャッシュ完了確認 → サーバー停止＋オフライン化 → はじめから・相棒選び・ライバル戦・草原・捕獲・図鑑・セーブ・つづきから → 外部通信ゼロを確認。画面写真は `test-results/`

## フォルダ構成

| 場所 | 中身 |
| --- | --- |
| `src/data/` | **コンテンツデータ**（灯獣・技・道具・相性・マップ・トレーナー・クエスト・お店・会話台本）。ゲームの仕組みと分けてある |
| `src/logic/` | 画面に依存しない純粋なロジック（戦闘・捕獲・経験値・進化・なかま管理・歩行）。テスト対象 |
| `src/save/` | セーブ（IndexedDB・版の移行・検証・修復・書き出し） |
| `src/scenes/` | Phaser のシーン（起動・タイトル・フィールド・戦闘の見た目） |
| `src/ui/` | 文字・メニュー・会話・戦闘コマンドなどの DOM の画面 |
| `src/audio/` | 音（WebAudio で合成する仮BGM・効果音） |
| `src/art/` | 仮イラスト（灯獣の SVG、タイル・人物の Canvas 描画） |
| `src/core/` | 全体の進行（App）とセーブ中のデータ（session） |
| `sw/sw-template.js` | Service Worker（ビルド時に版とファイル一覧を埋め込む） |
| `scripts/` | e2e テスト、アイコン生成 |
| `docs/` | 設計書（世界観・仕組み、通信設計、素材） |

## コンテンツの足し方

- 灯獣：`src/data/species.ts` に追加し、`src/art/monsterArt.ts` に同じ `art` ID の絵を足す
- 技：`src/data/moves.ts`／道具：`src/data/items.ts`
- マップ：`src/data/maps.ts`（文字でタイルを書く。全マップの到達可能性はテストで確認される）
- 会話・イベント：`src/data/scripts.ts`（「話す→フラグ→戦闘→ごほうび」を命令の並びで書く）

追加後は `npm.cmd test` でデータの整合性（存在しない技・道具・進化先などがないか）を確認してください。

## 注意

- セーブはブラウザの中（IndexedDB）にだけあります。ブラウザの「履歴とデータの削除」やホーム画面アイコンの削除で消えることがあります。設定画面の「レポート」から書き出して保管できます。
- `window.__game` はテスト用の入口です（ひとり用のデータしか触れません。通信機能を作る際は、サーバー側で検証するので影響しません）。
