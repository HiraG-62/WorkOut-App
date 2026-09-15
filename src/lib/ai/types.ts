import type { FoodEstimate, Profile, TargetSuggestion, Targets } from '../../types'

export interface FoodEstimateRequest {
  imageBase64: string
  mediaType: 'image/jpeg'
  hint: string
}

export interface TargetSuggestionRequest {
  profile: Profile
  weightKg: number
  currentTargets?: Targets
}

export interface AiClient {
  estimateFood(req: FoodEstimateRequest): Promise<FoodEstimate>
  suggestTargets(req: TargetSuggestionRequest): Promise<TargetSuggestion>
}

export interface AiClientConfig {
  apiKey: string
  model: string
}

export class AiError extends Error {
  readonly kind: 'auth' | 'network' | 'rate' | 'parse' | 'refused' | 'unknown'

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

export function httpStatusToAiError(status: number, detail: string): AiError {
  if (status === 401 || status === 403) return new AiError('auth', 'APIキーが無効です。設定を確認してください')
  if (status === 429) return new AiError('rate', '利用制限に達しました。少し待ってから再試行してください')
  if (status >= 500) return new AiError('network', 'AIサービス側でエラーが発生しました')
  return new AiError('unknown', detail || `リクエストに失敗しました (${status})`)
}
