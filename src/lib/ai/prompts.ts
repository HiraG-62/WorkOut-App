import { z } from 'zod'
import { ACTIVITY_LEVELS, BODY_PARTS, GOALS, SEX, type Profile, type Targets } from '../../types'
import { FORM_FAMILIES, type FormFamily } from '../../features/workout/formGuide'
import type { WeekStats } from '../weekly'

export const FoodEstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('料理名（日本語）'),
      amount: z.string().describe('推定量。例: 1皿, 約150g, 1杯'),
      kcal: z.number().min(0).describe('推定カロリー kcal'),
      protein: z.number().min(0).describe('タンパク質 g'),
      fat: z.number().min(0).describe('脂質 g'),
      carbs: z.number().min(0).describe('炭水化物 g'),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  note: z.string().describe('推定の根拠や注意点を1〜2文で（日本語）'),
})

export const NutritionLabelSchema = z.object({
  productName: z.string().describe('商品名（パッケージから読める範囲で。不明なら「不明」）'),
  basis: z.string().describe('数値の基準。例: 1袋(110g)あたり, 100gあたり, 1本(500ml)あたり'),
  kcal: z.number().min(0).describe('エネルギー kcal'),
  protein: z.number().min(0).describe('たんぱく質 g'),
  fat: z.number().min(0).describe('脂質 g'),
  carbs: z.number().min(0).describe('炭水化物 g'),
  source: z.enum(['label', 'ingredients']).describe('label: 栄養成分表示を読み取った / ingredients: 原材料名と内容量から推定した'),
  confidence: z.enum(['low', 'medium', 'high']),
  note: z.string().describe('補足。例: 100gあたりの表示を1袋110gに換算した、成分表示が無いため原材料から推定した（日本語）'),
})

export const NUTRITION_LABEL_JSON_SCHEMA = z.toJSONSchema(NutritionLabelSchema)

export const LABEL_SYSTEM_PROMPT = `あなたは食品パッケージの表示を読み取る管理栄養士です。写真に写ったパッケージから、カロリーとPFC（たんぱく質・脂質・炭水化物）を求めます。
1. 栄養成分表示が写っていれば、表示されている数値をそのまま読み取る（source: label）。読めない桁は confidence を下げて note に書く
   - 「1食あたり」「1袋あたり」「1本あたり」の表示があればそれを優先し、basis にその基準を書く
   - 100gあたりの表示しかなく内容量が分かる場合は、内容量あたりに換算して basis に「1袋(110g)あたり（100gあたりから換算）」のように書く。内容量が分からなければ 100gあたりのまま
   - 炭水化物は「炭水化物」の値を使う（糖質+食物繊維の表示しかなければ合算）
2. 栄養成分表示が無く原材料名だけの場合は、原材料の並び（多い順）と内容量、商品の種類から1パッケージあたりを推定する（source: ingredients）。confidence は medium 以下にし、note に「成分表示が無いため原材料から推定」と書く
3. どちらも読めなければ商品名や見た目から一般的な値を推定し（source: ingredients）、confidence は low
- 商品名はパッケージから読める範囲で。出力はすべて日本語`

export function labelUserPrompt(hint: string): string {
  const base = 'このパッケージからカロリーとPFCを読み取ってください。成分表示が無ければ原材料から推定してください。'
  return hint.trim() ? `${base}\n補足: ${hint.trim()}` : base
}

export const TargetSuggestionSchema = z.object({
  kcal: z.number().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carbs: z.number().min(0),
  rationale: z.string().describe('なぜこの値かを初心者向けに3〜5文で（日本語）'),
})

/** 各プロバイダに渡す JSON Schema（zod から生成） */
export const FOOD_ESTIMATE_JSON_SCHEMA = z.toJSONSchema(FoodEstimateSchema)
export const TARGET_SUGGESTION_JSON_SCHEMA = z.toJSONSchema(TargetSuggestionSchema)

