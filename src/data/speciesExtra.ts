/**
 * 旅の後半（2つ目の町〜黒霞の洞窟）で出会う灯獣。
 * 能力値・覚える技は役割と進化の段階から計算し、見た目は src/art/genArt.ts が設計図（GEN_ART）から描く。
 *
 * 見た目の決まり（2026-11-04 本人決定）：進化前はかわいく → 進化するたびにカッコよく強そうに。
 */
import type { Element, Role, SpeciesDef, Stats } from '../core/types';

export type Plan = 'beast' | 'bird' | 'fish' | 'serpent' | 'bug' | 'blob' | 'golem' | 'plant' | 'sprite' | 'turtle';

export interface GenArt {
  plan: Plan;
  /** 1=かわいい 2=カッコいい 3=いちばん強そう（光る目・オーラ） */
  stage: 1 | 2 | 3;
  body: string;
  accent: string;
  belly: string;
  iris: string;
  feature: Element;
}

export const GEN_ART: Record<string, GenArt> = {};

type Member = [id: string, name: string, category: string, description: string, ecology: string];

interface LineDef {
  plan: Plan;
  elements: SpeciesDef['elements'];
  role: Role;
  habitat: string;
  /** [体, かざり, おなか, 目] */
  colors: [string, string, string, string];
  /** 進化するレベル（2回進化なら2つ） */
  evo?: number[];
  members: Member[];
  rarity?: SpeciesDef['rarity'];
  /** 1体だけの系統の合計能力（省略時 480） */
  total?: number;
  /** 段階ごとの合計能力（省略時は 3段階 310/425/530・2段階 330/495） */
  totals?: number[];
}

const ROLE_W: Record<Role, number[]> = {
  attacker: [0.9, 1.3, 0.9, 0.8, 0.9, 1.2],
  special: [0.9, 0.8, 0.9, 1.3, 1.1, 1.0],
  tank: [1.2, 1.0, 1.3, 0.7, 1.1, 0.7],
  speed: [0.85, 1.1, 0.8, 1.05, 0.85, 1.35],
  support: [1.15, 0.8, 1.0, 1.0, 1.2, 0.85],
  balanced: [1, 1, 1, 1, 1, 1],
};

function statsFor(total: number, role: Role): Stats {
  const w = ROLE_W[role];
  const mean = w.reduce((a, b) => a + b, 0) / 6;
  const v = w.map((x) => Math.round(((total / 6) * x) / mean));
  return { hp: v[0], atk: v[1], def: v[2], spa: v[3], spd: v[4], spe: v[5] };
}

/** 属性ごとの技：[弱い, 中くらい(物理), 中くらい(特殊), 強い(物理), 強い(特殊), 補助] */
const POOL: Record<Element, [string, string, string, string, string, string]> = {
  neutral: ['tackle', 'heavy_press', 'roar_wave', 'full_charge', 'roar_wave', 'battle_cry'],
  blaze: ['ember', 'flame_fang', 'kagura_flame', 'magma_fist', 'blaze_burst', 'scorch'],
  tide: ['splash_shot', 'tide_tail', 'torrent', 'tide_fang', 'great_wave', 'spring_heal'],
  sprout: ['leaf_cut', 'thorn_rush', 'sap_drain', 'green_blade', 'forest_wrath', 'spore_puff'],
  volt: ['spark', 'thunder_beak', 'storm_bolt', 'volt_claw', 'thunder_fall', 'jolt_wave'],
  stone: ['pebble_toss', 'rock_drill', 'gem_beam', 'mountain_break', 'gem_beam', 'iron_shell'],
  gale: ['gust', 'gale_wing', 'air_slash', 'sky_dive', 'tempest', 'whirlwind_step'],
  shine: ['glow_beam', 'light_lance', 'prism_ray', 'light_lance', 'sunrise', 'dawn_prayer'],
  shade: ['shadow_nip', 'night_claw', 'soul_sip', 'night_claw', 'abyss', 'night_mist'],
};

function learnsetFor(elements: SpeciesDef['elements'], s: Stats): [number, string][] {
  const phys = s.atk >= s.spa;
  const a = POOL[elements[0]];
  const b = POOL[elements[1] ?? elements[0]];
  const buff = phys ? 'battle_cry' : 'quiet_heart';
  const raw: [number, string][] = [
    [1, 'tackle'],
    [1, a[5]],
    [4, a[0]],
    [10, elements[1] ? b[0] : 'growl_soft'],
    [16, phys ? a[1] : a[2]],
    [22, elements[1] ? (phys ? b[1] : b[2]) : phys ? 'heavy_press' : 'roar_wave'],
    [30, buff],
    [36, phys ? a[3] : a[4]],
    [44, elements[1] ? (phys ? b[3] : b[4]) : phys ? 'full_charge' : 'roar_wave'],
    [52, phys ? a[4] : a[3]],
  ];
  const seen = new Set<string>();
  return raw.filter(([, id]) => (seen.has(id) ? false : (seen.add(id), true)));
}

const out: SpeciesDef[] = [];
let dex = 24;

function line(d: LineDef): void {
  const n = d.members.length;
  const totals = d.totals ?? (n === 3 ? [310, 425, 530] : n === 2 ? [330, 495] : [d.total ?? 480]);
  d.members.forEach(([id, name, category, description, ecology], i) => {
    const last = i === n - 1;
    const stage = (n === 1 ? 2 : n === 2 ? (i === 0 ? 1 : 3) : i + 1) as 1 | 2 | 3;
    const baseStats = statsFor(totals[i], d.role);
    const sp: SpeciesDef = {
      id,
      dexNo: dex++,
      name,
      category,
      description,
      ecology,
      elements: d.elements,
      baseStats,
      baseExp: n === 1 ? 190 : stage === 1 ? 64 : last ? 220 : 145,
      catchRate: d.rarity === 'boss' ? 0 : n === 1 ? 30 : stage === 1 ? 150 : last ? 30 : 70,
      rarity: d.rarity ?? (n === 1 ? 'rare' : stage === 1 ? 'common' : last ? 'rare' : 'uncommon'),
      role: d.role,
      habitat: i === 0 ? d.habitat : `${d.habitat}（進化でも出会える）`,
      art: id,
      color: d.colors[0],
      learnset: learnsetFor(d.elements, baseStats),
    };
    if (i > 0) sp.evolvesFrom = d.members[i - 1][0];
    if (!last && d.evo) sp.evolutions = [{ to: d.members[i + 1][0], condition: { kind: 'level', level: d.evo[i] }, hint: `${d.members[i + 1][1]}へ。より強く カッコいい姿に` }];
    out.push(sp);
    GEN_ART[id] = { plan: d.plan, stage: d.rarity === 'boss' ? 3 : stage, body: d.colors[0], accent: d.colors[1], belly: d.colors[2], iris: d.colors[3], feature: d.elements[d.elements.length - 1] };
  });
}

