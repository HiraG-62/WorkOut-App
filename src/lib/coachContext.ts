import {
  ACTIVITY_LEVELS,
  BODY_PARTS,
  GOALS,
  SEX,
  type BodyPart,
  type DailyMetric,
  type Exercise,
  type Food,
  type MealEntry,
  type Profile,
  type Routine,
  type Targets,
  type WeightEntry,
  type Workout,
  type WorkoutSet,
} from '../types'
import { estimateBurnKcal } from './calories'
import { addDays, formatMonthDay, timeSlot, TIME_SLOT_LABELS } from './date'
import { sumNutrition } from './nutrition'

/**
 * AI コーチに渡す「今の状況」を短い日本語テキストにまとめる。
 * トークンを抑えるため、数値は丸め、リストは上位のみ・実例は文字数で打ち切る。
 */

/** 食事・トレーニングをさかのぼる日数 */
export const COACH_DAYS = 14
/** 体重の比較にさかのぼる日数 */
export const COACH_WEIGHT_DAYS = 30
/** 「よく食べるもの」に挙げる件数 */
const TOP_FOODS = 8
/** 食事の実例を載せる日数 */
const SAMPLE_DAYS = 7
/** 実例に載せる 1 日あたりの品数 */
const SAMPLE_ITEMS_PER_DAY = 6
/** 実例 1 行の最大文字数 */
const SAMPLE_LINE_MAX_CHARS = 120
/** 実例全体の最大文字数 */
const SAMPLE_MAX_CHARS = 400
/** 「よく使う種目」に挙げる件数 */
const TOP_EXERCISES = 5
/** メニュー名を挙げる件数 */
const TOP_ROUTINES = 10

const NONE = '記録なし'

export interface CoachContextInput {
  today: string
  profile: Profile
  targets: Targets
  /** 最新の体重 */
  weightKg: number
  /** 直近 COACH_DAYS 日分 */
  meals: MealEntry[]
  /** アーカイブ済みを除く全件 */
  foods: Food[]
  /** 直近 COACH_DAYS 日分 */
  workouts: Workout[]
  /** workouts に属するセット */
  sets: WorkoutSet[]
  exercises: Map<string, Exercise>
  routines: Routine[]
  /** 直近 COACH_WEIGHT_DAYS 日分 */
  weights: WeightEntry[]
  /** 直近 COACH_DAYS 日分 */
  metrics: DailyMetric[]
}

function r0(n: number): number {
  return Math.round(n)
}

