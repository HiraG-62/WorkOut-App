import { AI_PROVIDERS, type AiConfig } from '../../types'
import type { AiClient } from './types'

export { AiError } from './types'
export type { AiClient } from './types'

/** 現在のプロバイダ設定からクライアントを作る。キー未設定なら null。SDK は初回利用時に遅延読み込みする */
export async function createAiClient(config: AiConfig): Promise<AiClient | null> {
  const apiKey = config.keys[config.provider].trim()
  if (!apiKey) return null
  const model = config.models[config.provider].trim() || AI_PROVIDERS[config.provider].defaultModel
  switch (config.provider) {
    case 'claude': {
      const { createClaudeClient } = await import('./claude')
      return createClaudeClient({ apiKey, model })
    }
    case 'openai': {
      const { createOpenAiClient } = await import('./openai')
      return createOpenAiClient({ apiKey, model })
    }
    case 'gemini': {
      const { createGeminiClient } = await import('./gemini')
      return createGeminiClient({ apiKey, model })
    }
  }
}

export function isAiConfigured(config: AiConfig): boolean {
  return config.keys[config.provider].trim().length > 0
}