// ───────────── 2回進化（11系統） ─────────────
line({
  plan: 'beast', elements: ['neutral'], role: 'balanced', habitat: 'こもれび街道', colors: ['#d9b48a', '#8a5a3a', '#fff3e0', '#5a3a1a'], evo: [18, 36],
  members: [
    ['mofurin', 'モフリン', 'わたげいぬ', 'ふわふわの毛に顔がうもれた子犬。においで仲間を見分ける。', '街道ぞいの草地で群れて暮らす。人のあとをついて歩くのが好き。'],
    ['mofugard', 'モフガルド', 'まもりいぬ', '首の毛が盾のように固くなった番犬。群れの先頭を歩く。', '旅人の荷物を守ってくれることもある、義理がたい性格。'],
    ['gardleon', 'ガルドレオン', 'しゅごじし', '毛並みが金の鎧になった獅子。ひと吠えで山なりが止まる。', '町を守る守り神として石像が作られている。'],
  ],
});
line({
  plan: 'fish', elements: ['tide'], role: 'attacker', habitat: 'しおかぜ街道', colors: ['#5ab4e8', '#1f5f9e', '#e8f6ff', '#103a6a'], evo: [22, 40],
  members: [
    ['pukuri', 'プクリ', 'ふくれうお', 'まんまるにふくらむ小魚。おどろくと泡をはく。', '浅い入り江で泳ぎの練習をしている。'],
    ['namikiba', 'ナミキバ', 'なみきばうお', '波をかみきる大きなキバをもつ魚。群れで狩りをする。', '潮が満ちると港の近くまでやってくる。'],
    ['watatsumiba', 'ワダツミバ', 'うみのおう', '背びれが三日月の刃になった海の王者。嵐の海でも速さが落ちない。', '大渦の中心にすむという。漁師たちのあこがれ。'],
  ],
});
line({
  plan: 'bug', elements: ['volt'], role: 'speed', habitat: 'かみなり平原', colors: ['#f2d23a', '#3a2a1a', '#fff8c0', '#1a1a2a'], evo: [30, 44],
  members: [
    ['biriko', 'ビリコ', 'でんきむし', '触角のあいだで小さな火花がはじける虫。さわるとピリッとする。', '雷の多い平原の草の根元で、静電気をためている。'],
    ['biritateha', 'ビリタテハ', 'いなずまちょう', '羽に雷の模様が走るチョウ。羽ばたくと空気がしびれる。', '雷雲の下を群れで舞う。'],
    ['ikazuchiha', 'イカヅチハ', 'らいうんちょう', '羽の先から雷を落とす大きなチョウ。嵐を呼ぶと言われる。', '雷が鳴る夜にだけ、平原の空に姿を見せる。'],
  ],
});
line({
  plan: 'golem', elements: ['stone'], role: 'tank', habitat: 'ゆけむり峠', colors: ['#b49a78', '#6e5a44', '#e6d8c0', '#2a1a10'], evo: [32, 46],
  members: [
    ['koroiwa', 'コロイワ', 'ころいし', '小石があつまって生まれた灯獣。坂道を転がって移動する。', '峠の石だたみにまぎれて昼寝をしている。'],
    ['gansekio', 'ガンセキオ', 'がんせきびと', '岩のからだに鉱石の筋が光る。ひと晩で穴を掘りぬく。', '鉱山の人たちと仲がよく、道をつくる手伝いをする。'],
    ['daiganou', 'ダイガンオウ', 'だいちのおう', '山のように大きな岩の王。足ぶみで地面がゆれる。', '大地の灯脈を背負っているという伝説がある。'],
  ],
});
line({
  plan: 'bird', elements: ['gale'], role: 'speed', habitat: 'こもれび街道', colors: ['#9ad0f0', '#3a6aa8', '#ffffff', '#1a2a4a'], evo: [20, 38],
  members: [
    ['piyoka', 'ピヨカ', 'こかぜどり', '風にのって ころころ転がるひな鳥。まだ上手に飛べない。', '街道の木の上で、風の強い日を待っている。'],
    ['kazekiri', 'カゼキリ', 'かぜきりどり', '翼で風を切りさく鳥。すれちがった木の葉が二つに割れる。', '高い崖に巣をつくり、谷を一気に飛びこえる。'],
    ['tenkuuou', 'テンクウオウ', 'てんくうのはやぶさ', '雲より高く飛ぶ大はやぶさ。急降下は目で追えない。', '高原の空の主。姿を見た日は晴れるという。'],
  ],
});
line({
  plan: 'sprite', elements: ['shine'], role: 'special', habitat: 'そよぎ高原', colors: ['#fff2b0', '#e8a83a', '#ffffff', '#c06a10'], evo: [40, 50],
  members: [
    ['powaru', 'ポワル', 'ひかりのこ', '光の粒がまるくあつまった精。うれしいと明るくなる。', '夜明け前の高原で、草の露にとまっている。'],
    ['lumiel', 'ルミエル', 'ひかりのつかい', '光の羽を広げる精。迷子を明るい方へ案内する。', '神殿の鐘の音が好き。'],
    ['luminael', 'ルミナエル', 'あかつきのせい', '夜明けそのもののように輝く精。輪の光で闇をはらう。', '島じゅうの灯が弱った時に現れると伝わる。'],
  ],
});
line({
  plan: 'beast', elements: ['shade'], role: 'attacker', habitat: 'たそがれ街道', colors: ['#3a3450', '#8a5ad0', '#6a6280', '#e04a6a'], evo: [50, 58],
  members: [
    ['kuroko', 'クロコ', 'かげいぬ', '影の中からひょっこり顔を出す子犬。しっぽだけ見えることも。', '夕暮れの街道で、旅人の影にまぎれて遊ぶ。'],
    ['yoruga', 'ヨルガ', 'よるおおかみ', '夜の色をした狼。足音がまったくしない。', '月のない夜に群れで谷を走る。'],
    ['yominokiba', 'ヨミノキバ', 'やみのおおかみ', '闇をまとう大狼。赤い目が光ると、あたりの灯がゆらぐ。', 'よいやみ谷の奥にすみ、谷を守っているとも言われる。'],
  ],
});
line({
  plan: 'plant', elements: ['sprout', 'shine'], role: 'support', habitat: 'こもれび街道', colors: ['#f2a0c0', '#4cae4f', '#fff0f5', '#7a2a4a'], evo: [20, 38],
  members: [
    ['tsubomin', 'ツボミン', 'つぼみのこ', '頭のつぼみがまだ開かない花の子。日なたでうたた寝する。', '木もれ日の下で、根っこをのばして休む。'],
    ['hanamiko', 'ハナミコ', 'はなのみこ', 'つぼみが開き、花びらの衣をまとう。花の香りで傷をいやす。', 'こもれび町の花祭りでは主役になる。'],
    ['hanakaguya', 'ハナカグヤ', 'はなのひめ', '大輪の花冠をいただく姫。光る花粉で夜を照らす。', '満開の夜にだけ舞うという。'],
  ],
});
line({
  plan: 'serpent', elements: ['blaze'], role: 'attacker', habitat: 'ゆけむり峠', colors: ['#f07a3a', '#a8200c', '#ffd8a0', '#ffe14a'], evo: [30, 46],
  members: [
    ['boyari', 'ボヤリ', 'ひのこりゅう', '小さな火をはくドラゴンの子。火加減がまだ下手。', '温泉の湯けむりの中でぬくぬく育つ。'],
    ['enryu', 'エンリュウ', 'ほのおりゅう', '体の炎が赤から白へ変わる竜。怒ると岩がとける。', '火山のふもとを住みかにする。'],
    ['gouenryu', 'ゴウエンリュウ', 'ごうえんりゅう', '翼から炎を噴く大竜。ひと羽ばたきで峠の雪がとける。', '火山の主。百年に一度、火口で舞う。'],
  ],
});
line({
  plan: 'turtle', elements: ['tide', 'stone'], role: 'tank', habitat: 'しおかぜ街道', colors: ['#5ab08a', '#7a6a4a', '#e6f0d8', '#1a3a2a'], evo: [26, 44],
  members: [
    ['shiogame', 'シオガメ', 'しおがめ', '甲らに小さな貝がついた子ガメ。のんびり屋。', '波打ちぎわの岩場でひなたぼっこをする。'],
    ['uzugame', 'ウズガメ', 'うずがめ', '甲らのうずまき模様から水を噴く。重いが泳ぎは上手。', '岬のまわりをゆっくり回遊する。'],
    ['genbukai', 'ゲンブカイ', 'たいかいのかめ', '島のように大きな甲らをもつ海亀。背中に木が生えている。', '海の底で長い年月をねむり、時々浮かんでくる。'],
  ],
});
line({
  plan: 'beast', elements: ['stone', 'neutral'], role: 'tank', habitat: 'いしだたみ坂', colors: ['#9a8a7a', '#e8dcc0', '#c8b8a0', '#3a2a1a'], evo: [40, 52],
  members: [
    ['tsunodon', 'ツノドン', 'つのぼうず', '頭に小さな角がある、ずんぐりした子。頭突きが得意。', '坂道の石だたみを角でコツコツたたいて遊ぶ。'],
    ['gantodon', 'ガントドン', 'がんかくりゅう', '角が岩のように大きくなった。体当たりで岩壁を崩す。', '鉱山の奥で鉱石をかじって暮らす。'],
    ['ootsunodora', 'オオツノドラ', 'おおつのりゅう', '三本の大角をもつ岩の竜。よろいのような皮膚は傷つかない。', 'その角は山の守りとして祀られている。'],
  ],
});