export const FOOD_SYSTEM_PROMPT = `あなたは管理栄養士です。食事の写真から、写っている料理と分量を推定し、料理ごとにカロリーとPFC（タンパク質・脂質・炭水化物）をグラム単位で見積もります。
- 日本の一般的な家庭料理・外食・コンビニ商品の標準的な栄養成分を基準にする
- 分量は皿のサイズや食器との比率から現実的に推定する
- 複数の料理があれば item を分ける。飲み物も含める
- 不明な点があっても必ず数値を出し、confidence で確信度を表す
- 出力はすべて日本語`

export const FOOD_TEXT_SYSTEM_PROMPT = `あなたは管理栄養士です。ユーザーが食べたものを口語で説明した文章から、料理と分量を推定し、料理ごとにカロリーとPFC（タンパク質・脂質・炭水化物）をグラム単位で見積もります。
- 日本の一般的な家庭料理・外食チェーン・コンビニ商品の標準的な栄養成分を基準にする
- 「並盛」「大盛り」「2個」「1本」などの量の表現は必ず反映し、量が書かれていなければ一般的な1人前とみなす
- 複数の品目があれば item を分ける。飲み物も含める
- 曖昧な表現でも必ず数値を出し、confidence で確信度を表す
- 出力はすべて日本語`

export function foodTextUserPrompt(text: string): string {
  return `次の食事のカロリーとPFCを推定してください。\n食べたもの: ${text.trim()}`
}

export function foodUserPrompt(hint: string): string {
  const base = 'この写真の食事のカロリーとPFCを推定してください。'
  return hint.trim() ? `${base}\n補足: ${hint.trim()}` : base
}

export const TARGET_SYSTEM_PROMPT = `あなたは筋トレ初心者をサポートするパーソナルトレーナー兼管理栄養士です。ユーザーのプロフィールから、1日の摂取カロリーとPFC（タンパク質・脂質・炭水化物）の目標値を提案します。
- 安全で現実的な値にする（極端な制限はしない）
- タンパク質は体重×1.6〜2.2g を目安にする
- 脂質は総カロリーの20〜30%を目安にする
- rationale は栄養の知識がない人にも分かるように、専門用語を避けて説明する
- 出力はすべて日本語`

export function targetUserPrompt(profile: Profile, weightKg: number, currentTargets?: { kcal: number; protein: number; fat: number; carbs: number }): string {
  const lines = [
    `性別: ${SEX[profile.sex]}`,
    `年齢: ${profile.age}歳`,
    `身長: ${profile.heightCm}cm`,
    `体重: ${weightKg}kg`,
    `活動量: ${ACTIVITY_LEVELS[profile.activity].label}（自宅での自重トレーニング中心）`,
    `目的: ${GOALS[profile.goal].label}`,
  ]
  if (currentTargets) {
    lines.push(
      `現在の設定: ${currentTargets.kcal}kcal / P${currentTargets.protein}g / F${currentTargets.fat}g / C${currentTargets.carbs}g`,
    )
  }
  return `以下のプロフィールに合った1日の目標値を提案してください。\n${lines.join('\n')}`
}

export const WeeklyReviewSchema = z.object({
  summary: z.string().describe('今週の総括を1〜2文で（日本語）。数字を1つは入れる'),
  advice: z.string().describe('来週に向けた具体的な一言アドバイスを1〜2文で（日本語）。行動が1つに絞られていること'),
  changeTargets: z.boolean().describe('目標値（カロリー/PFC）を変えたほうがよいなら true。変えなくてよければ false'),
  suggestedTargets: z.object({
    kcal: z.number().min(0),
    protein: z.number().min(0),
    fat: z.number().min(0),
    carbs: z.number().min(0),
  }).describe('changeTargets が true のときの新しい目標。false のときは現在の目標をそのまま入れる'),
})

export const WEEKLY_REVIEW_JSON_SCHEMA = z.toJSONSchema(WeeklyReviewSchema)

