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
  const totals = n === 3 ? [310, 425, 530] : n === 2 ? [330, 495] : [d.total ?? 480];
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

// ボスは専用技を持つ
const boss = out.find((s) => s.id === 'tokoyonoyami')!;
boss.learnset = [[1, 'tokoyo_night'], [1, 'abyss'], [1, 'night_claw'], [1, 'quiet_heart']];

export const EXTRA_SPECIES: SpeciesDef[] = out;