// ───────────── 1回進化（18系統） ─────────────
line({ plan: 'blob', elements: ['neutral'], role: 'support', habitat: 'こもれび街道', colors: ['#f0c8e0', '#c06a9a', '#fff0f8', '#5a2a4a'], evo: [24], members: [
  ['munyu', 'ムニュ', 'もちもち', 'つつくとムニュッとへこむ、もちのような灯獣。', '日なたにのびて、ひらべったくなって眠る。'],
  ['munyugon', 'ムニュゴン', 'おおもちもち', '大きくふくらみ、体当たりではね返す。けっして怒らない。', '子どもたちのクッションがわりになることも。'],
] });
line({ plan: 'bird', elements: ['blaze', 'gale'], role: 'speed', habitat: 'ゆけむり峠', colors: ['#ff8a4a', '#d0300e', '#ffe0b0', '#2a1010'], evo: [32], members: [
  ['hibanadori', 'ヒバナドリ', 'ひばなどり', '羽ばたくと火花が散る小鳥。冬でもあたたかい。', '温泉宿の屋根にとまって湯けむりをながめる。'],
  ['homuradaka', 'ホムラダカ', 'ほむらだか', '炎の翼で空を焼き切る鷹。通ったあとに火の帯が残る。', '火山の上空をゆうゆうと旋回する。'],
] });
line({ plan: 'blob', elements: ['tide'], role: 'special', habitat: 'しおかぜ街道', colors: ['#a8d8f8', '#5a8ae0', '#e8f8ff', '#2a3a8a'], evo: [28], members: [
  ['pururu', 'プルル', 'みずくらげ', 'ぷるぷるのクラゲの子。波にゆられて夢を見る。', '月の明るい夜、入り江いっぱいに浮かぶ。'],
  ['pururine', 'プルリーヌ', 'しおのめがみ', 'ドレスのようなかさをもつクラゲ。光る触手で舞う。', '港の人は「海の舞姫」とよぶ。'],
] });
line({ plan: 'bug', elements: ['sprout'], role: 'support', habitat: 'こもれび街道', colors: ['#8ad06a', '#3a7a2a', '#e8f8d0', '#1a3a10'], evo: [22], members: [
  ['happamushi', 'ハッパムシ', 'はっぱいもむし', '葉っぱを毛布にして眠るイモムシ。食べるのも葉っぱ。', '街道の木の上でもぐもぐしている。'],
  ['midoriageha', 'ミドリアゲハ', 'みどりあげは', '若葉色の羽のアゲハ。りんぷんで草木を元気にする。', '花畑を見回るように飛ぶ。'],
] });
line({ plan: 'beast', elements: ['volt'], role: 'speed', habitat: 'かみなり平原', colors: ['#f6e06a', '#3a5ad0', '#fffbe0', '#1a1a3a'], evo: [34], members: [
  ['chirichiri', 'チリチリ', 'でんきねずみ', '毛が静電気でチリチリに立った子ねずみ。くしゃみで放電する。', '平原の巣穴で、雷の音を聞くとはしゃぐ。'],
  ['raijuu', 'ライジュウ', 'らいじゅう', '雷と一緒に落ちてくると言われる獣。走ると稲光が走る。', '嵐の夜、高い木の上で空を見上げている。'],
] });
line({ plan: 'blob', elements: ['stone'], role: 'tank', habitat: 'しおかぜ街道', colors: ['#c8b8e0', '#7a6a9a', '#f0e8f8', '#2a1a3a'], evo: [30], members: [
  ['katatsumu', 'カタツム', 'いしかたつむり', '石のからを背負ったカタツムリ。雨の日だけ元気。', '岩場の日かげで、ゆっくり進む。'],
  ['gantsumuri', 'ガンツムリ', 'ほうせきつむり', 'からが宝石の塔になったカタツムリ。光をはね返して守る。', 'そのからは、町の灯台の材料になったこともある。'],
] });
line({ plan: 'sprite', elements: ['gale'], role: 'speed', habitat: 'そよぎ高原', colors: ['#c8f0e0', '#3aa88a', '#ffffff', '#1a4a3a'], evo: [44], members: [
  ['kazenoko', 'カゼノコ', 'そよかぜのせい', 'くるくる回るつむじ風の精。帽子をとばすいたずら好き。', '高原の風車のまわりで遊ぶ。'],
  ['kazenomiko', 'カゼノミコ', 'かぜのみこ', '風の衣をまとう精。ひと舞いで嵐をしずめる。', '風車村の守り神として祀られている。'],
] });
line({ plan: 'fish', elements: ['shine', 'tide'], role: 'special', habitat: 'しおかぜ街道', colors: ['#d8e8ff', '#e8b83a', '#ffffff', '#1a2a6a'], evo: [34], members: [
  ['hoshiuo', 'ホシウオ', 'ほしうお', '背中に星の模様が光る小魚。夜の海で道しるべになる。', '流れ星の夜、群れで水面に集まる。'],
  ['hoshikujira', 'ホシクジラ', 'ほしくじら', '体いっぱいに星空をうつした鯨。潮吹きが光の雨になる。', '外海をゆったり旅している。'],
] });
line({ plan: 'bug', elements: ['shade'], role: 'attacker', habitat: 'たそがれ街道', colors: ['#4a3a5a', '#e0b03a', '#7a6a8a', '#ffd04a'], evo: [52], members: [
  ['yorubachi', 'ヨルバチ', 'よるばち', '夕方になると目をさますハチ。はねの音が子守歌に聞こえる。', '谷の古い木に、まんまるの巣をつくる。'],
  ['yomibachi', 'ヨミバチ', 'よみのじょおうばち', '闇色のよろいをまとう女王バチ。針から影の毒を放つ。', '谷の奥の巣を、群れで守りぬく。'],
] });
line({ plan: 'bird', elements: ['neutral'], role: 'balanced', habitat: 'こもれび街道', colors: ['#c89a6a', '#7a4a2a', '#fff0d8', '#2a1a10'], evo: [20], members: [
  ['chunta', 'チュンタ', 'まちすずめ', '町のどこにでもいる小鳥。パンくずを見つける名人。', '屋根の上でにぎやかにおしゃべりしている。'],
  ['chundaisho', 'チュンダイショウ', 'すずめのたいしょう', '胸をはって群れを率いる大すずめ。声がよく通る。', '町の広場の大木が住みか。'],
] });
line({ plan: 'golem', elements: ['blaze', 'stone'], role: 'tank', habitat: 'ゆけむり峠', colors: ['#6a4a3a', '#ff6a1a', '#3a2a20', '#ffd04a'], evo: [36], members: [
  ['kakougan', 'カコウガン', 'ようがんのこ', '冷えた溶岩のからだ。ひびの間から赤い光がもれる。', '火口のまわりで、あたたかい石を集めている。'],
  ['kazanou', 'カザンオウ', 'かざんのおう', '背中に小さな火山をのせた岩の王。噴火で炎をまき散らす。', '温泉郷の湯は、この灯獣のおかげで湧くという。'],
] });
line({ plan: 'serpent', elements: ['tide'], role: 'special', habitat: 'しおかぜ街道', colors: ['#3a8a9a', '#1a4a5a', '#c8f0f0', '#e0f04a'], evo: [30], members: [
  ['unari', 'ウナリ', 'うなりうなぎ', 'ひょろりと長いウナギの子。うなるような声で鳴く。', '河口の泥の中にすむ。'],
  ['oounari', 'オオウナリ', 'おおうなりりゅう', '海竜のように大きくなったウナギ。うなり声で波をおこす。', '港の沖で、船と並んで泳ぐこともある。'],
] });
line({ plan: 'beast', elements: ['sprout'], role: 'balanced', habitat: 'こもれび街道', colors: ['#a88a5a', '#5aa84a', '#f0e8d0', '#2a1a10'], evo: [26], members: [
  ['kokejika', 'コケジカ', 'こけじか', '背中にふかふかの苔が生えた子鹿。歩くと花が咲く。', '森の小道で、木もれ日をあびて草をはむ。'],
  ['morijika', 'モリジカ', 'もりのしか', '枝のような大角に葉がしげる鹿。森を守る番人。', '角に小鳥が巣をつくっても気にしない。'],
] });
line({ plan: 'fish', elements: ['volt'], role: 'special', habitat: 'かみなり平原', colors: ['#6a7ad0', '#f2d23a', '#e0e8ff', '#1a1a3a'], evo: [38], members: [
  ['shibireuo', 'シビレウオ', 'しびれうお', 'ひれから電気を流す小魚。水たまりでも平気。', '雷雨のあとの水たまりで見つかる。'],
  ['raikougyo', 'ライコウギョ', 'らいこうぎょ', '体じゅうに稲妻が走る大魚。水面をはねると雷鳴がとどろく。', '平原の大きな湖の主。'],
] });
line({ plan: 'bug', elements: ['gale'], role: 'speed', habitat: 'かみなり平原', colors: ['#7ad0e0', '#2a6a8a', '#e8fbff', '#0a2a3a'], evo: [36], members: [
  ['tonbon', 'トンボン', 'こかぜとんぼ', 'まんまるの目のトンボの子。宙返りが得意。', '平原の水辺を行ったり来たりしている。'],
  ['hayatenbo', 'ハヤテンボ', 'はやてとんぼ', '四枚の羽で風よりも速く飛ぶ。目にもとまらない。', '高原を吹く風にのって旅をする。'],
] });
line({ plan: 'beast', elements: ['shine'], role: 'special', habitat: 'そよぎ高原', colors: ['#f8f4ff', '#c8a8f0', '#ffffff', '#6a3ab0'], evo: [46], members: [
  ['tsukiusa', 'ツキウサ', 'つきうさぎ', '耳の先が三日月の形をしたウサギ。満月の夜ははねまわる。', '高原の丘で、月を見上げて暮らす。'],
  ['gekkouusa', 'ゲッコウウサ', 'げっこうのうさぎ', '月の光をまとうウサギ。跳ねるたびに光の輪がひろがる。', '神殿の屋根の上で、月を守っているという。'],
] });
line({ plan: 'sprite', elements: ['shade'], role: 'special', habitat: 'たそがれ街道', colors: ['#6a5a9a', '#2a1a4a', '#c8c0e8', '#e04af0'], evo: [50], members: [
  ['yurari', 'ユラリ', 'ゆらめきび', 'ゆらゆら揺れる影の火の玉。おどかすのが好き。', '夕暮れの墓地や古い橋の下に現れる。'],
  ['yurameki', 'ユラメキ', 'かげのまいて', '影の衣をひるがえす精。舞うたびに灯がまたたく。', '谷の祭りの夜、どこからともなく現れる。'],
] });
line({ plan: 'bird', elements: ['stone', 'gale'], role: 'tank', habitat: 'いしだたみ坂', colors: ['#8a8a9a', '#4a4a5a', '#d8d8e0', '#ff6a2a'], evo: [42], members: [
  ['katabane', 'カタバネ', 'いしばねどり', '石のように固い羽をもつ小鳥。飛ぶのは少しにがて。', '崖の岩の割れ目に巣をつくる。'],
  ['gantsubasa', 'ガンツバサ', 'がんせきのつばさ', '岩の翼で嵐を切りさく大鳥。羽ばたきで小石が舞う。', '鉱山の上空を見張っている。'],
] });

