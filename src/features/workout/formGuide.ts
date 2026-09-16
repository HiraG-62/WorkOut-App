/**
 * 種目のフォーム図（棒人間の2ポーズ）とポイント。
 * 図は横から見た姿勢を 120x80 の座標で表す。y=72 が床。
 */

export type Point = [number, number]

export interface Pose {
  head: Point
  neck: Point
  hip: Point
  /** 脚（複数本描ける。2本目は薄く描く） */
  legs: { knee: Point; ankle: Point }[]
  /** 腕 */
  arms: { elbow: Point; hand: Point }[]
}

export interface Prop {
  kind: 'ground' | 'bar' | 'wall' | 'bench' | 'box'
  /** 線分または矩形 */
  from: Point
  to: Point
}

export interface FormFigure {
  /** 動きの前後 2 ポーズ。1 つならキープ系 */
  poses: Pose[]
  props: Prop[]
}

export const FORM_FAMILIES = {
  pushup: '腕立て',
  pushup_knee: '膝つき腕立て',
  pushup_wall: '壁腕立て',
  pike_pushup: 'パイクプッシュ',
  handstand: '壁倒立',
  pullup: '懸垂',
  row: '斜め懸垂',
  superman: 'スーパーマン',
  deadhang: 'ぶら下がり',
  squat: 'スクワット',
  lunge: 'ランジ',
  bulgarian: 'ブルガリアン',
  pistol: 'ピストル',
  jump_squat: 'ジャンプ',
  glute_bridge: 'ヒップリフト',
  calf_raise: 'カーフレイズ',
  wall_sit: '空気椅子',
  plank: 'プランク',
  side_plank: 'サイドプランク',
  crunch: 'クランチ',
  leg_raise: 'レッグレイズ',
  hanging_leg_raise: 'ハンギングレッグレイズ',
  mountain_climber: 'マウンテンクライマー',
  hollow: 'ホロー',
  dips: 'ディップス',
  bench_dips: 'ベンチディップス',
  burpee: 'バーピー',
  jumping_jack: 'ジャンピングジャック',
} as const
export type FormFamily = keyof typeof FORM_FAMILIES

const GROUND: Prop = { kind: 'ground', from: [4, 72], to: [116, 72] }

/** 立位の基本形（右向き） */
const STAND: Pose = {
  head: [60, 14],
  neck: [60, 22],
  hip: [60, 44],
  legs: [{ knee: [60, 58], ankle: [60, 72] }],
  arms: [{ elbow: [60, 33], hand: [60, 44] }],
}

