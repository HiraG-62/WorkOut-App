import type { FoodEstimate, NutritionLabel, TargetSuggestion } from '../../types'
import {
  FOOD_ESTIMATE_JSON_SCHEMA,
  FOOD_SYSTEM_PROMPT,
  FOOD_TEXT_SYSTEM_PROMPT,
  foodTextUserPrompt,
  LABEL_SYSTEM_PROMPT,
  NUTRITION_LABEL_JSON_SCHEMA,
  NutritionLabelSchema,
  labelUserPrompt,
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
  type FoodTextRequest,
  type TargetSuggestionRequest,
} from './types'

const ENDPOINT = 'https://api.openai.com/v1/chat/completions'

type ContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail: 'low' | 'high' | 'auto' } }

interface ChatResponse {
  choices?: { message?: { content?: string | null; refusal?: string | null } }[]
  error?: { message?: string }
}

/** OpenAI の strict モードは全プロパティ必須 + additionalProperties:false を要求する */
function strictSchema(schema: Record<string, unknown>): Record<string, unknown> {
  const walk = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(walk)
    if (typeof node !== 'object' || node === null) return node
    const obj = { ...(node as Record<string, unknown>) }
    if (obj.type === 'object' && typeof obj.properties === 'object' && obj.properties) {
      obj.additionalProperties = false
      obj.required = Object.keys(obj.properties as Record<string, unknown>)
    }
    for (const k of Object.keys(obj)) obj[k] = walk(obj[k])
    return obj
  }
  const out = walk(schema) as Record<string, unknown>
  delete out.$schema
  return out
}

export function createOpenAiClient(config: AiClientConfig): AiClient {
  async function callJson(
    system: string,
    parts: ContentPart[],
    schemaName: string,
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        signal,
        body: JSON.stringify({
          model: config.model,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: parts },
          ],
          response_format: {
            type: 'json_schema',
            json_schema: { name: schemaName, strict: true, schema: strictSchema(schema) },
          },
        }),
      })
    } catch (e) {
      if (isAbortError(e)) throw new AiError('aborted', '中断しました')
      throw new AiError('network', 'ネットワークに接続できません')
    }
    const data = (await res.json().catch(() => ({}))) as ChatResponse
    if (!res.ok) throw httpStatusToAiError(res.status, data.error?.message ?? '')
    const msg = data.choices?.[0]?.message
    if (msg?.refusal) throw new AiError('refused', 'AIがこのリクエストを処理できませんでした')
    if (!msg?.content) throw new AiError('parse', 'AIから応答がありませんでした')
    return parseJsonText(msg.content)
  }

  return {
    async estimateFood(req: FoodEstimateRequest, signal?: AbortSignal): Promise<FoodEstimate> {
      const raw = await callJson(
        FOOD_SYSTEM_PROMPT,
        [
          {
            type: 'image_url',
            image_url: { url: `data:${req.mediaType};base64,${req.imageBase64}`, detail: 'high' },
          },
          { type: 'text', text: foodUserPrompt(req.hint) },
        ],
        'food_estimate',
        FOOD_ESTIMATE_JSON_SCHEMA,
        signal,
      )
      const parsed = FoodEstimateSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async estimateFoodFromText(req: FoodTextRequest, signal?: AbortSignal): Promise<FoodEstimate> {
      const raw = await callJson(FOOD_TEXT_SYSTEM_PROMPT, [{ type: 'text', text: foodTextUserPrompt(req.text) }], 'food_estimate', FOOD_ESTIMATE_JSON_SCHEMA, signal)
      const parsed = FoodEstimateSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async readNutritionLabel(req: FoodEstimateRequest, signal?: AbortSignal): Promise<NutritionLabel> {
      const raw = await callJson(
        LABEL_SYSTEM_PROMPT,
        [
          { type: 'image_url', image_url: { url: `data:${req.mediaType};base64,${req.imageBase64}`, detail: 'high' } },
          { type: 'text', text: labelUserPrompt(req.hint) },
        ],
        'nutrition_label', NUTRITION_LABEL_JSON_SCHEMA,
        signal,
      )
      const parsed = NutritionLabelSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async suggestTargets(req: TargetSuggestionRequest, signal?: AbortSignal): Promise<TargetSuggestion> {
      const raw = await callJson(
        TARGET_SYSTEM_PROMPT,
        [{ type: 'text', text: targetUserPrompt(req.profile, req.weightKg, req.currentTargets) }],
        'target_suggestion',
        TARGET_SUGGESTION_JSON_SCHEMA,
        signal,
      )
      const parsed = TargetSuggestionSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },
  }
}