// ───────────── 進化なし（8系統） ─────────────
line({ plan: 'golem', elements: ['neutral'], role: 'balanced', habitat: 'いしだたみ坂', colors: ['#d8c8a8', '#a8743a', '#f8f0e0', '#3a2a1a'], members: [
  ['karakuriko', 'カラクリコ', 'からくりにんぎょう', '昔の職人が作った人形に灯がやどった。歯車の音で話す。', '町の古い時計塔にすみついている。'],
] });
line({ plan: 'sprite', elements: ['blaze'], role: 'special', habitat: 'ゆけむり峠', colors: ['#ffb04a', '#e0501a', '#fff4d0', '#a8200c'], members: [
  ['okibi', 'オキビ', 'おきびのせい', '消えかけた炭火に宿る精。そっと息をふきかけると目をさます。', '温泉宿のいろりの中で、夜通し番をする。'],
] });
line({ plan: 'fish', elements: ['tide', 'shade'], role: 'tank', habitat: 'ほしぞらの橋', colors: ['#2a3a5a', '#4af0e0', '#5a6a8a', '#4af0e0'], members: [
  ['shinkai', 'シンカイ', 'しんかいのあかり', '頭のちょうちんで深い海を照らす魚。光で獲物をさそう。', '星空の橋の下の、深い海峡にすむ。'],
] });
line({ plan: 'golem', elements: ['volt'], role: 'attacker', habitat: 'かみなり平原', colors: ['#e0c84a', '#5a5a6a', '#fff4b0', '#1a1a2a'], members: [
  ['raibou', 'ライボウ', 'らいじんのぼう', '雷が落ちた木の棒に灯がやどった。ふり回すと稲妻が出る。', '平原にぽつんと立ち、雷を待っている。'],
] });
line({ plan: 'beast', elements: ['gale', 'shade'], role: 'speed', habitat: 'そよぎ高原', colors: ['#c8d8d0', '#3a4a4a', '#ffffff', '#e03a3a'], members: [
  ['kamaitachi', 'カマイタチ', 'かぜかまいたち', 'つむじ風にのって現れるイタチ。ツメは風の刃。', '高原の風の強い日、草がいっせいに切れていたら近くにいる。'],
] });
line({ plan: 'bird', elements: ['shine', 'gale'], role: 'support', habitat: 'あさぎりの道', colors: ['#fffae0', '#f0c84a', '#ffffff', '#c86a1a'], members: [
  ['mikotori', 'ミコトリ', 'あさぎりのことり', '朝霧の中だけで歌う金色の鳥。歌を聞くと一日元気でいられる。', 'あけぼの神殿の鐘楼にすむ。'],
] });
line({ plan: 'sprite', elements: ['shade', 'neutral'], role: 'support', habitat: 'たそがれ街道', colors: ['#3a3a4a', '#8a8aa8', '#5a5a6a', '#f0f04a'], members: [
  ['kageboushi', 'カゲボウシ', 'かげぼうし', '人の影法師が灯をもった灯獣。持ち主のまねをしてついてくる。', '夕方、長くのびた影の中にまぎれている。'],
] });
line({
  plan: 'serpent', elements: ['shade'], role: 'special', habitat: '黒霞の洞窟の最奥', colors: ['#1a1424', '#7a2ad0', '#3a2a4a', '#ff3a6a'], rarity: 'boss', total: 640,
  members: [['tokoyonoyami', 'トコヨノヤミ', 'とこよのやみ', '黒霞の源。島じゅうの灯を飲みこみ、明けない夜をつくろうとしている。', '静夜団が洞窟の奥で目ざめさせた。夜明けの獣と対になる存在だという。']],
});


