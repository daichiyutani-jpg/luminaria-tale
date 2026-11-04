import { describe, expect, it } from 'vitest';
import jsQR from 'jsqr';
import qrcode from 'qrcode-generator';
import type { MonsterInstance } from '../src/core/types';
import { SPECIES_LIST } from '../src/data/species';
import { active, aiChooseMove, aiChooseSwitch, type Action, type SideIndex } from '../src/logic/battle';
import { newGame } from '../src/logic/game';
import { createMonster, evolve } from '../src/logic/monster';
import { seededRng } from '../src/logic/rng';
import { maxHp } from '../src/logic/stats';
import { b64urlToUtf8, utf8ToB64url } from '../src/net/codec';
import { createMatch, isValidAction, isValidSwitch, stateHash } from '../src/net/match';
import { buildSdp, decodeSignal, encodeSignal, extractSdp } from '../src/net/sdp';
import { decodeTeam, encodeTeam } from '../src/net/team';
import { applyTrade, canOffer, fromWire, toWire } from '../src/net/trade';
import { sharedSeed } from '../src/net/versus';
import { checksum } from '../src/save/validate';

let n = 0;
const ivs = { hp: 3, atk: 15, def: 7, spa: 0, spd: 12, spe: 9 };
const mk = (sp: string, lv: number): MonsterInstance => createMonster(sp, lv, seededRng(n), { uid: `u${n++}`, caughtAt: 'テスト', ivs: { ...ivs } });

function teamA(): MonsterInstance[] {
  const evo = mk('hinokoro', 20);
  evolve(evo, 'kagurabi');
  evo.nickname = 'ぽち';
  return [evo, mk('shizukun', 18), mk('fuwamo', 15)];
}
const teamB = () => [mk('mebukin', 19), mk('piricchi', 17), mk('shizukun', 16)];

describe('チームのコード（QRチーム対戦）', () => {
  it('コードにして 読みもどすと、種族・レベル・素質・技・ニックネームが同じで、全回復になる', () => {
    const party = teamA();
    party[1].hp = 1;
    party[1].moves[0].pp = 0;
    const enc = encodeTeam('アオイ', party);
    expect(enc.ok).toBe(true);
    if (!enc.ok) return;
    expect(enc.code.length).toBeLessThan(600);
    const dec = decodeTeam(enc.code, 'x');
    expect(dec.ok).toBe(true);
    if (!dec.ok) return;
    expect(dec.team.name).toBe('アオイ');
    expect(dec.team.party.map((m) => [m.speciesId, m.level, m.ivs, m.moves.map((x) => x.id), m.nickname, m.history])).toEqual(
      party.map((m) => [m.speciesId, m.level, m.ivs, m.moves.map((x) => x.id), m.nickname, m.history]),
    );
    for (const m of dec.team.party) {
      expect(m.hp).toBe(maxHp(m));
      expect(m.uid.startsWith('x')).toBe(true);
    }
    expect(dec.team.party[1].moves[0].pp).toBeGreaterThan(0);
  });

  it('チェックサムが合わない・一部が欠けたコードは読まない', () => {
    const enc = encodeTeam('アオイ', teamA());
    if (!enc.ok) throw new Error('encode');
    const [head, body, sum] = enc.code.split('.');
    const flipped = body.slice(0, 10) + (body[10] === 'A' ? 'B' : 'A') + body.slice(11);
    expect(decodeTeam(`${head}.${flipped}.${sum}`).ok).toBe(false);
    expect(decodeTeam(enc.code.slice(0, -3)).ok).toBe(false);
    expect(decodeTeam('こんにちは').ok).toBe(false);
    const newer = decodeTeam(enc.code.replace(/^LMT1/, 'LMT9'));
    expect(newer.ok).toBe(false);
  });

  /** 中身を書きかえて、チェックサムだけ付け直した（改造した）コード */
  const forge = (obj: unknown) => {
    const head = `LMT1.${utf8ToB64url(JSON.stringify(obj))}`;
    return `${head}.${checksum(head)}`;
  };

  it('改造したチーム（ボス・覚えられない技・レベル上限こえ・素質の範囲外・7体以上）は拒否する', () => {
    const enc = encodeTeam('アオイ', teamA());
    if (!enc.ok) throw new Error('encode');
    const data = JSON.parse(b64urlToUtf8(enc.code.split('.')[1]));
    expect(decodeTeam(forge(data)).ok).toBe(true); // 付け直しただけなら通る

    const boss = SPECIES_LIST.find((s) => s.rarity === 'boss');
    if (boss) {
      const d = structuredClone(data);
      d.t[0] = [[boss.id], 30, '777777', [boss.learnset[0][1]]];
      const r = decodeTeam(forge(d));
      expect(r.ok).toBe(false);
    }
    const badMove = structuredClone(data);
    badMove.t[1][3] = ['struggle'];
    expect(decodeTeam(forge(badMove)).ok).toBe(false);
    const unknownMove = structuredClone(data);
    unknownMove.t[1][3] = ['no-such-move'];
    expect(decodeTeam(forge(unknownMove)).ok).toBe(false);
    const overLevel = structuredClone(data);
    overLevel.t[1][1] = 100000;
    expect(decodeTeam(forge(overLevel)).ok).toBe(false);
    const badIv = structuredClone(data);
    badIv.t[1][2] = 'zzzzzz';
    expect(decodeTeam(forge(badIv)).ok).toBe(false);
    const fakeEvo = structuredClone(data);
    fakeEvo.t[2][0] = ['fuwamo', 'kagurabi'];
    expect(decodeTeam(forge(fakeEvo)).ok).toBe(false);
    const seven = structuredClone(data);
    seven.t.push(data.t[0], data.t[1], data.t[2], data.t[2]);
    expect(seven.t).toHaveLength(7);
    expect(decodeTeam(forge(seven)).ok).toBe(false);
    const six = structuredClone(data);
    six.t.push(data.t[0], data.t[1], data.t[2]);
    expect(decodeTeam(forge(six)).ok).toBe(true);
    expect(decodeTeam(forge({ n: 'x', t: [] })).ok).toBe(false);
    expect(decodeTeam(forge({ n: 'x', t: [[1, 2, 3]] })).ok).toBe(false);
  });

  it('名前の制御文字は取りのぞき、長すぎる名前は切る', () => {
    const enc = encodeTeam('ab\u0000c' + String.fromCharCode(0x202e) + 'defghijklmnopqrstu', teamA());
    if (!enc.ok) throw new Error('encode');
    const dec = decodeTeam(enc.code);
    expect(dec.ok && dec.team.name).toBe('abcdefghijkl');
  });
});

