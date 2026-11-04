import type { SpeciesDef } from '../core/types';

/**
 * モンスター（灯獣＝ともしびけもの）のデータ。
 * 新しいモンスターはこの配列に追加し、src/art/monsterArt.ts に同じ art ID の描画レシピを足す。
 */
const list: SpeciesDef[] = [
  {
    id: 'hinokoro', dexNo: 1, name: 'ヒノコロ', category: 'ひだねこぎつね',
    description: 'しっぽの先に小さな灯をともした子ギツネ。うれしいと火の粉が舞う。',
    ecology: 'ひだまり村の周りの日当たりのよい丘にすむ。人なつこいが、寒い日は丸くなって動かない。',
    elements: ['blaze'], baseStats: { hp: 44, atk: 58, def: 42, spa: 62, spd: 46, spe: 63 },
    baseExp: 62, catchRate: 45, rarity: 'uncommon', role: 'attacker', habitat: 'ひだまりの丘', art: 'hinokoro', color: '#ef6a3a',
    learnset: [[1, 'tackle'], [1, 'growl_soft'], [4, 'ember'], [9, 'quick_dash'], [13, 'flame_fang'], [18, 'scorch'], [23, 'kagura_flame']],
    evolutions: [{ to: 'kagurabi', condition: { kind: 'level', level: 14 }, hint: '炎の舞で攻める特攻型' }],
  },
  {
    id: 'kagurabi', dexNo: 2, name: 'カグラビ', category: 'まいびぎつね',
    description: '九つの火の帯をまとい、祭りの舞のように炎を操る。',
    ecology: '満月の夜、群れで舞って山の灯脈に火を返すと言われる。誇り高く、認めた相手には忠実。',
    elements: ['blaze', 'shine'], baseStats: { hp: 64, atk: 74, def: 58, spa: 96, spd: 70, spe: 92 },
    baseExp: 150, catchRate: 25, rarity: 'rare', role: 'special', habitat: 'ひだまりの丘', art: 'kagurabi', color: '#f08a3e',
    evolvesFrom: 'hinokoro',
    learnset: [[1, 'ember'], [14, 'glow_beam'], [18, 'scorch'], [23, 'kagura_flame'], [30, 'prism_ray']],
  },
  {
    id: 'shizukun', dexNo: 3, name: 'シズクン', category: 'しずくイモリ',
    description: '頭に大きな水のしずくをのせたイモリ。しずくが曇ると機嫌が悪い。',
    ecology: '小川や湧き水の近くにすむ。しずくの中に小さな灯を宿していて、夜はほのかに青く光る。',
    elements: ['tide'], baseStats: { hp: 50, atk: 50, def: 56, spa: 56, spd: 58, spe: 46 },
    baseExp: 62, catchRate: 45, rarity: 'uncommon', role: 'balanced', habitat: 'みなもの小川', art: 'shizukun', color: '#3a8fe0',
    learnset: [[1, 'tackle'], [1, 'harden'], [4, 'splash_shot'], [9, 'spring_heal'], [13, 'tide_tail'], [20, 'torrent']],
    evolutions: [{ to: 'minamodra', condition: { kind: 'level', level: 14 }, hint: '回復しながら粘る防御型' }],
  },
  {
    id: 'minamodra', dexNo: 4, name: 'ミナモドラ', category: 'せせらぎりゅう',
    description: '背中のヒレから霧を出し、川の流れを自在に変える竜。',
    ecology: '水源を守る主として祀られることもある。争いを好まないが、水を汚す者には容赦しない。',
    elements: ['tide', 'stone'], baseStats: { hp: 86, atk: 78, def: 84, spa: 70, spd: 76, spe: 56 },
    baseExp: 150, catchRate: 25, rarity: 'rare', role: 'tank', habitat: 'みなもの小川', art: 'minamodra', color: '#2f7fc8',
    evolvesFrom: 'shizukun',
    learnset: [[1, 'splash_shot'], [14, 'pebble_toss'], [17, 'tide_tail'], [20, 'iron_shell'], [24, 'torrent'], [30, 'rock_drill']],
  },
  {
    id: 'mebukin', dexNo: 5, name: 'メブキン', category: 'めばえハリネズミ',
    description: '背中の針が若葉になっているハリネズミ。日光を浴びると針がのびる。',
    ecology: '森のふちで落ち葉の下にもぐって眠る。おどろくと葉っぱを飛ばして逃げる。',
    elements: ['sprout'], baseStats: { hp: 48, atk: 60, def: 54, spa: 48, spd: 52, spe: 58 },
    baseExp: 62, catchRate: 45, rarity: 'uncommon', role: 'attacker', habitat: 'ほたる森のふち', art: 'mebukin', color: '#4cae4f',
    learnset: [[1, 'tackle'], [1, 'growl_soft'], [4, 'leaf_cut'], [9, 'sap_drain'], [13, 'toxic_pollen'], [19, 'thorn_rush']],
    evolutions: [{ to: 'morinonushi', condition: { kind: 'level', level: 14 }, hint: '吸収と毒で削る耐久アタッカー' }],
  },
  {
    id: 'morinonushi', dexNo: 6, name: 'イバラジシ', category: 'いばらじし',
    description: 'たてがみがいばらの茂みになった獅子。歩いた跡に花が咲く。',
    ecology: '森の奥で年老いた木々を見回っている。森の灯がゆらぐと真っ先に気づく。',
    elements: ['sprout', 'stone'], baseStats: { hp: 80, atk: 94, def: 82, spa: 56, spd: 70, spe: 68 },
    baseExp: 150, catchRate: 25, rarity: 'rare', role: 'attacker', habitat: 'ほたる森のふち', art: 'morinonushi', color: '#3f9a45',
    evolvesFrom: 'mebukin',
    learnset: [[1, 'leaf_cut'], [14, 'pebble_toss'], [16, 'sap_drain'], [19, 'thorn_rush'], [24, 'rock_drill']],
  },
  {
    id: 'piricchi', dexNo: 7, name: 'ピリッチ', category: 'はじけヒヨコ',
    description: '羽毛に静電気をためているヒヨコ。さわるとパチッとする。',
    ecology: '草原で群れて暮らす。雷雲が近づくと一斉に空を見上げる。',
    elements: ['volt'], baseStats: { hp: 38, atk: 44, def: 36, spa: 58, spd: 40, spe: 72 },
    baseExp: 52, catchRate: 160, rarity: 'common', role: 'speed', habitat: 'そよかぜ草原', art: 'piricchi', color: '#e8c12c',
    learnset: [[1, 'tackle'], [3, 'spark'], [7, 'quick_dash'], [11, 'jolt_wave'], [16, 'thunder_beak']],
    evolutions: [{ to: 'raimeicho', condition: { kind: 'level', level: 17 }, hint: '素早さで先手を取る雷の鳥' }],
  },
  {
    id: 'raimeicho', dexNo: 8, name: 'ライメイチョウ', category: 'らいうんちょう',
    description: '翼を打ち合わせて雷を鳴らす大きな鳥。嵐の前ぶれに現れる。',
    ecology: '高い木の上に巣をつくる。雷のあとの雨で育つ草原を見守るとも言われる。',
    elements: ['volt', 'gale'], baseStats: { hp: 62, atk: 70, def: 56, spa: 92, spd: 62, spe: 104 },
    baseExp: 142, catchRate: 45, rarity: 'uncommon', role: 'speed', habitat: 'そよかぜ草原', art: 'raimeicho', color: '#d9a91e',
    evolvesFrom: 'piricchi',
    learnset: [[1, 'spark'], [17, 'gust'], [20, 'thunder_beak'], [24, 'air_slash'], [30, 'storm_bolt']],
  },
  {
    id: 'fuwamo', dexNo: 9, name: 'フワモ', category: 'わたげだま',
    description: '風に乗ってただよう綿毛のかたまり。まだ何色にも染まっていない灯を持つ。',
    ecology: '育つ場所や出会うものによって、まったく違う姿に変わる。灯の研究者がもっとも注目する灯獣。',
    elements: ['neutral'], baseStats: { hp: 52, atk: 40, def: 46, spa: 46, spd: 52, spe: 50 },
    baseExp: 58, catchRate: 120, rarity: 'uncommon', role: 'support', habitat: 'そよかぜ草原', art: 'fuwamo', color: '#efe7d6',
    learnset: [[1, 'tackle'], [1, 'growl_soft'], [5, 'gust'], [9, 'rest_song'], [12, 'whirlwind_step'], [15, 'heavy_press']],
    evolutions: [
      { to: 'hikariwata', condition: { kind: 'item', itemId: 'dawn_stone', minLevel: 5 }, hint: '「あかつきの石」で光に染まる回復・補助型' },
      { to: 'kagewata', condition: { kind: 'levelAtLocation', level: 16, mapId: 'firefly_forest' }, hint: 'ほたる森で Lv16 以上になると影に染まる妨害型' },
      { to: 'kazewata', condition: { kind: 'levelKnowsMove', level: 16, moveId: 'whirlwind_step' }, hint: '「つむじかぜ」を覚えたまま Lv16 以上で風に染まる素早い攻撃型' },
    ],
  },
  {
    id: 'hikariwata', dexNo: 10, name: 'ヒカリワタ', category: 'あけぼのわた',
    description: '朝日の色に染まった綿毛。ふれた傷をやさしく癒やす。',
    ecology: '夜明けの丘に集まり、仲間の灯を分け合うように寄りそって眠る。',
    elements: ['shine'], baseStats: { hp: 82, atk: 46, def: 70, spa: 80, spd: 92, spe: 60 },
    baseExp: 140, catchRate: 45, rarity: 'rare', role: 'support', habitat: '不明（進化でのみ出会える）', art: 'hikariwata', color: '#f3d36b',
    evolvesFrom: 'fuwamo',
    learnset: [[1, 'glow_beam'], [1, 'dawn_prayer'], [18, 'dazzle'], [26, 'prism_ray']],
  },
  {
    id: 'kagewata', dexNo: 11, name: 'カゲワタ', category: 'よいやみわた',
    description: '夕闇に染まった綿毛。ふわりと近づいて相手の目をくらませる。',
    ecology: '暗い森の中で、迷った者の足元をさらに暗くするいたずら好き。',
    elements: ['shade'], baseStats: { hp: 70, atk: 56, def: 64, spa: 88, spd: 74, spe: 78 },
    baseExp: 140, catchRate: 45, rarity: 'rare', role: 'special', habitat: '不明（進化でのみ出会える）', art: 'kagewata', color: '#6d4f9c',
    evolvesFrom: 'fuwamo',
    learnset: [[1, 'shadow_nip'], [1, 'night_mist'], [18, 'soul_sip'], [22, 'nasty_whisper'], [28, 'dusk_orb']],
  },
  {
    id: 'kazewata', dexNo: 12, name: 'カゼワタ', category: 'つむじわた',
    description: '小さな竜巻を体にまとった綿毛。目にもとまらぬ速さで飛び回る。',
    ecology: '季節風に乗って島から島へ渡る。止まっているところを見た者は少ない。',
    elements: ['gale'], baseStats: { hp: 60, atk: 86, def: 54, spa: 64, spd: 58, spe: 108 },
    baseExp: 140, catchRate: 45, rarity: 'rare', role: 'speed', habitat: '不明（進化でのみ出会える）', art: 'kazewata', color: '#5cc7b8',
    evolvesFrom: 'fuwamo',
    learnset: [[1, 'gust'], [1, 'gale_wing'], [20, 'air_slash'], [26, 'heavy_press']],
  },
  {
    id: 'koishimo', dexNo: 13, name: 'コイシモ', category: 'こいしもぐら',
    description: '小石を背中にくっつけて身を守るモグラ。集めた石を自慢する。',
    ecology: '草原の土の中にトンネルを掘る。光る石を見つけると巣に持ち帰る。',
    elements: ['stone'], baseStats: { hp: 50, atk: 60, def: 70, spa: 30, spd: 40, spe: 30 },
    baseExp: 56, catchRate: 150, rarity: 'common', role: 'tank', habitat: 'そよかぜ草原', art: 'koishimo', color: '#a07a4e',
    learnset: [[1, 'tackle'], [1, 'harden'], [5, 'pebble_toss'], [10, 'sand_veil'], [14, 'iron_shell'], [20, 'rock_drill']],
    evolutions: [{ to: 'gankutsu', condition: { kind: 'level', level: 20 }, hint: '岩の甲羅で守る壁役' }],
  },
  {
    id: 'gankutsu', dexNo: 14, name: 'ガンクツモグラ', category: 'いわやまもぐら',
    description: '岩の甲羅を背負った大モグラ。ツメのひとかきで洞窟を掘り抜く。',
    ecology: '山の中に迷路のような巣穴を持つ。その奥には灯脈の結晶があると言われる。',
    elements: ['stone'], baseStats: { hp: 80, atk: 92, def: 110, spa: 40, spd: 60, spe: 38 },
    baseExp: 140, catchRate: 60, rarity: 'uncommon', role: 'tank', habitat: 'いわおの山（未実装）', art: 'gankutsu', color: '#8a6a44',
    evolvesFrom: 'koishimo',
    learnset: [[1, 'pebble_toss'], [20, 'heavy_press'], [24, 'rock_drill']],
  },
  {
    id: 'kazamidori', dexNo: 15, name: 'カザミドリ', category: 'かざみどり',
    description: '風の向きがわかる不思議なとさかを持つ鳥。旅人に道を教える。',
    ecology: '屋根や高い岩の上にとまり、いつも風上を向いている。',
    elements: ['gale', 'neutral'], baseStats: { hp: 46, atk: 54, def: 40, spa: 42, spd: 40, spe: 68 },
    baseExp: 54, catchRate: 170, rarity: 'common', role: 'speed', habitat: 'そよかぜ草原', art: 'kazamidori', color: '#7bc8d6',
    learnset: [[1, 'tackle'], [3, 'gust'], [8, 'quick_dash'], [12, 'whirlwind_step'], [17, 'gale_wing'], [22, 'air_slash']],
  },
  {
    id: 'yoiyami', dexNo: 16, name: 'ヨイヤミ', category: 'ちょうちんが',
    description: 'はねにちょうちんの模様がある夜の蛾。模様が本当に光ることがある。',
    ecology: 'ほたる森の奥にすむ。黒霞が出てから、群れが森の外に追い出されている。',
    elements: ['shade', 'sprout'], baseStats: { hp: 50, atk: 40, def: 46, spa: 64, spd: 58, spe: 62 },
    baseExp: 64, catchRate: 120, rarity: 'uncommon', role: 'special', habitat: 'ほたる森', art: 'yoiyami', color: '#7b5ea8',
    learnset: [[1, 'shadow_nip'], [1, 'spore_puff'], [8, 'sap_drain'], [12, 'night_mist'], [17, 'soul_sip'], [23, 'dusk_orb']],
  },
  {
    id: 'hotarunoou', dexNo: 17, name: 'ホタルノオウ', category: 'ほたるのぬし',
    description: 'ほたる森の灯脈を守る主。千のほたるを従え、森に光を配る。',
    ecology: '森の奥の泉で眠る。今は黒霞に灯をむしばまれ、正気を失っている。',
    elements: ['shine'], baseStats: { hp: 96, atk: 60, def: 70, spa: 88, spd: 80, spe: 56 },
    baseExp: 220, catchRate: 0, rarity: 'boss', role: 'special', habitat: 'ほたる森の奥', art: 'hotarunoou', color: '#c9e86b',
    learnset: [[1, 'glow_beam'], [1, 'firefly_storm'], [1, 'dazzle'], [1, 'spore_puff']],
  },
];

export const SPECIES: Record<string, SpeciesDef> = Object.fromEntries(list.map((s) => [s.id, s]));
export const SPECIES_LIST: SpeciesDef[] = [...list].sort((a, b) => a.dexNo - b.dexNo);

export function getSpecies(id: string): SpeciesDef {
  const s = SPECIES[id];
  if (!s) throw new Error(`unknown species: ${id}`);
  return s;
}

export const STARTERS = ['hinokoro', 'shizukun', 'mebukin'] as const;