// ───────────── さいはて諸島（2回目のトコヨノヤミを倒した後の 追加エリア）だけに すむ灯獣 ─────────────
// 2026-11-06 本人決定：追加エリアでしか野生で出ない灯獣＋チョンボの進化先ボッキー（species.ts）＋最後のボス（Lv100）。
// 野生は Lv80〜96 なので、進化レベルも高め（2回進化 84/90・1回進化 88）。能力も 本編より ひとまわり高い。
dex = 102; // 101 は ボッキー
const ISLE3 = [360, 480, 580];
const ISLE2 = [380, 560];
const ISLE1 = 540;
const R1 = 'ささなみ海岸';
const R2 = 'いにしえの樹海';
const R3 = 'こおりかぜ峠';
const R4 = 'ながれぼし原';
const R5 = 'さいはての灯台';

// 2回進化（7系統）
line({ plan: 'beast', elements: ['tide', 'shade'], role: 'attacker', habitat: R1, colors: ['#7ab8d8', '#2a4a7a', '#eaf6ff', '#0a2040'], evo: [84, 90], totals: ISLE3, members: [
  ['shiokoma', 'シオコマ', 'しおこうま', '波打ちぎわを はねまわる 子馬。たてがみが 白い しぶきで できている。', '満ち潮の 夜明けに、浜を かけぬける。'],
  ['namikake', 'ナミカケ', 'なみかけうま', '波の上を 走る馬。ひづめが 水面を たたくたびに 渦が うまれる。', '嵐の 前ぶれに、群れで 沖へ 向かう。'],
  ['kaijinba', 'カイジンバ', 'うみがみのうま', '海の神を 乗せたという 大馬。たてがみの 渦潮で 船を 守る。', 'さいはて諸島の 漁師は、船の先に この馬の 像を かざる。'],
] });
line({ plan: 'plant', elements: ['sprout', 'shade'], role: 'special', habitat: R2, colors: ['#5a8a4a', '#2a3a2a', '#d8e8c0', '#c8ff6a'], evo: [84, 90], totals: ISLE3, members: [
  ['kokebou', 'コケボウ', 'こけぼうず', '苔の かさを かぶった 小さな 坊や。木の かげで うとうと している。', '樹海の 倒木の 上で、霧が 晴れるのを 待つ。'],
  ['tsutamatoi', 'ツタマトイ', 'つたまとい', 'つたを 衣のように まとう 灯獣。近づいた ものに つたを からめる。', '日の 当たらない 樹海の 奥で、ゆっくり 根を はる。'],
  ['jureishin', 'ジュレイシン', 'じゅれいのぬし', '千年の 樹の 魂が 宿った 大樹の 主。枝の 一ふりで 森が ざわめく。', '樹海の いちばん 古い 木と ひとつに なって ねむる。'],
] });
line({ plan: 'golem', elements: ['stone', 'gale'], role: 'tank', habitat: R3, colors: ['#c8d8e8', '#5a7a9a', '#f4f8ff', '#1a2a4a'], evo: [84, 90], totals: ISLE3, members: [
  ['kirarin', 'キラリン', 'きららいし', '雲母の かけらが あつまった 灯獣。風が ふくと きらきら 鳴る。', '峠の 岩かげで、冷たい 風に みがかれている。'],
  ['hyougan', 'ヒョウガン', 'ひょうがんびと', '氷のように すきとおった 岩の からだ。吹雪の 中でも 動じない。', '峠の 見はり番として、旅人を 遠くから 見守る。'],
  ['gousetsuou', 'ゴウセツオウ', 'ごうせつのおう', '雪山を 背負う 岩の 王。ひと息で 峠に 吹雪を よぶ。', 'こおりかぜ峠の 頂に、何百年も すわっているという。'],
] });
line({ plan: 'bird', elements: ['shine', 'gale'], role: 'speed', habitat: R4, colors: ['#f0f4ff', '#6a7ad8', '#ffffff', '#ffd84a'], evo: [84, 90], totals: ISLE3, members: [
  ['kirahina', 'キラヒナ', 'ほしのひな', '星の 光を あびて 生まれた ひな鳥。羽の 先が ちかちか 光る。', '流れ星の 夜、草原に そっと 降りてくる。'],
  ['ryuuseichou', 'リュウセイチョウ', 'りゅうせいどり', '流れ星のように 夜空を かける鳥。通ったあとに 光の 線が のこる。', '星の 多い 夜ほど 速く 飛ぶ。'],
  ['seiranou', 'セイランオウ', 'せいらんのおう', '星の 嵐を まとう 大鳥。はばたくと 夜空の 星が ふるえる。', 'ながれぼし原の 空の 主。見た者は 願いが かなうという。'],
] });
line({ plan: 'serpent', elements: ['volt', 'tide'], role: 'special', habitat: R1, colors: ['#4a6ad0', '#f2e23a', '#d8e4ff', '#fff04a'], evo: [84, 90], totals: ISLE3, members: [
  ['biriuna', 'ビリウナ', 'でんきうなぎ', '電気を ためこむ 小さな うなぎ。おどろくと ピリッと 光る。', '岩の すきまに かくれて、波の 音を 聞いている。'],
  ['raija', 'ライジャ', 'らいじゃ', '稲妻の もようが 走る 海の 大蛇。雷雨の 海で あばれる。', '雷が 落ちた 海に、どこからともなく 現れる。'],
  ['raiunja', 'ライウンジャ', 'らいうんのおろち', '雷雲を まとって 海を わたる 大蛇。目が 光ると 稲妻が 落ちる。', '嵐の 中心に すみ、海を 鎮めも 荒らしも するという。'],
] });
line({ plan: 'bug', elements: ['blaze', 'shade'], role: 'attacker', habitat: R2, colors: ['#3a2a3a', '#ff6a2a', '#5a4050', '#ffb03a'], evo: [84, 90], totals: ISLE3, members: [
  ['homuramushi', 'ホムラムシ', 'ほむらいもむし', 'せなかに 小さな 火を ともす イモムシ。夜道を 照らして 歩く。', '樹海の 暗がりで、落ち葉を あたためている。'],
  ['homurayanma', 'ホムラヤンマ', 'ほむらやんま', '炎の 羽を もつ 大トンボ。暗い 森を 赤く 染めて 飛ぶ。', '夜の 樹海を 見回り、迷子を 外へ みちびく。'],
  ['gouenyanma', 'ゴウエンヤンマ', 'ごうえんやんま', '黒い 炎を まとう トンボの 王。羽音で 木々が 燃えあがる。', '樹海の 奥の 火の 池の まわりを、ぐるぐると 飛ぶ。'],
] });
line({ plan: 'beast', elements: ['neutral', 'shine'], role: 'balanced', habitat: R5, colors: ['#f4ece0', '#d8a84a', '#ffffff', '#6a4a1a'], evo: [84, 90], totals: ISLE3, members: [
  ['yukiten', 'ユキテン', 'ゆきてん', '雪のように 白い 小さな テン。光る しっぽを ふって あいさつする。', '灯台の 石段で、灯の 番人の まねを している。'],
  ['ginten', 'ギンテン', 'ぎんてん', '銀色に かがやく 毛並みの テン。すばやく 灯台を かけのぼる。', '灯台の 灯が 消えないよう、夜通し 見回る。'],
  ['ougonten', 'オウゴンテン', 'おうごんてん', '金色の 光を まとう テンの 王。ひと声で 灯台の 灯が 強く なる。', 'さいはての灯台の 守り神として、古くから まつられている。'],
] });

