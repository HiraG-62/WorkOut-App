import type { FormFamily } from './features/workout/formGuide'

export const BODY_PARTS = {
  chest: '胸',
  back: '背中',
  legs: '脚',
  core: '体幹',
  shoulders: '肩',
  arms: '腕',
  full: '全身',
} as const
export type BodyPart = keyof typeof BODY_PARTS

export const EXERCISE_TYPES = {
  reps: '回数',
  time: '時間',
} as const
export type ExerciseType = keyof typeof EXERCISE_TYPES

export interface Exercise {
  id: string
  name: string
  type: ExerciseType
  bodyPart: BodyPart
  useWeight: boolean
  /** 種目ごとの休憩秒。未設定なら全体設定を使う */
  restSec?: number
  /** 難易度を上げる時の次の種目 */
  progressionId?: string
  /** 一覧の並び順（初期種目は部位→難易度順）。未設定のユーザー作成種目は末尾 */
  order?: number
  /** 図の表示に使う動きのタイプ（自作種目用。初期種目はガイド定義から引く） */
  formFamily?: FormFamily
  /** 運動強度 MET（消費カロリー推定用）。未設定なら動きのタイプから既定値を引く */
  met?: number
  /** フォームのコツ（自作種目・AI 判定用。初期種目はガイド定義から引く） */
  guide?: ExerciseGuideText
  isCustom: boolean
  archived: boolean
  createdAt: number
}

export interface ExerciseGuideText {
  /** フォームのポイント（3 つ程度） */
  tips: string[]
  /** よくある間違い */
  avoid?: string
}

/** セットメニューの1種目分の計画 */
export interface RoutineItem {
  exerciseId: string
  sets: number
  reps?: number
  seconds?: number
}

export type RoutineSource = 'manual' | 'workout' | 'youtube'

/** セットメニュー（種目 × セット数 × 目標） */
export interface Routine {
  id: string
  name: string
  items: RoutineItem[]
  source: RoutineSource
  /** 取り込み元の動画 URL など */
  sourceUrl?: string
  note?: string
  useCount: number
  lastUsedAt: number
  createdAt: number
}

export interface Workout {
  id: string
  /** YYYY-MM-DD */
  date: string
  startedAt: number
  endedAt?: number
  /** 種目の並び順 */
  exerciseIds: string[]
  /** メニューから始めた場合の計画。ゴースト行（プリセット）はこれを優先する */
  plan?: RoutineItem[]
  routineId?: string
}

export interface WorkoutSet {
  id: string
  workoutId: string
  exerciseId: string
  order: number
  reps?: number
  seconds?: number
  weightKg?: number
  completedAt: number
}

export interface Food {
  id: string
  name: string
  /** 1単位の表示ラベル（例: 1個, 100g, 1杯） */
  unitLabel: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** よく使う順の並び替えに使う */
  useCount: number
  lastUsedAt: number
  /** 時間帯別の使用回数 [朝, 昼, 夜, 深夜] */
  slotCounts: [number, number, number, number]
  source: 'manual' | 'ai' | 'quick'
  archived: boolean
  createdAt: number
}

export interface MealEntry {
  id: string
  date: string
  foodId?: string
  name: string
  /** 単位に対する倍率 */
  quantity: number
  kcal: number
  protein: number
  fat: number
  carbs: number
  createdAt: number
}

export interface MealSet {
  id: string
  name: string
  items: { foodId: string; quantity: number }[]
  createdAt: number
}

export interface WeightEntry {
  id: string
  date: string
  kg: number
  createdAt: number
}

export const SEX = { male: '男性', female: '女性' } as const
export type Sex = keyof typeof SEX

export const ACTIVITY_LEVELS = {
  sedentary: { label: 'ほぼ運動しない', factor: 1.2 },
  light: { label: '週1〜2回', factor: 1.375 },
  moderate: { label: '週3〜5回', factor: 1.55 },
  active: { label: 'ほぼ毎日', factor: 1.725 },
} as const
export type ActivityLevel = keyof typeof ACTIVITY_LEVELS

