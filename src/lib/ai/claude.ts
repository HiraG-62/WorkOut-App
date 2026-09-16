import Anthropic from '@anthropic-ai/sdk'
import type { FoodEstimate, TargetSuggestion } from '../../types'
import {
  FOOD_ESTIMATE_JSON_SCHEMA,
  FOOD_SYSTEM_PROMPT,
  FOOD_TEXT_SYSTEM_PROMPT,
  foodTextUserPrompt,
  FoodEstimateSchema,
  TARGET_SUGGESTION_JSON_SCHEMA,
  TARGET_SYSTEM_PROMPT,
  TargetSuggestionSchema,
  foodUserPrompt,
  targetUserPrompt,
} from './prompts'
import {
  AiError,
  parseJsonText,
  type AiClient,
  type AiClientConfig,
  type FoodEstimateRequest,
  type FoodTextRequest,
  type TargetSuggestionRequest,
} from './types'

const MAX_TOKENS = 4096

function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  if (e instanceof Anthropic.APIUserAbortError) return new AiError('aborted', '中断しました')
  if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) {
    return new AiError('auth', 'APIキーが無効です。設定を確認してください')
  }
  if (e instanceof Anthropic.RateLimitError) {
    return new AiError('rate', '利用制限に達しました。少し待ってから再試行してください')
  }
  if (e instanceof Anthropic.APIConnectionError) {
    return new AiError('network', 'ネットワークに接続できません')
  }
  if (e instanceof Anthropic.APIError) {
    return new AiError('unknown', e.message)
  }
  return new AiError('unknown', e instanceof Error ? e.message : '不明なエラー')
}

export function createClaudeClient(config: AiClientConfig): AiClient {
  // 自分専用アプリのため、ブラウザから直接呼び出す（キーは端末内にのみ保存）
  const client = new Anthropic({ apiKey: config.apiKey, dangerouslyAllowBrowser: true })

  async function callJson(
    system: string,
    content: Anthropic.Beta.BetaContentBlockParam[],
    schema: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<unknown> {
    try {
      const res = await client.beta.messages.create(
        {
          model: config.model,
          max_tokens: MAX_TOKENS,
          system,
          messages: [{ role: 'user', content }],
          output_config: {
            format: { type: 'json_schema', schema },
          },
          // 安全分類器で拒否された場合はサーバー側で別モデルに自動フォールバックする
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
        },
        { signal },
      )
      if (res.stop_reason === 'refusal') {
        throw new AiError('refused', 'AIがこのリクエストを処理できませんでした')
      }
      const text = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('')
      return parseJsonText(text)
    } catch (e) {
      throw toAiError(e)
    }
  }

  return {
    async estimateFood(req: FoodEstimateRequest, signal?: AbortSignal): Promise<FoodEstimate> {
      const raw = await callJson(
        FOOD_SYSTEM_PROMPT,
        [
          { type: 'image', source: { type: 'base64', media_type: req.mediaType, data: req.imageBase64 } },
          { type: 'text', text: foodUserPrompt(req.hint) },
        ],
        FOOD_ESTIMATE_JSON_SCHEMA,
        signal,
      )
      const parsed = FoodEstimateSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async estimateFoodFromText(req: FoodTextRequest, signal?: AbortSignal): Promise<FoodEstimate> {
      const raw = await callJson(FOOD_TEXT_SYSTEM_PROMPT, [{ type: 'text', text: foodTextUserPrompt(req.text) }], FOOD_ESTIMATE_JSON_SCHEMA, signal)
      const parsed = FoodEstimateSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },

    async suggestTargets(req: TargetSuggestionRequest, signal?: AbortSignal): Promise<TargetSuggestion> {
      const raw = await callJson(
        TARGET_SYSTEM_PROMPT,
        [{ type: 'text', text: targetUserPrompt(req.profile, req.weightKg, req.currentTargets) }],
        TARGET_SUGGESTION_JSON_SCHEMA,
        signal,
      )
      const parsed = TargetSuggestionSchema.safeParse(raw)
      if (!parsed.success) throw new AiError('parse', 'AIの応答形式が想定と異なりました')
      return parsed.data
    },
  }
}
