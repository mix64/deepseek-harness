/**
 * Catalog entries for models a pi-ai catalog provider serves but the installed
 * pi-ai catalog does not describe. {@link catalogModels} serves them beside the
 * installed entries of the same provider, so a named catalog route offers them
 * without per-deployment configuration; an installed entry of the same id wins.
 *
 * Each entry names a provider the installed catalog ships: the route reuses
 * that catalog provider's API implementations, so an entry for any other
 * provider could not be served.
 *
 * @module dsh-llm-pi-ai/catalog-supplement
 */

import type { Model, ModelCost, OpenAICompletionsCompat } from '@earendil-works/pi-ai'

/** NVIDIA's hosted endpoints publish no per-token price for these models. */
const FREE: ModelCost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'

/** The long-poll window the installed catalog sends on every NVIDIA model. */
const NVIDIA_HEADERS = { 'NVCF-POLL-SECONDS': '3600' }

/** The request shape the installed catalog declares for every NVIDIA model. */
const NVIDIA_COMPAT: OpenAICompletionsCompat = {
  supportsStore: false,
  supportsDeveloperRole: false,
  supportsReasoningEffort: false,
  maxTokensField: 'max_tokens',
  supportsLongCacheRetention: false,
  supportsStrictMode: false,
}

/** Fields shared by every NVIDIA entry below. */
const NVIDIA = {
  api: 'openai-completions',
  provider: 'nvidia',
  baseUrl: NVIDIA_BASE_URL,
  headers: NVIDIA_HEADERS,
  cost: FREE,
} as const

/**
 * Supplementary entries, grouped by provider id. Capacities and modalities
 * come from each model's card on build.nvidia.com.
 */
export const CATALOG_SUPPLEMENT: Readonly<Record<string, readonly Model<'openai-completions'>[]>> = {
  nvidia: [
    {
      ...NVIDIA,
      id: 'deepseek-ai/deepseek-v4.1-flash',
      name: 'DeepSeek V4.1 Flash',
      reasoning: true,
      // With `supportsReasoningEffort: false` the `deepseek` format sends only
      // `thinking: {type}`, so thinking on and off are the levels that differ
      // on the wire.
      thinkingLevelMap: { minimal: null, low: null, medium: null, high: 'high', xhigh: null, max: null },
      input: ['text', 'image'],
      compat: {
        ...NVIDIA_COMPAT,
        requiresReasoningContentOnAssistantMessages: true,
        thinkingFormat: 'deepseek',
      },
      contextWindow: 1_048_576,
      maxTokens: 262_144,
    },
    {
      ...NVIDIA,
      id: 'google/gemma-4-31b-it',
      name: 'Gemma 4 31B IT',
      // Gemma 4 turns thinking on through a system-prompt token, not a request
      // parameter pi-ai can send.
      reasoning: false,
      input: ['text', 'image'],
      compat: NVIDIA_COMPAT,
      contextWindow: 262_144,
      maxTokens: 32_768,
    },
    {
      ...NVIDIA,
      id: 'google/diffusiongemma-26b-a4b-it',
      name: 'DiffusionGemma 26B A4B IT',
      reasoning: false,
      input: ['text', 'image'],
      compat: NVIDIA_COMPAT,
      contextWindow: 262_144,
      maxTokens: 32_768,
    },
    {
      ...NVIDIA,
      id: 'mistralai/mistral-nemotron',
      name: 'Mistral Nemotron',
      reasoning: false,
      input: ['text'],
      compat: NVIDIA_COMPAT,
      contextWindow: 131_072,
      maxTokens: 16_384,
    },
  ],
}