export const GOALS = {
  cut: { label: '減量', kcalDelta: -400 },
  maintain: { label: '維持', kcalDelta: 0 },
  bulk: { label: '増量', kcalDelta: 300 },
} as const
export type Goal = keyof typeof GOALS

export interface Profile {
  sex: Sex
  age: number
  heightCm: number
  activity: ActivityLevel
  goal: Goal
}

export interface Targets {
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export const AI_PROVIDERS = {
  claude: { label: 'Claude', vendor: 'Anthropic', defaultModel: 'claude-opus-5' },
  openai: { label: 'ChatGPT', vendor: 'OpenAI', defaultModel: 'gpt-5' },
  gemini: { label: 'Gemini', vendor: 'Google', defaultModel: 'gemini-2.5-flash' },
} as const
export type AiProvider = keyof typeof AI_PROVIDERS

export interface AiConfig {
  provider: AiProvider
  keys: Record<AiProvider, string>
  models: Record<AiProvider, string>
}

export interface Settings {
  id: 'app'
  profile: Profile
  targets: Targets
  defaultRestSec: number
  sound: boolean
  vibration: boolean
  ai: AiConfig
  /** トレーニングの推定消費カロリーを、その日のカロリー目標に加算する */
  addBurnToTarget: boolean
  /** 初回セットアップ済み */
  onboarded: boolean
}

export interface FoodEstimateItem {
  name: string
  amount: string
  kcal: number
  protein: number
  fat: number
  carbs: number
}

export interface FoodEstimate {
  items: FoodEstimateItem[]
  confidence: 'low' | 'medium' | 'high'
  note: string
}

/** 栄養成分表示の読み取り結果 */
export interface NutritionLabel {
  productName: string
  /** 数値の基準。例: 1袋(110g)あたり, 100gあたり, 1本(500ml)あたり */
  basis: string
  kcal: number
  protein: number
  fat: number
  carbs: number
  /** label: 成分表示を読み取った / ingredients: 原材料名と内容量から推定した */
  source: 'label' | 'ingredients'
  confidence: 'low' | 'medium' | 'high'
  note: string
}

export interface TargetSuggestion extends Targets {
  rationale: string
}

/** 週間レビュー（AIの一言）。id は週の開始日（月曜, YYYY-MM-DD） */
export interface WeeklyReview {
  id: string
  summary: string
  advice: string
  /** 目標を変えたほうがよい場合の提案。不要なら undefined */
  suggestedTargets?: Targets
  provider: AiProvider
  createdAt: number
}

/** AI が返す週間レビュー */
export interface WeeklyReviewResult {
  summary: string
  advice: string
  changeTargets: boolean
  suggestedTargets: Targets
}

/** AI による種目の判定結果 */
export interface ExerciseClassification {
  type: ExerciseType
  bodyPart: BodyPart
  useWeight: boolean
  /** 動きのタイプ。該当なしは 'none' */
  formFamily: FormFamily | 'none'
  met: number
  restSec: number
  tips: string[]
  avoid: string
  /** 1文の説明 */
  description: string
}

/** AI が動画などから読み取ったメニュー */
export interface ParsedWorkoutItem {
  name: string
  sets: number
  /** 回数種目なら 1 以上、時間種目なら 0 */
  reps: number
  /** 時間種目なら 1 以上、回数種目なら 0 */
  seconds: number
  type: ExerciseType
  bodyPart: BodyPart
  useWeight: boolean
  formFamily: FormFamily | 'none'
  met: number
}

export interface ParsedWorkout {
  name: string
  items: ParsedWorkoutItem[]
  confidence: 'low' | 'medium' | 'high'
  note: string
}

export interface ParsedWorkoutResult extends ParsedWorkout {
  /** 動画本体を読んで判定したか（Gemini で成功した場合のみ true） */
  watched: boolean
}