export const WEEKLY_SYSTEM_PROMPT = `あなたは自宅で自重トレーニングをする人を支えるパーソナルトレーナー兼管理栄養士です。1週間のトレーニング・食事・体重の集計から、短い振り返りと来週の一言アドバイスを返します。
- 数字は集計値をそのまま使い、根拠のない数値を作らない
- 褒めるところは具体的に褒め、直すところは1つに絞る（あれもこれも言わない）
- 消費カロリーは目安（誤差 ±30%）として扱い、それだけを根拠に食事量を決めさせない
- 体重は日々の変動が大きいので、週平均どうしの比較で判断する
- 記録が少ない週は、記録を続けること自体を来週の目標にしてよい
- 目標値の変更は、体重の推移が目的（減量/維持/増量）と明らかに合っていない場合だけ提案する。変更する場合も一度に kcal で ±200 以内、タンパク質は体重×1.6〜2.2g の範囲
- 睡眠が短い週（平均 6 時間未満）や歩数が極端に少ない週は、トレーニングの量より回復・活動量の確保を優先して助言する
- 専門用語を避け、口語で親しみやすく。出力はすべて日本語`

function statsLines(label: string, s: WeekStats): string[] {
  const intake = s.intake.days === 0 ? '食事の記録なし' : `平均 ${s.intake.kcal}kcal / P${s.intake.protein}g / F${s.intake.fat}g / C${s.intake.carbs}g（記録 ${s.intake.days}日）`
  return [
    `【${label}】${s.weekStart}〜${s.weekEnd}（集計 ${s.elapsedDays}日）`,
    `トレーニング: ${s.workoutDays}日 / ${s.totalSets}セット / ${s.totalReps}回 + ${s.totalSeconds}秒 / 推定消費 約${s.burnKcal}kcal`,
    `食事: ${intake}`,
    `体重: ${s.weightAvg === null ? '記録なし' : `週平均 ${s.weightAvg}kg`}`,
    `睡眠: ${s.sleepAvg === null ? '記録なし' : `週平均 ${s.sleepAvg}h`} / 歩数: ${s.stepsAvg === null ? '記録なし' : `週平均 ${s.stepsAvg}歩`}`,
  ]
}

export function weeklyUserPrompt(profile: Profile, weightKg: number, targets: Targets, current: WeekStats, previous: WeekStats | null): string {
  const lines = [
    `目的: ${GOALS[profile.goal].label} / 性別: ${SEX[profile.sex]} / 年齢: ${profile.age}歳 / 身長: ${profile.heightCm}cm / 体重: ${weightKg}kg（最新） / 活動量: ${ACTIVITY_LEVELS[profile.activity].label}`,
    `現在の目標: ${targets.kcal}kcal / P${targets.protein}g / F${targets.fat}g / C${targets.carbs}g`,
    ...statsLines('今週', current),
    ...(previous ? statsLines('前週', previous) : ['【前週】記録なし']),
  ]
  return `以下の1週間の記録を振り返り、来週の一言アドバイスをください。\n${lines.join('\n')}`
}

const BODY_PART_KEYS = Object.keys(BODY_PARTS) as [keyof typeof BODY_PARTS, ...(keyof typeof BODY_PARTS)[]]
const FAMILY_KEYS = ['none', ...(Object.keys(FORM_FAMILIES) as FormFamily[])] as ['none', ...FormFamily[]]
const FAMILY_LEGEND = (Object.keys(FORM_FAMILIES) as FormFamily[]).map((k) => `${k}=${FORM_FAMILIES[k]}`).join(', ')
const BODY_PART_LEGEND = BODY_PART_KEYS.map((k) => `${k}=${BODY_PARTS[k]}`).join(', ')

const ExerciseFieldsSchema = {
  type: z.enum(['reps', 'time']).describe('reps: 回数で記録する種目 / time: 秒数で記録する種目（プランクなど静止系）'),
  bodyPart: z.enum(BODY_PART_KEYS).describe(`主に使う部位。${BODY_PART_LEGEND}。core は姿勢を保つ静止系（プランク等）、abs は腹筋を曲げ伸ばしする種目（クランチ・レッグレイズ等）`),
  useWeight: z.boolean().describe('ダンベルやリュックなどで加重するのが一般的な種目なら true'),
  formFamily: z.enum(FAMILY_KEYS).describe(`最も近い動きのタイプ。${FAMILY_LEGEND}。どれにも当てはまらなければ none`),
  met: z.number().min(1).max(15).describe('運動強度 MET（自重運動の目安: 軽い 2.5〜3、ふつう 3.5〜5、きつい 6〜8）'),
}