describe('QR の表示と読み取り', () => {
  it('qrcode-generator で作った QR を jsQR で読める（6体のチームでも コードがそのまま戻る）', () => {
    const enc = encodeTeam('アオイ', [...teamA(), ...teamB()]);
    if (!enc.ok) throw new Error('encode');
    const qr = qrcode(0, 'L');
    qr.addData(enc.code, 'Byte');
    qr.make();
    const cells = qr.getModuleCount();
    const cell = 4;
    const size = (cells + 8) * cell;
    const data = new Uint8ClampedArray(size * size * 4).fill(255);
    for (let r = 0; r < cells; r++)
      for (let c = 0; c < cells; c++) {
        if (!qr.isDark(r, c)) continue;
        for (let y = 0; y < cell; y++)
          for (let x = 0; x < cell; x++) {
            const i = (((r + 4) * cell + y) * size + (c + 4) * cell + x) * 4;
            data[i] = data[i + 1] = data[i + 2] = 0;
          }
      }
    expect(jsQR(data, size, size)?.data).toBe(enc.code);
  });
});

const SAMPLE_OFFER = [
  'v=0',
  'o=- 2890844526 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'a=group:BUNDLE 0',
  'a=extmap-allow-mixed',
  'a=msid-semantic: WMS',
  'm=application 51234 UDP/DTLS/SCTP webrtc-datachannel',
  'c=IN IP4 203.0.113.7',
  'a=candidate:1467250027 1 udp 2122260223 4f6a1c2e-3b7d-4a35-9e0f-2d1c8b7a6e55.local 51234 typ host generation 0 network-id 1',
  'a=candidate:1467250027 1 udp 2122260223 4f6a1c2e-3b7d-4a35-9e0f-2d1c8b7a6e55.local 51234 typ host generation 0 network-id 1',
  'a=candidate:3089283311 1 tcp 1518280447 4f6a1c2e-3b7d-4a35-9e0f-2d1c8b7a6e55.local 9 typ host tcptype active generation 0',
  'a=candidate:842163049 1 udp 1686052607 203.0.113.7 51234 typ srflx raddr 0.0.0.0 rport 0 generation 0 network-id 1',
  'a=candidate:2999745851 1 udp 2122194687 192.168.1.23 53100 typ host generation 0',
  'a=candidate:2999745851 2 udp 2122194686 192.168.1.23 53101 typ host generation 0',
  'a=ice-ufrag:Ab3/',
  'a=ice-pwd:f2Kx9+qL0mVt8sR1pZ4yW7cN',
  'a=ice-options:trickle',
  'a=fingerprint:sha-256 6B:8B:5D:EA:59:04:20:23:29:C8:87:1C:CB:5A:12:F4:9A:0C:4E:4D:52:6F:8C:21:16:4B:35:5A:E2:73:65:23',
  'a=setup:actpass',
  'a=mid:0',
  'a=sctp-port:5000',
  'a=max-message-size:262144',
  '',
].join('\r\n');

