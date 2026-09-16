import type { Exercise, Workout, WorkoutSet } from '../types'
import { resolveFamily, type FormFamily } from '../features/workout/formGuide'

/**
 * 自重トレーニングの消費カロリー推定。
 * kcal = MET × 体重(kg) × 時間(h)。MET は Compendium of Physical Activities の
 * 自重運動（calisthenics 3.8〜8.0）を種目の動きごとに割り当てた目安。休憩込みの
 * セッション時間に掛けるので、値は控えめに置いている。誤差は ±30% 程度と考える。
 */

/** 動きのタイプが不明な種目の MET */
export const DEFAULT_MET = 4.0
/** 設定画面の入力範囲 */
export const MET_MIN = 1
export const MET_MAX = 15

export const MET_BY_FAMILY: Record<FormFamily, number> = {
  pushup: 3.8,
  pushup_knee: 3.0,
  pushup_wall: 2.5,
  pike_pushup: 4.0,
  handstand: 4.0,
  pullup: 5.0,
  row: 4.0,
  superman: 2.5,
  deadhang: 2.5,
  squat: 5.0,
  lunge: 4.5,
  bulgarian: 5.0,
  pistol: 6.0,
  jump_squat: 8.0,
  glute_bridge: 3.0,
  calf_raise: 3.0,
  wall_sit: 3.5,
  plank: 3.0,
  side_plank: 3.0,
  crunch: 3.0,
  leg_raise: 3.5,
  hanging_leg_raise: 4.0,
  mountain_climber: 8.0,
  hollow: 3.0,
  dips: 5.0,
  bench_dips: 3.8,
  burpee: 8.0,
  jumping_jack: 7.0,
}

/** 1セットあたりの最低所要時間（動作 + 休憩）。開始直後に一括記録した場合の下限 */
const MIN_MS_PER_SET = 45_000
/** 終了し忘れ対策の上限 */
const MAX_SESSION_MS = 2 * 60 * 60_000
const MS_PER_HOUR = 3_600_000
/** 体重未記録のときの仮の体重 */
export const FALLBACK_WEIGHT_KG = 60

/** 種目の MET。自分で設定した値 → 動きのタイプの既定値 → 全体の既定値 */
export function exerciseMet(ex: Pick<Exercise, 'id' | 'formFamily' | 'met'>): number {
  if (ex.met !== undefined && Number.isFinite(ex.met) && ex.met > 0) return ex.met
  const family = resolveFamily(ex)
  return family ? MET_BY_FAMILY[family] : DEFAULT_MET
}

/** 動きのタイプから引いた既定 MET（設定画面のプレースホルダ用） */
export function defaultMetFor(ex: Pick<Exercise, 'id' | 'formFamily'>): number {
  const family = resolveFamily(ex)
  return family ? MET_BY_FAMILY[family] : DEFAULT_MET
}

interface BurnInput {
  workout: Pick<Workout, 'startedAt' | 'endedAt'>
  sets: Pick<WorkoutSet, 'exerciseId'>[]
  exercises: Map<string, Exercise>
  weightKg: number
  /** 進行中のワークアウトの現在時刻 */
  now?: number
}

/** ワークアウト1回の推定消費カロリー。セットが無ければ 0 */
export function estimateBurnKcal({ workout, sets, exercises, weightKg, now = Date.now() }: BurnInput): number {
  if (sets.length === 0 || weightKg <= 0) return 0
  const metSum = sets.reduce((acc, s) => {
    const ex = exercises.get(s.exerciseId)
    return acc + (ex ? exerciseMet(ex) : DEFAULT_MET)
  }, 0)
  const avgMet = metSum / sets.length
  const raw = (workout.endedAt ?? now) - workout.startedAt
  const durationMs = Math.min(MAX_SESSION_MS, Math.max(raw, sets.length * MIN_MS_PER_SET))
  return Math.round(avgMet * weightKg * (durationMs / MS_PER_HOUR))
}