export const FIGURES: Record<FormFamily, FormFigure> = {
  pushup: {
    props: [GROUND],
    poses: [
      { head: [96, 40], neck: [88, 44], hip: [50, 56], legs: [{ knee: [30, 62], ankle: [10, 70] }], arms: [{ elbow: [88, 58], hand: [88, 72] }] },
      { head: [96, 56], neck: [88, 60], hip: [50, 66], legs: [{ knee: [30, 68], ankle: [10, 70] }], arms: [{ elbow: [74, 68], hand: [88, 72] }] },
    ],
  },
  pushup_knee: {
    props: [GROUND],
    poses: [
      { head: [96, 40], neck: [88, 44], hip: [52, 58], legs: [{ knee: [36, 72], ankle: [16, 66] }], arms: [{ elbow: [88, 58], hand: [88, 72] }] },
      { head: [96, 56], neck: [88, 60], hip: [52, 66], legs: [{ knee: [36, 72], ankle: [16, 66] }], arms: [{ elbow: [74, 68], hand: [88, 72] }] },
    ],
  },
  pushup_wall: {
    props: [GROUND, { kind: 'wall', from: [100, 8], to: [100, 72] }],
    poses: [
      { head: [58, 14], neck: [60, 22], hip: [66, 46], legs: [{ knee: [70, 60], ankle: [74, 72] }], arms: [{ elbow: [80, 30], hand: [100, 34] }] },
      { head: [82, 16], neck: [82, 24], hip: [76, 48], legs: [{ knee: [74, 60], ankle: [74, 72] }], arms: [{ elbow: [72, 40], hand: [100, 34] }] },
    ],
  },
  pike_pushup: {
    props: [GROUND],
    poses: [
      { head: [76, 46], neck: [74, 40], hip: [56, 20], legs: [{ knee: [42, 46], ankle: [28, 72] }], arms: [{ elbow: [84, 56], hand: [90, 72] }] },
      { head: [84, 64], neck: [80, 54], hip: [58, 24], legs: [{ knee: [42, 48], ankle: [28, 72] }], arms: [{ elbow: [70, 64], hand: [90, 72] }] },
    ],
  },
  handstand: {
    props: [GROUND, { kind: 'wall', from: [80, 6], to: [80, 72] }],
    poses: [
      { head: [62, 62], neck: [62, 54], hip: [66, 30], legs: [{ knee: [70, 18], ankle: [76, 6] }], arms: [{ elbow: [62, 64], hand: [62, 72] }] },
      { head: [62, 66], neck: [62, 58], hip: [66, 32], legs: [{ knee: [70, 20], ankle: [76, 8] }], arms: [{ elbow: [48, 66], hand: [62, 72] }] },
    ],
  },
  pullup: {
    props: [{ kind: 'bar', from: [30, 8], to: [90, 8] }],
    poses: [
      { head: [60, 26], neck: [60, 34], hip: [60, 54], legs: [{ knee: [58, 64], ankle: [60, 74] }], arms: [{ elbow: [60, 20], hand: [60, 8] }] },
      { head: [60, 12], neck: [60, 20], hip: [60, 42], legs: [{ knee: [56, 56], ankle: [60, 68] }], arms: [{ elbow: [66, 26], hand: [60, 8] }] },
    ],
  },
  row: {
    props: [GROUND, { kind: 'bar', from: [40, 30], to: [80, 30] }],
    poses: [
      { head: [74, 50], neck: [68, 52], hip: [44, 60], legs: [{ knee: [30, 62], ankle: [18, 70] }], arms: [{ elbow: [66, 42], hand: [64, 30] }] },
      { head: [76, 36], neck: [70, 40], hip: [46, 56], legs: [{ knee: [30, 62], ankle: [18, 70] }], arms: [{ elbow: [56, 46], hand: [64, 30] }] },
    ],
  },
  superman: {
    props: [GROUND],
    poses: [
      { head: [104, 66], neck: [96, 66], hip: [58, 66], legs: [{ knee: [40, 66], ankle: [22, 66] }], arms: [{ elbow: [106, 64], hand: [116, 62] }] },
      { head: [104, 56], neck: [96, 58], hip: [58, 66], legs: [{ knee: [40, 62], ankle: [22, 56] }], arms: [{ elbow: [106, 52], hand: [116, 46] }] },
    ],
  },
  deadhang: {
    props: [{ kind: 'bar', from: [30, 8], to: [90, 8] }],
    poses: [{ head: [60, 28], neck: [60, 36], hip: [60, 56], legs: [{ knee: [60, 66], ankle: [60, 76] }], arms: [{ elbow: [60, 22], hand: [60, 8] }] }],
  },
  squat: {
    props: [GROUND],
    poses: [
      STAND,
      { head: [66, 26], neck: [64, 34], hip: [46, 52], legs: [{ knee: [66, 58], ankle: [60, 72] }], arms: [{ elbow: [78, 40], hand: [90, 38] }] },
    ],
  },
  lunge: {
    props: [GROUND],
    poses: [
      { head: [60, 14], neck: [60, 22], hip: [60, 44], legs: [{ knee: [74, 56], ankle: [80, 72] }, { knee: [46, 60], ankle: [36, 72] }], arms: [{ elbow: [60, 33], hand: [60, 44] }] },
      { head: [60, 26], neck: [60, 34], hip: [60, 54], legs: [{ knee: [80, 58], ankle: [80, 72] }, { knee: [42, 72], ankle: [26, 66] }], arms: [{ elbow: [60, 44], hand: [60, 54] }] },
    ],
  },
  bulgarian: {
    props: [GROUND, { kind: 'bench', from: [14, 54], to: [34, 72] }],
    poses: [
      { head: [64, 14], neck: [64, 22], hip: [62, 44], legs: [{ knee: [70, 58], ankle: [72, 72] }, { knee: [46, 56], ankle: [28, 54] }], arms: [{ elbow: [64, 33], hand: [64, 44] }] },
      { head: [66, 26], neck: [66, 34], hip: [60, 54], legs: [{ knee: [76, 58], ankle: [72, 72] }, { knee: [42, 66], ankle: [28, 54] }], arms: [{ elbow: [66, 44], hand: [66, 54] }] },
    ],
  },
  pistol: {
    props: [GROUND],
    poses: [
      { head: [60, 14], neck: [60, 22], hip: [58, 44], legs: [{ knee: [60, 58], ankle: [60, 72] }, { knee: [74, 46], ankle: [88, 48] }], arms: [{ elbow: [72, 30], hand: [84, 30] }] },
      { head: [66, 34], neck: [64, 42], hip: [48, 60], legs: [{ knee: [66, 58], ankle: [60, 72] }, { knee: [70, 62], ankle: [90, 62] }], arms: [{ elbow: [80, 46], hand: [94, 44] }] },
    ],
  },
  jump_squat: {
    props: [GROUND],
    poses: [
      { head: [66, 30], neck: [64, 38], hip: [46, 54], legs: [{ knee: [66, 60], ankle: [60, 72] }], arms: [{ elbow: [78, 44], hand: [90, 42] }] },
      { head: [60, 6], neck: [60, 14], hip: [60, 34], legs: [{ knee: [58, 46], ankle: [56, 56] }], arms: [{ elbow: [62, 8], hand: [66, 0] }] },
    ],
  },
  glute_bridge: {
    props: [GROUND],
    poses: [
      { head: [104, 66], neck: [96, 66], hip: [64, 66], legs: [{ knee: [50, 50], ankle: [40, 72] }], arms: [{ elbow: [88, 68], hand: [80, 72] }] },
      { head: [104, 66], neck: [96, 64], hip: [66, 46], legs: [{ knee: [50, 46], ankle: [40, 72] }], arms: [{ elbow: [88, 68], hand: [80, 72] }] },
    ],
  },
  calf_raise: {
    props: [GROUND],
    poses: [
      STAND,
      { head: [60, 8], neck: [60, 16], hip: [60, 38], legs: [{ knee: [60, 52], ankle: [60, 66] }], arms: [{ elbow: [60, 27], hand: [60, 38] }] },
    ],
  },
  wall_sit: {
    props: [GROUND, { kind: 'wall', from: [40, 8], to: [40, 72] }],
    poses: [{ head: [46, 18], neck: [44, 26], hip: [44, 48], legs: [{ knee: [66, 48], ankle: [66, 72] }], arms: [{ elbow: [46, 38], hand: [50, 48] }] }],
  },
  plank: {
    props: [GROUND],
    poses: [{ head: [98, 48], neck: [90, 50], hip: [52, 58], legs: [{ knee: [32, 63], ankle: [12, 70] }], arms: [{ elbow: [94, 72], hand: [108, 72] }] }],
  },
  side_plank: {
    props: [GROUND],
    poses: [{ head: [98, 34], neck: [90, 40], hip: [56, 56], legs: [{ knee: [34, 64], ankle: [12, 72] }], arms: [{ elbow: [90, 72], hand: [104, 72] }, { elbow: [96, 26], hand: [102, 12] }] }],
  },
  crunch: {
    props: [GROUND],
    poses: [
      { head: [104, 66], neck: [96, 66], hip: [62, 66], legs: [{ knee: [48, 48], ankle: [36, 72] }], arms: [{ elbow: [100, 58], hand: [108, 60] }] },
      { head: [98, 50], neck: [92, 56], hip: [62, 66], legs: [{ knee: [48, 48], ankle: [36, 72] }], arms: [{ elbow: [96, 44], hand: [104, 46] }] },
    ],
  },
  leg_raise: {
    props: [GROUND],
    poses: [
      { head: [104, 66], neck: [96, 66], hip: [62, 66], legs: [{ knee: [42, 62], ankle: [22, 60] }], arms: [{ elbow: [84, 68], hand: [72, 70] }] },
      { head: [104, 66], neck: [96, 66], hip: [62, 66], legs: [{ knee: [58, 46], ankle: [54, 26] }], arms: [{ elbow: [84, 68], hand: [72, 70] }] },
    ],
  },
  hanging_leg_raise: {
    props: [{ kind: 'bar', from: [30, 8], to: [90, 8] }],
    poses: [
      { head: [60, 26], neck: [60, 34], hip: [60, 54], legs: [{ knee: [60, 64], ankle: [60, 76] }], arms: [{ elbow: [60, 20], hand: [60, 8] }] },
      { head: [60, 26], neck: [60, 34], hip: [60, 54], legs: [{ knee: [80, 54], ankle: [96, 56] }], arms: [{ elbow: [60, 20], hand: [60, 8] }] },
    ],
  },
  mountain_climber: {
    props: [GROUND],
    poses: [
      { head: [96, 40], neck: [88, 44], hip: [50, 56], legs: [{ knee: [30, 62], ankle: [10, 70] }, { knee: [62, 62], ankle: [56, 72] }], arms: [{ elbow: [88, 58], hand: [88, 72] }] },
      { head: [96, 40], neck: [88, 44], hip: [50, 56], legs: [{ knee: [30, 62], ankle: [10, 70] }, { knee: [70, 50], ankle: [74, 72] }], arms: [{ elbow: [88, 58], hand: [88, 72] }] },
    ],
  },
  hollow: {
    props: [GROUND],
    poses: [{ head: [100, 54], neck: [92, 60], hip: [60, 66], legs: [{ knee: [42, 62], ankle: [22, 56] }], arms: [{ elbow: [104, 46], hand: [114, 40] }] }],
  },
  dips: {
    props: [{ kind: 'bar', from: [36, 34], to: [48, 34] }, { kind: 'bar', from: [72, 34], to: [84, 34] }],
    poses: [
      { head: [60, 12], neck: [60, 20], hip: [60, 42], legs: [{ knee: [56, 56], ankle: [64, 66] }], arms: [{ elbow: [50, 28], hand: [42, 34] }] },
      { head: [64, 26], neck: [62, 34], hip: [60, 54], legs: [{ knee: [56, 66], ankle: [64, 76] }], arms: [{ elbow: [42, 20], hand: [42, 34] }] },
    ],
  },
  bench_dips: {
    props: [GROUND, { kind: 'bench', from: [80, 44], to: [110, 72] }],
    poses: [
      { head: [70, 18], neck: [70, 26], hip: [66, 46], legs: [{ knee: [48, 54], ankle: [32, 72] }], arms: [{ elbow: [82, 36], hand: [88, 44] }] },
      { head: [70, 30], neck: [70, 38], hip: [66, 56], legs: [{ knee: [48, 58], ankle: [32, 72] }], arms: [{ elbow: [88, 30], hand: [88, 44] }] },
    ],
  },
  burpee: {
    props: [GROUND],
    poses: [
      { head: [60, 6], neck: [60, 14], hip: [60, 36], legs: [{ knee: [60, 52], ankle: [60, 68] }], arms: [{ elbow: [62, 6], hand: [64, -2] }] },
      { head: [96, 40], neck: [88, 44], hip: [50, 56], legs: [{ knee: [30, 62], ankle: [10, 70] }], arms: [{ elbow: [88, 58], hand: [88, 72] }] },
    ],
  },
  jumping_jack: {
    props: [GROUND],
    poses: [
      STAND,
      { head: [60, 12], neck: [60, 20], hip: [60, 42], legs: [{ knee: [48, 56], ankle: [40, 72] }, { knee: [72, 56], ankle: [80, 72] }], arms: [{ elbow: [48, 12], hand: [40, 2] }, { elbow: [72, 12], hand: [80, 2] }] },
    ],
  },
}