describe('接続情報（SDP）の圧縮', () => {
  it('必要な所だけ取り出し、短い文字列にして、組み立て直すと同じ情報になる', () => {
    const e = extractSdp(SAMPLE_OFFER);
    expect(e.ufrag).toBe('Ab3/');
    expect(e.pwd).toBe('f2Kx9+qL0mVt8sR1pZ4yW7cN');
    expect(e.setup).toBe('actpass');
    // UDP・コンポーネント1・重複なし。host が先
    expect(e.candidates).toEqual([
      { type: 'host', address: '4f6a1c2e-3b7d-4a35-9e0f-2d1c8b7a6e55.local', port: 51234 },
      { type: 'host', address: '192.168.1.23', port: 53100 },
      { type: 'srflx', address: '203.0.113.7', port: 51234 },
    ]);
    const code = encodeSignal({ kind: 'offer', mode: 'trade', stun: true, sdp: e });
    expect(code.length).toBeLessThan(600);
    const back = decodeSignal(code);
    expect(back.kind).toBe('offer');
    expect(back.mode).toBe('trade');
    expect(back.stun).toBe(true);
    expect(back.sdp).toEqual(e);

    const rebuilt = buildSdp(back.sdp);
    expect(rebuilt).toContain('m=application 9 UDP/DTLS/SCTP webrtc-datachannel');
    expect(rebuilt).toContain('a=fingerprint:sha-256 6B:8B:5D:EA:59:04:20:23:29:C8:87:1C:CB:5A:12:F4:9A:0C:4E:4D:52:6F:8C:21:16:4B:35:5A:E2:73:65:23');
    expect(rebuilt).toContain('a=setup:actpass');
    expect(rebuilt).toContain('a=ice-ufrag:Ab3/');
    expect(rebuilt).toContain('a=sctp-port:5000');
    expect(rebuilt.endsWith('\r\n')).toBe(true);
    // 組み立て直した SDP から取り出しても同じ
    expect(extractSdp(rebuilt)).toEqual(e);
  });

  it('answer（setup:active）も往復でき、壊れたコードは理由つきで拒否する', () => {
    const ans = SAMPLE_OFFER.replace('a=setup:actpass', 'a=setup:active');
    const code = encodeSignal({ kind: 'answer', sdp: extractSdp(ans) });
    expect(code.startsWith('LMA1~')).toBe(true);
    const back = decodeSignal(code);
    expect(back.kind).toBe('answer');
    expect(back.sdp.setup).toBe('active');
    expect(() => decodeSignal(code.slice(0, -1) + (code.endsWith('0') ? '1' : '0'))).toThrow();
    expect(() => decodeSignal(code.replace('LMA1', 'LMA7'))).toThrow();
    expect(() => decodeSignal('hello')).toThrow();
  });
});