export const ExerciseClassificationSchema = z.object({
  ...ExerciseFieldsSchema,
  restSec: z.number().min(0).max(600).describe('推奨する休憩秒数（30〜120 が一般的）'),
  tips: z.array(z.string()).describe('フォームのポイントを3つ、各20〜40文字（日本語）'),
  avoid: z.string().describe('よくある間違いを1文（日本語）'),
  description: z.string().describe('どんな種目かを1文で（日本語）'),
})

export const EXERCISE_CLASSIFICATION_JSON_SCHEMA = z.toJSONSchema(ExerciseClassificationSchema)

export const EXERCISE_SYSTEM_PROMPT = `あなたは自宅での自重トレーニングに詳しいパーソナルトレーナーです。種目名（と補足）から、その種目の性質を判定します。
- 記録の単位は、回数を数える動きなら reps、静止して耐える種目（プランク・空気椅子・ぶら下がり等）なら time
- formFamily は用意された動きのタイプから最も近いものを選ぶ。派生種目（ワイド腕立て、デクライン腕立て等）は元の動き（pushup）に寄せる
- 種目名が英語や略称でも一般的な名称として解釈する（例: HSPU=壁倒立腕立て、BW スクワット=スクワット）
- tips は初心者が読んで実行できる具体的な言葉で。出力はすべて日本語`

export function exerciseUserPrompt(name: string, hint: string): string {
  const base = `次の種目を判定してください。\n種目名: ${name.trim()}`
  return hint.trim() ? `${base}\n補足: ${hint.trim()}` : base
}

