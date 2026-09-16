import { z } from 'zod'
import { ACTIVITY_LEVELS, GOALS, SEX, type Profile, type Targets } from '../../types'
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
- 専門用語を避け、口語で親しみやすく。出力はすべて日本語`

function statsLines(label: string, s: WeekStats): string[] {
  const intake = s.intake.days === 0 ? '食事の記録なし' : `平均 ${s.intake.kcal}kcal / P${s.intake.protein}g / F${s.intake.fat}g / C${s.intake.carbs}g（記録 ${s.intake.days}日）`
  return [
    `【${label}】${s.weekStart}〜${s.weekEnd}（集計 ${s.elapsedDays}日）`,
    `トレ: ${s.workoutDays}日 / ${s.totalSets}セット / ${s.totalReps}回 + ${s.totalSeconds}秒 / 推定消費 約${s.burnKcal}kcal`,
    `食事: ${intake}`,
    `体重: ${s.weightAvg === null ? '記録なし' : `週平均 ${s.weightAvg}kg`}`,
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