describe('対人戦：2台のエンジンが同じ結果になる', () => {
  /** 正本の並び（0=ホスト）で、ある側の行動を決める */
  function choose(m: ReturnType<typeof createMatch>, side: SideIndex, rng: { next(): number }): Action {
    const st = m.canonical;
    const s = st.sides[side];
    // たまに交代
    const others = s.party.map((x, i) => (x.hp > 0 && i !== s.active ? i : -1)).filter((i) => i >= 0);
    if (others.length && rng.next() < 0.15) return { type: 'switch', to: others[Math.floor(rng.next() * others.length)] };
    return aiChooseMove(st, side, rng, 0.6);
  }

  for (const seedBase of [1, 2, 3, 4, 5, 6]) {
    it(`シード ${seedBase}: 同じ行動を入れると最後まで同じ状態（ホスト側とゲスト側）`, () => {
      const encA = encodeTeam('ホスト', teamA());
      const encB = encodeTeam('ゲスト', teamB());
      if (!encA.ok || !encB.ok) throw new Error('encode');
      // 両方の端末は「同じコード」からチームを作る
      const mkTeams = () => {
        const a = decodeTeam(encA.code, 'a');
        const b = decodeTeam(encB.code, 'b');
        if (!a.ok || !b.ok) throw new Error('decode');
        return [a.team, b.team] as const;
      };
      const [ha, hb] = mkTeams();
      const [ga, gb] = mkTeams();
      const seed = sharedSeed(1234 * seedBase, 98765 + seedBase);
      const host = createMatch(ha, hb, 0, seed);
      const guest = createMatch(ga, gb, 1, seed);
      const pick = seededRng(777 + seedBase);
      let guard = 0;
      while (!host.canonical.result && guard++ < 400) {
        expect(host.hash()).toBe(guest.hash());
        const st = host.canonical;
        if (st.needsSwitch[0] || st.needsSwitch[1]) {
          const s0 = st.needsSwitch[0] ? aiChooseSwitch(st, 0) : null;
          const s1 = st.needsSwitch[1] ? aiChooseSwitch(st, 1) : null;
          if (s0 !== null) expect(isValidSwitch(st, 0, s0)).toBe(true);
          if (s1 !== null) expect(isValidSwitch(guest.canonical, 1, s1)).toBe(true);
          host.switches(s0, s1);
          guest.switches(s1, s0); // ゲストから見ると「自分＝1」の交代が mine
          continue;
        }
        const a0 = choose(host, 0, pick);
        const a1 = choose(host, 1, pick);
        expect(isValidAction(guest.canonical, 0, a0)).toBe(true);
        expect(isValidAction(host.canonical, 1, a1)).toBe(true);
        const hostEv = host.turn(a0, a1);
        const guestEv = guest.turn(a1, a0);
        // 出来事の数は同じで、向きだけ逆
        expect(guestEv.length).toBe(hostEv.length);
        hostEv.forEach((e, i) => {
          const g = guestEv[i];
          expect(g.t).toBe(e.t);
          if ('side' in e && 'side' in g) expect(g.side).toBe(e.side === 0 ? 1 : 0);
        });
      }
      expect(host.canonical.result).not.toBeNull();
      expect(stateHash(host.canonical)).toBe(stateHash(guest.canonical));
      const strip = (m: typeof host) => JSON.stringify({ ...m.canonical, pov: undefined });
      expect(strip(guest)).toBe(strip(host));
      // ゲストの画面では、自分（正本の 1）が 0 に見え、勝ち負けも逆
      expect(guest.view.sides[0]).toBe(guest.canonical.sides[1]);
      expect(active(guest.view, 0).uid.startsWith('b')).toBe(true);
      const r = host.canonical.result;
      expect(guest.view.result).toBe(r === 'win' ? 'lose' : r === 'lose' ? 'win' : r);
    });
  }

  it('文章はそれぞれの端末から見た書き方になる（自分の灯獣に「あいての」が付かない）', () => {
    const encA = encodeTeam('ホスト', [mk('hinokoro', 10)]);
    const encB = encodeTeam('ゲスト', [mk('mebukin', 10)]);
    if (!encA.ok || !encB.ok) throw new Error('encode');
    const t = (c: string, p: string) => {
      const d = decodeTeam(c, p);
      if (!d.ok) throw new Error('decode');
      return d.team;
    };
    const host = createMatch(t(encA.code, 'a'), t(encB.code, 'b'), 0, 42);
    const guest = createMatch(t(encA.code, 'a'), t(encB.code, 'b'), 1, 42);
    const hostMsgs = host.turn({ type: 'move', index: 0 }, { type: 'move', index: 0 }).filter((e) => e.t === 'msg').map((e) => (e as { text: string }).text);
    const guestMsgs = guest.turn({ type: 'move', index: 0 }, { type: 'move', index: 0 }).filter((e) => e.t === 'msg').map((e) => (e as { text: string }).text);
    expect(hostMsgs.some((m) => m.startsWith('ヒノコロの'))).toBe(true);
    expect(hostMsgs.some((m) => m.startsWith('あいての メブキン'))).toBe(true);
    expect(guestMsgs.some((m) => m.startsWith('メブキンの'))).toBe(true);
    expect(guestMsgs.some((m) => m.startsWith('あいての ヒノコロ'))).toBe(true);
  });

  it('対戦しても 元のチーム（セーブ側の灯獣）は変わらない', () => {
    const party = teamA();
    const before = JSON.stringify(party);
    const enc = encodeTeam('ホスト', party);
    const encB = encodeTeam('ゲスト', teamB());
    if (!enc.ok || !encB.ok) throw new Error('encode');
    const a = decodeTeam(enc.code, 'a');
    const b = decodeTeam(encB.code, 'b');
    if (!a.ok || !b.ok) throw new Error('decode');
    const m = createMatch(a.team, b.team, 0, 5);
    for (let i = 0; i < 30 && !m.canonical.result; i++) {
      const st = m.canonical;
      if (st.needsSwitch[0] || st.needsSwitch[1]) m.switches(st.needsSwitch[0] ? aiChooseSwitch(st, 0) : null, st.needsSwitch[1] ? aiChooseSwitch(st, 1) : null);
      else m.turn({ type: 'move', index: 0 }, { type: 'move', index: 0 });
    }
    expect(JSON.stringify(party)).toBe(before);
    expect(a.team.party.every((x) => x.hp === maxHp(x))).toBe(true);
  });

  it('相手から来た不正な行動（道具・捕獲・にげる・範囲外の技・たおれた灯獣への交代）は受け付けない', () => {
    const enc = encodeTeam('a', teamA());
    if (!enc.ok) throw new Error('encode');
    const a = decodeTeam(enc.code, 'a');
    const b = decodeTeam(enc.code, 'b');
    if (!a.ok || !b.ok) throw new Error('decode');
    const m = createMatch(a.team, b.team, 0, 1);
    const st = m.canonical;
    expect(isValidAction(st, 1, { type: 'move', index: 0 })).toBe(true);
    expect(isValidAction(st, 1, { type: 'move', index: 9 })).toBe(false);
    expect(isValidAction(st, 1, { type: 'item', itemId: 'potion', target: 0 })).toBe(false);
    expect(isValidAction(st, 1, { type: 'capture', itemId: 'lantern' })).toBe(false);
    expect(isValidAction(st, 1, { type: 'run' })).toBe(false);
    expect(isValidAction(st, 1, { type: 'switch', to: 0 })).toBe(false); // 今出ている
    st.sides[1].party[2].hp = 0;
    expect(isValidAction(st, 1, { type: 'switch', to: 2 })).toBe(false);
    expect(isValidAction(st, 1, { type: 'switch', to: 1 })).toBe(true);
    expect(isValidAction(st, 1, null)).toBe(false);
  });
});