export const ParsedWorkoutSchema = z.object({
  name: z.string().describe('メニュー名（動画タイトルを短くしたもの。20文字以内、日本語）'),
  items: z.array(
    z.object({
      name: z.string().describe('種目名（日本語。一般的な呼び方に正規化する）'),
      sets: z.number().int().min(1).max(20).describe('セット数。分からなければ 3'),
      reps: z.number().int().min(0).max(500).describe('1セットの回数。時間種目なら 0'),
      seconds: z.number().int().min(0).max(3600).describe('1セットの秒数。回数種目なら 0'),
      ...ExerciseFieldsSchema,
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  note: z.string().describe('読み取りの根拠や補足を1〜2文で（日本語）。例: 説明欄のチャプターから読み取った'),
})

export const PARSED_WORKOUT_JSON_SCHEMA = z.toJSONSchema(ParsedWorkoutSchema)

export const VIDEO_SYSTEM_PROMPT = `あなたは筋トレ動画の内容をトレーニングメニューに書き起こすアシスタントです。動画（見られる場合）と、タイトル・説明欄・チャプターのテキストから、実施する種目を順番どおりに抜き出します。
- 各種目についてセット数・回数（または秒数）を読み取る。「30秒 × 3セット」「10回 × 3」などの表記は必ず反映する。書かれていなければ、動画の流れから妥当な値を推定し note にその旨を書く
- サーキット形式（複数種目を順に行い、それを N 周）は、各種目のセット数 = 周回数として展開する
- ウォームアップ・クールダウン・ストレッチは除く（純粋なストレッチ動画なら含めてよい）
- 種目名は日本語の一般的な名称に正規化する（Push-up → 腕立て伏せ）
- 各種目の記録単位・部位・動きのタイプ・MET も判定する
- 出力はすべて日本語`

export function videoUserPrompt(url: string, title: string, description: string, hasVideo: boolean): string {
  const lines = [
    hasVideo ? 'この動画のトレーニングメニューを書き起こしてください。' : '次の動画の情報からトレーニングメニューを書き起こしてください（動画本体は見られません）。',
    `URL: ${url}`,
  ]
  if (title.trim()) lines.push(`タイトル: ${title.trim()}`)
  if (description.trim()) lines.push(`説明欄・チャプター:\n${description.trim()}`)
  return lines.join('\n')
}

/** AI コーチに渡す会話履歴の上限（往復数） */
export const MAX_HISTORY_TURNS = 6

const CoachMealIdeaSchema = z.object({
  name: z.string().describe('料理名（日本語）。そのままフード名になるので20文字以内'),
  howTo: z.string().describe('作り方・買い方を1〜2文で（日本語）。コンビニやレンジで済むならその手順を書く'),
  unitLabel: z.string().describe('1単位の表示ラベル。例: 1人前, 1皿, 1個'),
  kcal: z.number().describe('1単位あたりのカロリー kcal（0 以上）'),
  protein: z.number().describe('1単位あたりのタンパク質 g（0 以上）'),
  fat: z.number().describe('1単位あたりの脂質 g（0 以上）'),
  carbs: z.number().describe('1単位あたりの炭水化物 g（0 以上）'),
  reason: z.string().describe('なぜ今のこの人に合うかを1文で（日本語）。渡された実データを根拠にする'),
})

const CoachWorkoutItemSchema = z.object({
  name: z.string().describe('種目名（日本語。一般的な呼び方に正規化する）'),
  sets: z.number().int().min(1).max(20).describe('セット数'),
  reps: z.number().int().min(0).max(500).describe('1セットの回数。時間種目なら 0'),
  seconds: z.number().int().min(0).max(3600).describe('1セットの秒数。回数種目なら 0'),
  ...ExerciseFieldsSchema,
})

export const CoachAnswerSchema = z.object({
  summary: z.string().describe('今の状況の読み取りを1〜2文で（日本語）。渡されたデータの数字を1つ以上入れる'),
  advice: z.array(z.string()).describe('今日から実行できる行動を2〜4個、各1文で（日本語）'),
  mealIdeas: z.array(CoachMealIdeaSchema).describe('料理の提案。0〜4件。相談内容が食事に関係なければ空配列'),
  hasWorkoutIdea: z.boolean().describe('トレーニングメニューを提案するなら true。食事だけの相談なら false'),
  workoutIdea: z
    .object({
      name: z.string().describe('メニュー名（20文字以内、日本語）。hasWorkoutIdea が false なら空文字'),
      items: z.array(CoachWorkoutItemSchema).describe('種目の一覧。hasWorkoutIdea が false なら空配列'),
    })
    .describe('トレーニングメニューの提案'),
  followUps: z.array(z.string()).describe('次に聞くとよい質問を2〜3個（日本語、20文字程度の短文）'),
})

export const COACH_ANSWER_JSON_SCHEMA = z.toJSONSchema(CoachAnswerSchema)

export const COACH_SYSTEM_PROMPT = `あなたは自宅で自重トレーニングをする人の専属コーチ兼管理栄養士です。相談に対して、渡された実データを根拠に具体的に答えます。
- 【今の状況】の数字・品名・種目を必ず根拠にし、一般論だけで答えない。summary にはその数字を入れる
- ユーザーの要望（簡単・安い・コンビニで済ませたい・時間がないなど）を最優先する。要望に反する提案はしない
- mealIdeas は日本のスーパー・コンビニで手に入る材料だけで作れるものにし、作り方は1〜2文で済むものだけを挙げる
- 栄養値は1人前（unitLabel の1単位）あたりの現実的な推定値にする
- トレーニングの提案は、器具なしで家でできる自重種目に限る。今の部位別セット数の偏りを埋めるように組む
- 消費カロリーは目安（誤差 ±30%）として扱い、それだけを根拠に食事量を決めさせない
- 記録が少ないときは、推測を断定にするより、まず何を記録すればよいかを advice に含める
- 睡眠が短い日が続いている、歩数が少ない、といったコンディションの情報があれば、食事やトレーニングの提案に反映する
- 専門用語を避け、口語で親しみやすく。出力はすべて日本語`

const COACH_ROLE_LABEL = { user: 'ユーザー', coach: 'コーチ' } as const

export function coachUserPrompt(context: string, history: { role: 'user' | 'coach'; text: string }[], question: string): string {
  const blocks = [`【今の状況】\n${context}`]
  // 1 往復 = user + coach の 2 ターン
  const recent = history.slice(-MAX_HISTORY_TURNS * 2)
  if (recent.length > 0) {
    const lines = recent.map((h) => `${COACH_ROLE_LABEL[h.role]}: ${h.text}`).join('\n')
    blocks.push(`【これまでのやり取り】\n${lines}`)
  }
  blocks.push(`【今回の相談】\n${question.trim()}`)
  return blocks.join('\n\n')
}
