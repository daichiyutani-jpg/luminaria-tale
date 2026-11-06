/**
 * データ引き継ぎ画面（タイトル画面・レポート画面から開く）。
 * Safari／LINE のブラウザ／ホーム画面に追加したアプリの あいだで、引き継ぎコード（文字）か ファイルで セーブを移す。
 */
import { audio } from '../audio/audio';
import { getMap } from '../data/maps';
import { listSlots, loadGame, saveGame, type SlotSummary } from '../save/saveManager';
import { makeTransferCode, readTransferCode } from '../save/transferCode';
import { SaveError } from '../save/validate';
import { alertBox, choose, confirm, toast } from './dialog';
import { formatTime, h } from './dom';
import { openScreen } from './screens';

function slotOption(s: SlotSummary) {
  if (!s.exists) return { label: `スロット${s.slot}：（からっぽ）`, sub: '', value: s.slot };
  if (s.broken) return { label: `スロット${s.slot}：⚠ 読み込めないデータ`, sub: '', value: s.slot };
  return { label: `スロット${s.slot}：${s.playerName}`, sub: `${getMap(s.location!).name}　図鑑 ${s.dexCaught}種　プレイ ${formatTime(s.playTimeSec ?? 0)}`, value: s.slot };
}

async function copyText(text: string, area: HTMLTextAreaElement): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    area.focus();
    area.select();
    area.setSelectionRange(0, text.length);
    try {
      return document.execCommand('copy');
    } catch {
      return false;
    }
  }
}

/**
 * @param opts.onlySlot 遊んでいる最中に開いた時は そのスロットを送るだけ（先に保存しておくこと）
 * @returns 受けとってデータを書きかえた時 true（呼び出し側でタイトルへ戻す）
 */