describe('交換', () => {
  it('送る形→受け取る形 で同じ灯獣になり、成立すると新しい UID と元の持ち主が付いて保存される', () => {
    const save = newGame(1, 'わたし');
    save.party.push(mk('hinokoro', 12), mk('shizukun', 10));
    const theirs = mk('mebukin', 14);
    theirs.nickname = 'もりお';
    const wire = JSON.parse(JSON.stringify(toWire(theirs)));
    const r = fromWire(wire);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.mon.speciesId).toBe('mebukin');
    expect(r.mon.nickname).toBe('もりお');
    const giving = save.party[1].uid;
    const t = applyTrade(save, giving, r.mon, 'ともだち');
    expect(t.ok).toBe(true);
    if (!t.ok) return;
    expect(save.party.some((m) => m.uid === giving)).toBe(false);
    const got = save.party.find((m) => m.speciesId === 'mebukin')!;
    expect(got.originalTrainer).toBe('ともだち');
    expect(got.uid).not.toBe(theirs.uid);
    expect(got.uid.startsWith('1-')).toBe(true);
    expect(save.dex.mebukin).toBe('caught');
  });

  it('パーティーの最後の1体は だせない。不正な灯獣は うけとらない', () => {
    const save = newGame(1, 'わたし');
    save.party.push(mk('hinokoro', 12));
    expect(canOffer(save, save.party[0].uid).ok).toBe(false);
    expect(applyTrade(save, save.party[0].uid, mk('fuwamo', 5), 'x').ok).toBe(false);
    save.box.push(mk('fuwamo', 6));
    expect(canOffer(save, save.box[0].uid).ok).toBe(true);
    const w = toWire(mk('mebukin', 10));
    expect(fromWire({ ...w, l: 999 }).ok).toBe(false);
    expect(fromWire({ ...w, mv: [{ id: 'no-such', pp: 1 }] }).ok).toBe(false);
    expect(fromWire({ ...w, hp: 99999 }).ok).toBe(false);
    expect(fromWire({ ...w, st: 'zombie' }).ok).toBe(false);
    expect(fromWire({ ...w, mv: [null] }).ok).toBe(false);
    expect(fromWire(null).ok).toBe(false);
    const boss = SPECIES_LIST.find((s) => s.rarity === 'boss');
    if (boss) expect(fromWire({ ...w, s: boss.id, hi: [boss.id] }).ok).toBe(false);
  });
});
