import type { CoachAnswer, ExerciseClassification, FoodEstimate, NutritionLabel, ParsedWorkoutResult, Profile, TargetSuggestion, Targets, WeeklyReviewResult } from '../../types'
import type { WeekStats } from '../weekly'

export interface FoodEstimateRequest {
  imageBase64: string
  mediaType: 'image/jpeg'
  hint: string
}

export interface FoodTextRequest {
  /** 食べたものの説明。例: 牛丼の並盛とサラダ、缶コーヒー */
  text: string
}

export interface TargetSuggestionRequest {
  profile: Profile
  weightKg: number
  currentTargets?: Targets
}

export interface WeeklyReviewRequest {
  profile: Profile
  /** 最新の体重 */
  weightKg: number
  targets: Targets
  current: WeekStats
  previous: WeekStats | null
}

export interface ExerciseClassifyRequest {
  name: string
  hint: string
}

export interface VideoWorkoutRequest {
  url: string
  /** oEmbed などで取れた動画タイトル */
  title: string
  /** ユーザーが貼った説明欄・チャプター */
  description: string
}

export interface CoachRequest {
  /** buildCoachContext が作った「今の状況」テキスト */
  context: string
  /** これまでのやり取り（古い順） */
  history: { role: 'user' | 'coach'; text: string }[]
  question: string
}

export interface AiClient {
  estimateFood(req: FoodEstimateRequest, signal?: AbortSignal): Promise<FoodEstimate>
  estimateFoodFromText(req: FoodTextRequest, signal?: AbortSignal): Promise<FoodEstimate>
  /** 栄養成分表示の写真から数値を読み取る */
  readNutritionLabel(req: FoodEstimateRequest, signal?: AbortSignal): Promise<NutritionLabel>
  suggestTargets(req: TargetSuggestionRequest, signal?: AbortSignal): Promise<TargetSuggestion>
  /** 1週間の集計から振り返りと来週の一言を作る */
  reviewWeek(req: WeeklyReviewRequest, signal?: AbortSignal): Promise<WeeklyReviewResult>
  /** 種目名から性質（単位・部位・MET・フォームのコツ）を判定する */
  classifyExercise(req: ExerciseClassifyRequest, signal?: AbortSignal): Promise<ExerciseClassification>
  /** 筋トレ動画の URL（＋タイトル・説明欄）からメニューを読み取る */
  parseWorkoutVideo(req: VideoWorkoutRequest, signal?: AbortSignal): Promise<ParsedWorkoutResult>
  /** 実データを踏まえて食事・トレーニングの相談に答える */
  askCoach(req: CoachRequest, signal?: AbortSignal): Promise<CoachAnswer>
}

export interface AiClientConfig {
  apiKey: string
  model: string
}

export class AiError extends Error {
  readonly kind: 'auth' | 'network' | 'rate' | 'parse' | 'refused' | 'aborted' | 'unknown'

  constructor(kind: AiError['kind'], message: string) {
    super(message)
    this.name = 'AiError'
    this.kind = kind
  }
}

/** JSONテキストをパースし、失敗したら AiError にする */
export function parseJsonText(text: string): unknown {
  const trimmed = text.trim()
  // コードフェンスで囲まれて返ってきた場合の保険
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  const body = fenced ? fenced[1] : trimmed
  try {
    return JSON.parse(body)
  } catch {
    throw new AiError('parse', 'AIの応答を解釈できませんでした。もう一度お試しください')
  }
}

export function isAbortError(e: unknown): boolean {
  return e instanceof DOMException && e.name === 'AbortError'
}

export function httpStatusToAiError(status: number, detail: string): AiError {
  if (status === 401 || status === 403) return new AiError('auth', 'APIキーが無効です。設定を確認してください')
  if (status === 429) return new AiError('rate', '利用制限に達しました。少し待ってから再試行してください')
  if (status >= 500) return new AiError('network', 'AIサービス側でエラーが発生しました')
  return new AiError('unknown', detail || `リクエストに失敗しました (${status})`)
}