export async function openTransfer(opts: { onlySlot?: number } = {}): Promise<boolean> {
  const s = openScreen('データ引き継ぎ');
  let received = false;

  const out = h('div');
  const sendCard = h(
    'div',
    { class: 'card' },
    h('h3', null, '① 今までの 端末・ブラウザで「送る」'),
    h('p', { class: 'note' }, '引き継ぎコード（長い文字）を 作って コピーします。LINE の 自分だけのトーク などに 貼って とっておき、新しい ほうで「受けとる」に 貼り付けます。'),
    h('button', { class: 'btn primary', style: 'width:100%', onClick: () => void makeCode() }, '📤 引き継ぎコードを 作る'),
    out,
  );

  const area = h('textarea', { class: 'code-area', rows: '4', placeholder: 'LUMI1-…… の コードを ここに 貼り付け', autocomplete: 'off', spellcheck: 'false' }) as HTMLTextAreaElement;
  const recvCard = h(
    'div',
    { class: 'card' },
    h('h3', null, '② 新しい ほう（ホーム画面の アプリ など）で「受けとる」'),
    h('p', { class: 'note' }, 'コピーした コードを 長押しで 貼り付けて、入れる スロットを えらびます。'),
    area,
    h(
      'div',
      { class: 'row', style: 'margin-top:8px' },
      h('button', { class: 'btn primary grow', onClick: () => void receive(area.value) }, '📥 受けとる'),
      h('button', { class: 'btn ghost grow', onClick: () => pickFile() }, '📄 ファイルから'),
    ),
  );

  const why = h(
    'div',
    { class: 'card' },
    h('h3', null, 'なぜ 引き継ぎが いるの？'),
    h('p', { class: 'note' }, 'iPhone では Safari・LINE の中のブラウザ・ホーム画面に追加した アプリが、それぞれ 別の場所に セーブを しまいます。サーバーを 使わない ゲームなので、このコードで 自分で 運びます。コードには セーブの中身だけが 入っていて、どこにも 送信されません。'),
    h('p', { class: 'note' }, 'ホーム画面に 追加して うつしたあとは、ホーム画面の アイコンから 遊んでください（Safari の ほうの データは そのまま のこります）。'),
  );

  // 遊んでいる最中は 送るだけ（受けとると 今の冒険の 自動セーブで 上書きされてしまうため、受けとりは タイトル画面で）
  if (opts.onlySlot) s.body.append(sendCard, h('p', { class: 'note', style: 'color:#ddd' }, '受けとる時は、タイトル画面の「データ引き継ぎ」から どうぞ。'), why);
  else s.body.append(sendCard, recvCard, why);

  async function makeCode(): Promise<void> {
    audio.se('ok');
    let slot = opts.onlySlot;
    if (!slot) {
      const slots = await listSlots();
      const opt = slots.map((x) => ({ ...slotOption(x), disabled: !x.exists || !!x.broken }));
      if (!opt.some((o) => !o.disabled)) {
        await alertBox('この ブラウザには まだ セーブデータが ありません。\n今まで 遊んでいた ほう（Safari や LINE の中など）で 開いて ください。');
        return;
      }
      slot = await choose<number>('どの 冒険を 送る？', opt, 0);
      if (!slot) return;
    }
    try {
      const r = await loadGame(slot);
      if (!r) throw new SaveError('broken', 'セーブデータが 見つかりません。');
      const code = await makeTransferCode(r.data);
      const box = h('textarea', { class: 'code-area', rows: '4', readonly: 'readonly' }) as HTMLTextAreaElement;
      box.value = code;
      const copyBtn = h('button', { class: 'btn grow', onClick: async () => { const ok = await copyText(code, box); toast(ok ? 'コピーしました' : '長押しして「すべて選択」→「コピー」してください'); } }, '📋 コピー');
      const share =
        typeof navigator.share === 'function'
          ? h('button', { class: 'btn ghost grow', onClick: () => void navigator.share({ text: code }).catch(() => undefined) }, '↗ LINEなどへ')
          : null;
      out.replaceChildren(
        h('p', { class: 'note', style: 'margin-top:10px' }, `「${r.data.playerName}」の 引き継ぎコード（${code.length.toLocaleString()}文字）。さいごまで ぜんぶ コピーしてください。`),
        box,
        h('div', { class: 'row', style: 'margin-top:8px' }, copyBtn, share),
      );
      const ok = await copyText(code, box);
      toast(ok ? 'コードを コピーしました' : 'コードが できました。コピーしてください');
    } catch (e) {
      await alertBox(`コードを 作れませんでした。\n${(e as Error).message}`);
    }
  }

  async function receive(text: string): Promise<void> {
    audio.se('ok');
    if (!text.trim()) {
      await alertBox('先に コードを 貼り付けてください。');
      return;
    }
    let data;
    try {
      data = await readTransferCode(text, 1);
    } catch (e) {
      await alertBox(`読み込めませんでした。\n${(e as Error).message}`);
      return;
    }
    const slots = await listSlots();
    const slot = (await choose<number>(`「${data.playerName}」（プレイ ${formatTime(data.playTimeSec)}）を どの スロットに 入れる？`, slots.map(slotOption), 0));
    if (!slot) return;
    const info = slots.find((x) => x.slot === slot);
    if (info?.exists) {
      const ok = await confirm(`スロット${slot}の「${info.playerName ?? 'こわれたデータ'}」は 上書きされて 消えます。よろしいですか？`, '上書きする', 'やめる', true);
      if (!ok) return;
    }
    data.slot = slot;
    try {
      await saveGame(data);
    } catch (e) {
      await alertBox(`保存できませんでした。\n${(e as Error).message}`);
      return;
    }
    audio.se('item');
    received = true;
    await alertBox(`スロット${slot}に「${data.playerName}」の 冒険を 受けとりました！\nタイトル画面の「つづきから」で 遊べます。`);
    s.close();
  }

  function pickFile(): void {
    const input = h('input', { type: 'file', accept: 'application/json,.json,.txt,text/plain' }) as HTMLInputElement;
    input.addEventListener('change', async () => {
      const file = input.files?.[0];
      if (file) await receive(await file.text());
    });
    input.click();
  }

  await s.done;
  return received;
}
