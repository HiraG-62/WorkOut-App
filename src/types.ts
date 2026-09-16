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
  isCustom: boolean
  archived: boolean
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

export interface TargetSuggestion extends Targets {
  rationale: string
}
