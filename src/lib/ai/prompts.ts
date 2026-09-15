import { z } from 'zod'
import { ACTIVITY_LEVELS, GOALS, SEX, type Profile } from '../../types'

export const FoodEstimateSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().describe('料理名（日本語）'),
      amount: z.string().describe('推定量。例: 1皿, 約150g, 1杯'),
      kcal: z.number().describe('推定カロリー kcal'),
      protein: z.number().describe('タンパク質 g'),
      fat: z.number().describe('脂質 g'),
      carbs: z.number().describe('炭水化物 g'),
    }),
  ),
  confidence: z.enum(['low', 'medium', 'high']),
  note: z.string().describe('推定の根拠や注意点を1〜2文で（日本語）'),
})

export const TargetSuggestionSchema = z.object({
  kcal: z.number(),
  protein: z.number(),
  fat: z.number(),
  carbs: z.number(),
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