/** 目標に対する割合（%）。目標が 0 以下なら null */
function rate(value: number, target: number): number | null {
  if (target <= 0) return null
  return Math.round((value / target) * 100)
}

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max)}…`
}

function withRate(value: number, target: number, unit: string): string {
  const r = rate(value, target)
  return r === null ? `${value}${unit}` : `${value}${unit}（目標比 ${r}%）`
}

function profileLines({ profile, weightKg, targets }: CoachContextInput): string[] {
  return [
    `【プロフィール】${SEX[profile.sex]} / ${profile.age}歳 / ${profile.heightCm}cm / ${weightKg}kg / 活動量: ${ACTIVITY_LEVELS[profile.activity].label} / 目的: ${GOALS[profile.goal].label}`,
    `【1日の目標】${targets.kcal}kcal / P${targets.protein}g / F${targets.fat}g / C${targets.carbs}g`,
  ]
}

function intakeLine({ meals, targets }: CoachContextInput): string {
  const head = `【食事・直近${COACH_DAYS}日】`
  if (meals.length === 0) return `${head}${NONE}`
  const days = new Set(meals.map((m) => m.date)).size
  const totals = sumNutrition(meals)
  const perDay = {
    kcal: r0(totals.kcal / days),
    protein: r0(totals.protein / days),
    fat: r0(totals.fat / days),
    carbs: r0(totals.carbs / days),
  }
  const slots = [0, 0, 0, 0]
  for (const m of meals) slots[timeSlot(new Date(m.createdAt))] += 1
  const slotText = TIME_SLOT_LABELS.map((label, i) => `${label}${slots[i]}回`).join(' / ')
  return `${head}記録した日数 ${days}日 / 1日平均 ${withRate(perDay.kcal, targets.kcal, 'kcal')} · P${withRate(perDay.protein, targets.protein, 'g')} · F${withRate(perDay.fat, targets.fat, 'g')} · C${withRate(perDay.carbs, targets.carbs, 'g')} / 時間帯別の記録回数 ${slotText}`
}

function topFoodsLine({ foods }: CoachContextInput): string {
  const head = '【よく食べるもの】'
  // 登録しただけで一度も食べていないフードは「よく食べるもの」ではないので数えない
  const used = foods.filter((f) => f.useCount > 0)
  if (used.length === 0) return `${head}まだ記録なし`
  const list = [...used].sort((a, b) => b.useCount - a.useCount || b.lastUsedAt - a.lastUsedAt).slice(0, TOP_FOODS)
  const text = list.map((f) => `${f.favorite ? '★' : ''}${f.name}（${f.unitLabel} ${r0(f.kcal)}kcal / P${r0(f.protein)}g）`).join('、')
  return `${head}${text}`
}

function sampleMealLines({ meals, today }: CoachContextInput): string[] {
  const head = `【食事の実例・直近${SAMPLE_DAYS}日】`
  const from = addDays(today, -(SAMPLE_DAYS - 1))
  const recent = meals.filter((m) => m.date >= from)
  if (recent.length === 0) return [`${head}${NONE}`]
  const byDate = new Map<string, string[]>()
  for (const m of [...recent].sort((a, b) => a.createdAt - b.createdAt)) {
    const names = byDate.get(m.date) ?? []
    if (names.length < SAMPLE_ITEMS_PER_DAY) names.push(m.name)
    byDate.set(m.date, names)
  }
  // 新しい日から積み、長くなったら古い日を落とす。1 行目は必ず入れる
  const lines: string[] = []
  let chars = 0
  for (const day of [...byDate.keys()].sort().reverse()) {
    const line = truncate(`${formatMonthDay(day)}: ${(byDate.get(day) ?? []).join('、')}`, SAMPLE_LINE_MAX_CHARS)
    if (lines.length > 0 && chars + line.length > SAMPLE_MAX_CHARS) break
    chars += line.length
    lines.push(line)
  }
  return [head, ...lines]
}

function workoutLine(input: CoachContextInput): string {
  const { workouts, sets, exercises, routines, weightKg } = input
  const head = `【トレーニング・直近${COACH_DAYS}日】`
  // よく使う順に絞る（メニューが増えても行が膨らまないように）
  const routineNames = [...routines]
    .sort((a, b) => b.lastUsedAt - a.lastUsedAt || b.createdAt - a.createdAt)
    .slice(0, TOP_ROUTINES)
    .map((r) => r.name)
    .join('、')
  const routinePart = `メニュー: ${routineNames || 'なし'}`
  if (sets.length === 0) return `${head}${NONE} / ${routinePart}`

  const byPart = new Map<BodyPart, number>()
  const byExercise = new Map<string, number>()
  for (const s of sets) {
    const ex = exercises.get(s.exerciseId)
    if (!ex) continue
    byPart.set(ex.bodyPart, (byPart.get(ex.bodyPart) ?? 0) + 1)
    byExercise.set(ex.name, (byExercise.get(ex.name) ?? 0) + 1)
  }
  const partText =
    (Object.keys(BODY_PARTS) as BodyPart[])
      .filter((p) => (byPart.get(p) ?? 0) > 0)
      .map((p) => `${BODY_PARTS[p]}${byPart.get(p)}`)
      .join(' / ') || NONE
  const exerciseText =
    [...byExercise.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_EXERCISES)
      .map(([name, count]) => `${name}${count}セット`)
      .join('、') || NONE
  // 進行中のワークアウトは開始時刻を「今」とみなし、セット数からの下限で見積もる
  const burnKcal = workouts.reduce(
    (acc, w) => acc + estimateBurnKcal({ workout: w, sets: sets.filter((s) => s.workoutId === w.id), exercises, weightKg, now: w.startedAt }),
    0,
  )
  const days = new Set(workouts.filter((w) => sets.some((s) => s.workoutId === w.id)).map((w) => w.date)).size
  return `${head}実施 ${days}日 / 総セット ${sets.length} / 部位別セット ${partText} / よく使う種目 ${exerciseText} / 推定消費 約${burnKcal}kcal / ${routinePart}`
}

function weightLine({ weights }: CoachContextInput): string {
  const head = `【体重・直近${COACH_WEIGHT_DAYS}日】`
  if (weights.length === 0) return `${head}${NONE}`
  const sorted = [...weights].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  if (sorted.length === 1) return `${head}${formatMonthDay(last.date)} ${last.kg}kg（1件のみ）`
  const delta = Math.round((last.kg - first.kg) * 10) / 10
  const sign = delta > 0 ? '+' : ''
  return `${head}${formatMonthDay(first.date)} ${first.kg}kg → ${formatMonthDay(last.date)} ${last.kg}kg（${sign}${delta}kg / ${sorted.length}件）`
}

function conditionLine({ metrics }: CoachContextInput): string {
  const head = `【睡眠・歩数・直近${COACH_DAYS}日】`
  const sleepValues = metrics.map((m) => m.sleepHours).filter((v): v is number => v !== undefined)
  const scoreValues = metrics.map((m) => m.sleepScore).filter((v): v is number => v !== undefined)
  const stepsValues = metrics.map((m) => m.steps).filter((v): v is number => v !== undefined)
  if (sleepValues.length === 0 && scoreValues.length === 0 && stepsValues.length === 0) return `${head}${NONE}`
  const parts: string[] = []
  if (sleepValues.length > 0) {
    const sleepAvg = Math.round((sleepValues.reduce((a, b) => a + b, 0) / sleepValues.length) * 10) / 10
    // スコアの記録日数が睡眠時間と同じならまとめ、違えば別に書く
    const scoreNote =
      scoreValues.length === 0
        ? ''
        : scoreValues.length === sleepValues.length
          ? `・スコア平均${r0(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)}`
          : ''
    parts.push(`睡眠 平均${sleepAvg}h${scoreNote}（記録${sleepValues.length}日）`)
    if (scoreValues.length > 0 && scoreValues.length !== sleepValues.length) {
      parts.push(`スコア平均${r0(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)}（${scoreValues.length}日）`)
    }
  } else if (scoreValues.length > 0) {
    parts.push(`スコア平均${r0(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)}（${scoreValues.length}日）`)
  }
  if (stepsValues.length > 0) {
    const stepsAvg = r0(stepsValues.reduce((a, b) => a + b, 0) / stepsValues.length)
    parts.push(`歩数 平均${stepsAvg}歩（記録${stepsValues.length}日）`)
  }
  return `${head}${parts.join(' / ')}`
}

/** AI に渡す「今の状況」テキストを作る純関数 */
export function buildCoachContext(input: CoachContextInput): string {
  return [
    ...profileLines(input),
    intakeLine(input),
    topFoodsLine(input),
    ...sampleMealLines(input),
    workoutLine(input),
    weightLine(input),
    conditionLine(input),
  ].join('\n')
}