export interface ExerciseGuide {
  family: FormFamily
  /** フォームのポイント（3 つ程度） */
  tips: string[]
  /** よくある間違い */
  avoid?: string
}

/** 初期種目のガイド（キーは seed.ts の id） */
export const EXERCISE_GUIDES: Record<string, ExerciseGuide> = {
  ex_pushup_wall: { family: 'pushup_wall', tips: ['壁から一歩離れて手は肩の高さ', '頭からかかとまで一直線のまま胸を壁に近づける', '肘は体側に対して45度くらいに開く'], avoid: '腰が反る・お尻が引ける' },
  ex_pushup_knee: { family: 'pushup_knee', tips: ['膝をついても頭から膝までは一直線', '胸が床に近づくまで下ろす', 'お腹に力を入れて腰を反らせない'], avoid: 'お尻が上がって「くの字」になる' },
  ex_pushup: { family: 'pushup', tips: ['手は肩幅よりやや広く、指先は前', '頭からかかとまで一直線をキープ', '胸が床につく直前まで下ろし、押し上げる'], avoid: '腰が落ちる・首だけ前に出る' },
  ex_pushup_diamond: { family: 'pushup', tips: ['両手の親指と人差し指で三角を作る', '肘は体側に沿って後ろへ引く', '上腕三頭筋を意識してゆっくり'], avoid: '肘が外に開く' },
  ex_pushup_decline: { family: 'pushup', tips: ['足を椅子などに乗せて体を斜めに', '手は肩の真下より少し前', '腰が反りやすいのでお腹に力を'], avoid: '腰が反って胸だけ下がる' },
  ex_pushup_archer: { family: 'pushup', tips: ['手幅を広く取り、片側に体重を寄せて下ろす', '伸ばした側の腕は補助だけ', '左右交互に行う'], avoid: '体がねじれる' },
  ex_pushup_onearm: { family: 'pushup', tips: ['足を広めに開いて安定させる', '体幹をねじらずまっすぐ下ろす', '可動域は狭くても正確さを優先'], avoid: '肩がすくむ・体がねじれる' },
  ex_pushup_wide: { family: 'pushup', tips: ['手は肩幅の1.5倍くらい', '胸の外側を意識して下ろす', '肘は真横より少し後ろ'], avoid: '肘を真横に張りすぎて肩に負担' },
  ex_row_table: { family: 'row', tips: ['テーブルの縁や低い鉄棒を握り、体は一直線', '肩甲骨を寄せながら胸を縁に近づける', '足を遠くに置くほど負荷が上がる'], avoid: '腰が落ちて「くの字」になる' },
  ex_pullup_negative: { family: 'pullup', tips: ['台に乗るかジャンプして顎をバーの上に', 'そこから3〜5秒かけてゆっくり下りる', '肩がすくまないよう肩甲骨を下げる'], avoid: '一気に落ちる' },
  ex_pullup: { family: 'pullup', tips: ['順手で肩幅よりやや広く握る', '肩甲骨を下げてから肘を引く', '顎がバーを越えるまで、下ろすときも制御'], avoid: '反動を使う・肩がすくむ' },
  ex_chinup: { family: 'pullup', tips: ['逆手で肩幅に握る', '胸をバーに近づけるイメージ', '二頭筋と背中の両方を使う'], avoid: '反動を使う' },
  ex_superman: { family: 'superman', tips: ['うつ伏せで手足を伸ばす', '手足と胸を同時に床から浮かせて2秒キープ', '首は反らさず目線は床'], avoid: '首を反らせて上を見る' },
  ex_deadhang: { family: 'deadhang', tips: ['バーを握って全身の力を抜いてぶら下がる', '肩がすくむのはOK、時間を伸ばしていく', '握力と肩の可動域が育つ'] },
  ex_squat: { family: 'squat', tips: ['足は肩幅、つま先はやや外', 'お尻を後ろに引きながら太ももが床と平行まで', '膝はつま先と同じ向き、かかとを浮かせない'], avoid: '膝が内側に入る・背中が丸まる' },
  ex_squat_bulgarian: { family: 'bulgarian', tips: ['後ろ足の甲を椅子に乗せる', '前足に体重をかけてまっすぐ下ろす', '前の膝がつま先より大きく出ないように'], avoid: '上体が前に倒れすぎる' },
  ex_squat_pistol: { family: 'pistol', tips: ['片足を前に伸ばしたまましゃがむ', '腕を前に出してバランスを取る', '最初は椅子に座る高さまででOK'], avoid: 'かかとが浮く' },
  ex_squat_jump: { family: 'jump_squat', tips: ['しゃがんでから一気に跳ぶ', '着地はつま先から静かに、膝を柔らかく', '着地したらすぐ次の動作へ'], avoid: '膝を伸ばしたまま硬く着地' },
  ex_lunge: { family: 'lunge', tips: ['一歩前に出して両膝が90度になるまで下ろす', '上体はまっすぐ、前の膝はつま先の真上', '前足で床を押して戻る'], avoid: '前の膝が内側に入る' },
  ex_glute_bridge: { family: 'glute_bridge', tips: ['仰向けで膝を立て、かかとはお尻の近く', 'お尻を締めて腰を持ち上げ、肩から膝を一直線に', '上で1秒止めてゆっくり下ろす'], avoid: '腰を反らせて上げる' },
  ex_glute_bridge_single: { family: 'glute_bridge', tips: ['片脚を伸ばしたままヒップリフト', '骨盤が傾かないように', '上げた脚と体幹を一直線に'], avoid: '骨盤が片側に落ちる' },
  ex_calf_raise: { family: 'calf_raise', tips: ['段差に乗って、かかとを下げてから最大まで上げる', '上で1秒止める', '壁に手を添えてバランスを取ってよい'], avoid: '反動で弾む' },
  ex_wall_sit: { family: 'wall_sit', tips: ['背中を壁につけ、太ももが床と平行になる高さ', '膝は90度、かかとに体重', '呼吸を止めない'], avoid: '膝がつま先より前に出る' },
  ex_plank: { family: 'plank', tips: ['肘は肩の真下、頭からかかとまで一直線', 'お腹とお尻に力を入れる', '呼吸を止めない'], avoid: '腰が反る・お尻が上がる' },
  ex_plank_side: { family: 'side_plank', tips: ['肘は肩の真下、体を横に一直線', '腰が落ちないようお尻を締める', '上の手は腰か天井へ'], avoid: '腰が落ちる・体が前に倒れる' },
  ex_crunch: { family: 'crunch', tips: ['仰向けで膝を立て、手は耳の横', '腰は床につけたまま肩甲骨を浮かせる', '上で1秒止めてゆっくり戻す'], avoid: '首を引っ張る・反動で起き上がる' },
  ex_leg_raise: { family: 'leg_raise', tips: ['仰向けで脚を伸ばし、腰を床に押しつける', '脚を垂直まで上げ、床につく直前まで下ろす', '腰が浮きそうなら膝を曲げてよい'], avoid: '腰が反って浮く' },
  ex_hanging_leg_raise: { family: 'hanging_leg_raise', tips: ['バーにぶら下がり、体の揺れを止める', '脚を腰の高さ以上まで上げる', 'きつければ膝を曲げて（ニーレイズ）'], avoid: '体を振って反動を使う' },
  ex_bicycle_crunch: { family: 'crunch', tips: ['仰向けで両脚を浮かせ、肘と反対の膝を近づける', '上体をひねるのは肩から、首は引っ張らない', 'ゆっくり交互に'], avoid: '速すぎて腰が浮く' },
  ex_mountain_climber: { family: 'mountain_climber', tips: ['腕立ての姿勢で肩の真下に手', '膝を胸に引きつけ、左右交互に', 'お尻が上がらないように'], avoid: 'お尻が高く上がる' },
  ex_hollow_hold: { family: 'hollow', tips: ['仰向けで腰を床に押しつけ、肩と脚を浮かせる', 'バナナのような形をキープ', 'きつければ膝を曲げる'], avoid: '腰が浮く' },
  ex_pike_pushup: { family: 'pike_pushup', tips: ['お尻を高く上げて逆V字', '頭を手の少し前の床に向けて下ろす', '肘は斜め後ろに'], avoid: '背中が丸まる' },
  ex_hspu_wall: { family: 'handstand', tips: ['壁に足をつけて倒立、手は肩幅', '頭が床に触れる直前まで下ろして押し上げる', 'お腹に力を入れて腰を反らせない'], avoid: '腰が反って壁にもたれる' },
  ex_handstand_hold: { family: 'handstand', tips: ['壁を背にして倒立し、指先で床をつかむ', '肩を耳から遠ざけて体を一直線に', '時間を少しずつ伸ばす'], avoid: '腰が反ってバナナ形になる' },
  ex_dips_bench: { family: 'bench_dips', tips: ['椅子の縁に手をつき、お尻を前に出す', '肘が90度になるまで下ろす', '脚を伸ばすほど負荷が上がる'], avoid: '肩がすくむ・肘が外に開く' },
  ex_dips: { family: 'dips', tips: ['平行なバー（椅子2脚でも）に手をつく', '体を少し前傾させ、肘が90度まで下ろす', '肩を下げたまま押し上げる'], avoid: '肩が前に出てすくむ' },
  ex_burpee: { family: 'burpee', tips: ['しゃがんで手を床につき、脚を後ろへ伸ばす', '腕立ての姿勢から脚を戻してジャンプ', '腰が反らないようにお腹に力を'], avoid: '腰を反らせて脚を戻す' },
  ex_jumping_jack: { family: 'jumping_jack', tips: ['脚を開くと同時に腕を頭上へ', '着地は膝を柔らかく', 'リズムよく一定のテンポで'], avoid: '膝を伸ばしたまま硬く着地' },
}

export function youtubeSearchUrl(name: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(`${name} やり方 フォーム`)}`
}