// 1回進化（11系統）
line({ plan: 'blob', elements: ['tide'], role: 'support', habitat: R1, colors: ['#c8f0ff', '#4ab0e0', '#ffffff', '#1a4a8a'], evo: [88], totals: ISLE2, members: [
  ['awatama', 'アワタマ', 'あわだま', 'しゃぼんのような 泡の からだ。ふれると ぽよんと はねる。', '波の 泡から 生まれ、浜で ころころ 転がる。'],
  ['awamiko', 'アワミコ', 'あわのみこ', '泡の 衣を まとう 海の 巫女。泡で 傷を 包んで いやす。', '月の 夜、入り江で 泡の 舞を 舞う。'],
] });
line({ plan: 'fish', elements: ['stone', 'tide'], role: 'tank', habitat: R1, colors: ['#8a7a6a', '#c86a3a', '#e8dcc8', '#2a1a10'], evo: [88], totals: ISLE2, members: [
  ['gotsufugu', 'ゴツフグ', 'ごつごつふぐ', '石のような うろこの ふぐ。おこると とげとげに ふくらむ。', '岩場の 潮だまりで、じっと 身を ひそめる。'],
  ['gansekifugu', 'ガンセキフグ', 'がんせきふぐ', '岩山のように ふくれる 大ふぐ。ぶつかった 船が はね返される。', '外海の 岩礁を、ゆっくり 泳いで まわる。'],
] });
line({ plan: 'bird', elements: ['shade', 'gale'], role: 'speed', habitat: R3, colors: ['#2a2a3a', '#6a5a9a', '#4a4a5a', '#e03a5a'], evo: [88], totals: ISLE2, members: [
  ['yogarasu', 'ヨガラス', 'よるがらす', '夜の 色の 小さな からす。光る ものを 集めるのが 好き。', '峠の 古い 小屋の 屋根に、宝物を かくしている。'],
  ['yomigarasu', 'ヨミガラス', 'よみがらす', '影の 翼を 広げる 大がらす。鳴き声で 吹雪が やむ。', '峠の 上空を、群れで 円を えがいて 飛ぶ。'],
] });
line({ plan: 'sprite', elements: ['volt'], role: 'special', habitat: R4, colors: ['#fff6a0', '#e0a01a', '#ffffff', '#3a2a8a'], evo: [88], totals: ISLE2, members: [
  ['pachirin', 'パチリン', 'ぱちぱちのせい', 'ぱちぱち はじける 火花の 精。おどろくと 光って 消える。', '流れ星の 夜、草の 先で 小さく 光る。'],
  ['raimeisei', 'ライメイセイ', 'らいめいのせい', '雷鳴を あやつる 精。手を たたくと 空に 稲妻が 走る。', '雷雲の 上で、星と おしゃべりを している。'],
] });
line({ plan: 'beast', elements: ['blaze'], role: 'attacker', habitat: R3, colors: ['#a8502a', '#ff8a3a', '#f0c8a0', '#2a1008'], evo: [88], totals: ISLE2, members: [
  ['honoguma', 'ホノグマ', 'ほのおぐま', 'からだが ぽかぽか あたたかい 子ぐま。雪の 上でも 平気。', '峠の ほら穴で、たき火の 番を している。'],
  ['kaenguma', 'カエングマ', 'かえんぐま', '毛並みが 炎に なった 大ぐま。ほえると 雪が とけて 川に なる。', '峠の 雪どけは、この灯獣の 目ざめの 合図。'],
] });
line({ plan: 'golem', elements: ['neutral'], role: 'tank', habitat: R5, colors: ['#c88a5a', '#7a4a2a', '#f0d0a8', '#1a1008'], evo: [88], totals: ISLE2, members: [
  ['haniwan', 'ハニワン', 'はにわのこ', '土で できた 人形に 灯が 宿った。ころぶと ころころ 転がる。', '灯台の 地下の 古い 部屋で 見つかった。'],
  ['haniwaou', 'ハニワオウ', 'はにわのおう', '大きな 土の 王さま。ひと足ごとに 地面が ゆれる。', '灯台を 建てた 昔の 人々を 守っていたという。'],
] });
line({ plan: 'bug', elements: ['stone'], role: 'tank', habitat: R2, colors: ['#7a7a8a', '#3a3a4a', '#c8c8d0', '#ff4a2a'], evo: [88], totals: ISLE2, members: [
  ['ishidango', 'イシダンゴ', 'いしだんごむし', 'さわると まるくなる 石の だんごむし。ころがって にげる。', '樹海の 落ち葉の 下で、なかよく 集まっている。'],
  ['gandango', 'ガンダンゴ', 'がんせきだんご', '岩の よろいを 重ねた 大だんごむし。まるくなると 何も 通さない。', '樹海の 道を、ごろごろ 転がって 進む。'],
] });
line({ plan: 'serpent', elements: ['gale', 'sprout'], role: 'speed', habitat: R4, colors: ['#8ad8a8', '#2a8a5a', '#e8fff0', '#0a3a2a'], evo: [88], totals: ISLE2, members: [
  ['tsumujihebi', 'ツムジヘビ', 'つむじへび', 'つむじ風を まとう 小さな へび。くるくる 回って 草を ゆらす。', '草原の 風の 通り道に すむ。'],
  ['tatsumakija', 'タツマキジャ', 'たつまきじゃ', '竜巻を 起こす 大蛇。草原の 草が いっせいに 空へ 舞う。', '大風の 日、草原の まん中で 空を 見上げている。'],
] });
line({ plan: 'plant', elements: ['blaze', 'sprout'], role: 'special', habitat: R2, colors: ['#e84a4a', '#4a8a3a', '#ffe0d0', '#fff04a'], evo: [88], totals: ISLE2, members: [
  ['hiirosou', 'ヒイロソウ', 'ひいろそう', '火の色の 花を さかせる 草の 子。花びらが ほんのり あたたかい。', '樹海の 日だまりで、ひっそり さいている。'],
  ['hiirokagura', 'ヒイロカグラ', 'ひいろかぐら', '燃える 花の 衣で 舞う 灯獣。舞の あとには 花が 咲く。', '樹海の 祭りの 夜にだけ 姿を 見せる。'],
] });
line({ plan: 'turtle', elements: ['shade', 'stone'], role: 'tank', habitat: R5, colors: ['#3a3a4a', '#8a6ad0', '#5a5a6a', '#e0c84a'], evo: [88], totals: ISLE2, members: [
  ['yamikoura', 'ヤミコウラ', 'やみこうら', '甲らに 夜空を うつした 子ガメ。暗い ところが 落ちつく。', '灯台の 地下の 水たまりで、のんびり 暮らす。'],
  ['yominokoura', 'ヨミノコウラ', 'よみのこうら', '闇の 甲らを 背負う 大ガメ。甲らの 中に 小さな 夜が ある。', '灯台の いちばん 下で、灯を 支えているという。'],
] });
line({ plan: 'fish', elements: ['shine', 'volt'], role: 'special', habitat: R4, colors: ['#e8f0ff', '#4ad0f0', '#ffffff', '#ffd04a'], evo: [88], totals: ISLE2, members: [
  ['kiramedaka', 'キラメダカ', 'きらめだか', '光る 小さな 魚。群れで 泳ぐと 川が 星空に なる。', '草原の 小川で、流れ星を 追いかける。'],
  ['seikougyo', 'セイコウギョ', 'せいこうぎょ', '星の 光と 稲妻を まとう 大魚。はねると 空に 光の 橋が かかる。', 'ながれぼし原の 湖の 主。'],
] });

