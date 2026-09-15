import type { FoodEstimate, TargetSuggestion } from '../../types'
import {
  FOOD_ESTIMATE_JSON_SCHEMA,
  FOOD_SYSTEM_PROMPT,
  FoodEstimateSchema,
  TARGET_SUGGESTION_JSON_SCHEMA,
  TARGET_SYSTEM_PROMPT,
  TargetSuggestionSchema,
  foodUserPrompt,
  targetUserPrompt,
} from './prompts'
import {
  AiError,
  httpStatusToAiError,
  isAbortError,
  parseJsonText,
  type AiClient,
  type AiClientConfig,
  type FoodEstimateRequest,
  type TargetSuggestionRequest,
} from './types'

const BASE = 'https://generativelanguage.googleapis.com/v1beta/models'

type Part = { text: string } | { inlineData: { mimeType: string; data: string } }

interface GenerateResponse {
  candidates?: {
    content?: { parts?: { text?: string }[] }
    finishReason?: string
  }[]
  promptFeedback?: { blockReason?: string }
  error?: { message?: string }
}

/** Gemini の responseSchema は OpenAPI サブセット。$schema や additionalProperties を落とす */
function geminiSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (typeof node !== 'object' || node === null) return node
    const obj: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (k === '$schema' || k === 'additionalProperties') continue
      obj[k] = walk(v)
    }
    return obj
  }
  return walk(schema) as Record<string, unknown>
}

export function createGeminiClient(config: AiClientConfig): AiClient {
  async function callJson(
    system: string,
    parts: Part[],
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    const url = `${BASE}/${encodeURIComponent(config.model)}:generateContent`
    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': config.apiKey,
        },
        signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: 'user', parts }],
          generationConfig: {
            responseMimeType: 'application/json',
            responseSchema: geminiSchema(schema),
          },
        }),
      })
    } catch (e) {
      if (isAbortError(e)) throw new AiError('aborted', '中断しました')
      throw new AiError('network', 'ネットワークに接続できません')
    }
    const data = (await res.json().catch(() => ({}))) as GenerateResponse
    if (!res.ok) {
      const msg = data.error?.message ?? ''
      // Gemini は無効キーを 400 で返す
      if (res.status === 400 && /api key/i.test(msg)) throw new AiError('auth', 'APIキーが無効です。設定を確認してください')
      throw httpStatusToAiError(res.status, msg)
    }
    if (data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason === 'SAFETY') {
      throw new AiError('refused', 'AIがこのリクエストを処理できませんでした')
    }
    const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? ''
    if (!text) throw new AiError('parse', 'AIから応答がありませんでした')
    return parseJsonText(text)
  }

  return {
    async estimateFood(req: FoodEstimateRequest, signal?: AbortSignal): Promise<FoodEstimate> {
      const raw = await callJson(
        FOOD_SYSTEM_PROMPT,
        [
          { inlineData: { mimeType: req.mediaType, data: req.imageBase64 } },
          { text: foodUserPrompt(req.hint) },
        ],
        FOOD_ESTIMATE_JSON_SCHEMA,
        signal,
      )
      const parsed = FoodEstimateSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async suggestTargets(req: TargetSuggestionRequest, signal?: AbortSignal): Promise<TargetSuggestion> {
      const raw = await callJson(
        TARGET_SYSTEM_PROMPT,
        [{ text: targetUserPrompt(req.profile, req.weightKg, req.currentTargets) }],
        TARGET_SUGGESTION_JSON_SCHEMA,
        signal,
      )
      const parsed = TargetSuggestionSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },
  }
}
