import type { Exercise, MealEntry, Targets, WeightEntry, Workout, WorkoutSet } from '../types'
import { addDays, fromDateKey, toDateKey } from './date'
import { estimateBurnKcal } from './calories'
import { sumNutrition } from './nutrition'

export const DAYS_PER_WEEK = 7
/** 週の開始曜日（月曜） */
const WEEK_START_DOW = 1

/** その日を含む週の開始日（月曜）の日付キー */
export function weekStartOf(dateKey: string): string {
  const d = fromDateKey(dateKey)
  const offset = (d.getDay() - WEEK_START_DOW + DAYS_PER_WEEK) % DAYS_PER_WEEK
  d.setDate(d.getDate() - offset)
  return toDateKey(d)
}

/** 週の 7 日分の日付キー（月〜日） */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, i) => addDays(weekStart, i))
}

export interface MacroAverage extends Targets {
  /** 平均の分母（食事を記録した日数） */
  days: number
}

export interface WeekStats {
  weekStart: string
  weekEnd: string
  /** トレーニングした日数 */
  workoutDays: number
  totalSets: number
  totalReps: number
  /** 時間種目の合計秒 */
  totalSeconds: number
  /** 推定消費カロリーの合計 */
  burnKcal: number
  /** 食事を記録した日の平均 */
  intake: MacroAverage
  /** 週平均体重（記録があれば） */
  weightAvg: number | null
  /** 集計対象の日数（週の初日から今日まで）。AI に「何日分の集計か」を伝える */
  elapsedDays: number
}

interface WeekInput {
  weekStart: string
  today: string
  workouts: Workout[]
  sets: WorkoutSet[]
  meals: MealEntry[]
  weights: WeightEntry[]
  exercises: Map<string, Exercise>
  /** 最新の体重。その週の平均体重があればそちらを優先する */
  weightKg: number
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null
  return values.reduce((a, b) => a + b, 0) / values.length
}

/** 1週間分の集計。未来の日は含めない */
export function summarizeWeek({ weekStart, today, workouts, sets, meals, weights, exercises, weightKg }: WeekInput): WeekStats {
  const days = weekDays(weekStart)
  const weekEnd = days[days.length - 1]
  const inWeek = new Set(days.filter((d) => d <= today))
  const weekWorkouts = workouts.filter((w) => inWeek.has(w.date))
  const workoutIds = new Set(weekWorkouts.map((w) => w.id))
  const weekSets = sets.filter((s) => workoutIds.has(s.workoutId))
  const weightAvg = avg(weights.filter((w) => inWeek.has(w.date)).map((w) => w.kg))
  // 進行中（endedAt なし）は now を開始時刻にして「セット数 × 最低時間」の下限で見積もる（レンダー時刻に依存させない）
  const burnKcal = weekWorkouts.reduce(
    (acc, w) =>
      acc + estimateBurnKcal({ workout: w, sets: weekSets.filter((s) => s.workoutId === w.id), exercises, weightKg: weightAvg ?? weightKg, now: w.startedAt }),
    0,
  )
  const weekMeals = meals.filter((m) => inWeek.has(m.date))
  const mealDays = new Set(weekMeals.map((m) => m.date)).size
  const totals = sumNutrition(weekMeals)
  const intake: MacroAverage =
    mealDays === 0
      ? { kcal: 0, protein: 0, fat: 0, carbs: 0, days: 0 }
      : {
          kcal: Math.round(totals.kcal / mealDays),
          protein: Math.round(totals.protein / mealDays),
          fat: Math.round(totals.fat / mealDays),
          carbs: Math.round(totals.carbs / mealDays),
          days: mealDays,
        }
  return {
    weekStart,
    weekEnd,
    workoutDays: new Set(weekWorkouts.map((w) => w.date)).size,
    totalSets: weekSets.length,
    totalReps: weekSets.reduce((a, s) => a + (s.reps ?? 0), 0),
    totalSeconds: weekSets.reduce((a, s) => a + (s.seconds ?? 0), 0),
    burnKcal,
    intake,
    weightAvg: weightAvg === null ? null : Math.round(weightAvg * 10) / 10,
    elapsedDays: inWeek.size,
  }
}

/** 目標に対する達成率（%）。目標が 0 なら null */
export function achievementRate(value: number, target: number): number | null {
  if (target <= 0) return null
  return Math.round((value / target) * 100)
}