// 進化なし（6系統）
line({ plan: 'sprite', elements: ['shine'], role: 'support', habitat: R5, colors: ['#fff8d8', '#f0b84a', '#ffffff', '#c06a10'], total: ISLE1, members: [
  ['miakashi', 'ミアカシ', 'みあかしのせい', '灯台の 灯から 生まれた 精。そばに いると 心が 明るくなる。', 'さいはての灯台の 最上階で、灯を 見守っている。'],
] });
line({ plan: 'golem', elements: ['volt', 'stone'], role: 'attacker', habitat: R3, colors: ['#8a8a6a', '#ffe03a', '#d8d8b0', '#1a1a0a'], total: ISLE1, members: [
  ['raiseki', 'ライセキ', 'らいせき', '雷が 落ちた 岩に 灯が 宿った。からだの すじに 電気が 走る。', '峠の 頂で、次の 雷を 待っている。'],
] });
line({ plan: 'beast', elements: ['shade', 'neutral'], role: 'speed', habitat: R5, colors: ['#3a3048', '#c8c0e0', '#5a5068', '#ffe04a'], total: ISLE1, members: [
  ['kuromata', 'クロマタ', 'ふたまたねこ', 'しっぽが 二つに 分かれた 黒ねこ。足音を たてずに 歩く。', '灯台の らせん階段で、旅人を からかって 遊ぶ。'],
] });
line({ plan: 'bird', elements: ['tide', 'gale'], role: 'speed', habitat: R1, colors: ['#e8f4ff', '#3a7ad0', '#ffffff', '#1a2a4a'], total: ISLE1, members: [
  ['okitsudori', 'オキツドリ', 'おきつどり', '沖の 風に のって 旅する 海鳥。羽ばたきで 波を 切る。', '島から 島へ、手紙を 運ぶと 言われている。'],
] });
line({ plan: 'blob', elements: ['blaze'], role: 'special', habitat: R3, colors: ['#ff7a3a', '#c8200a', '#ffd0a0', '#3a0a00'], total: ISLE1, members: [
  ['magumamochi', 'マグマモチ', 'ようがんもち', 'ぐつぐつ にえる もちのような 灯獣。さわると あつあつ。', '峠の 地熱の わく 岩場で、ぷくーっと ふくらむ。'],
] });
line({ plan: 'serpent', elements: ['sprout', 'stone'], role: 'tank', habitat: R2, colors: ['#7a5a3a', '#4a8a3a', '#d8c8a8', '#ffd04a'], total: ISLE1, members: [
  ['nekkoja', 'ネッコジャ', 'ねっこじゃ', '木の 根っこが 大蛇に なった 灯獣。地面の 下を すすむ。', '樹海の 大樹の 根元を、ぐるりと まいて ねむる。'],
] });

// 最後のボス（Lv100）
line({
  plan: 'serpent', elements: ['shine', 'shade'], role: 'special', habitat: 'さいはての灯台の 最上階', colors: ['#f0e8ff', '#2a1a4a', '#c8b8e8', '#ffd84a'], rarity: 'boss', total: 720,
  members: [['hatenonushi', 'ハテノヌシ', 'さいはてのぬし', '光と 闇の 両方を まとう、さいはて諸島の 主。灯台の 灯は この灯獣の 心臓だという。', 'トコヨノヤミが 二度 鎮められた時、さいはての灯台の 上で 目をさました。']],
});

// ボスは専用技を持つ
const boss = out.find((s) => s.id === 'tokoyonoyami')!;
boss.learnset = [[1, 'tokoyo_night'], [1, 'abyss'], [1, 'night_claw'], [1, 'quiet_heart']];
const isleBoss = out.find((s) => s.id === 'hatenonushi')!;
isleBoss.learnset = [[1, 'hate_no_hikari'], [1, 'abyss'], [1, 'sunrise'], [1, 'dawn_prayer']];

export const EXTRA_SPECIES: SpeciesDef[] = out;
