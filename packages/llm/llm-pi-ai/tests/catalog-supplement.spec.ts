import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import LlmRuntime, { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm'
import type { ContextFormed } from '@deepseek-ai/dsh-llm'
import * as LlmPiAi from '@deepseek-ai/dsh-llm-pi-ai'
import { builtinProviders, getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import type { BuiltinProvider } from '@earendil-works/pi-ai/providers/all'
import { CATALOG_SUPPLEMENT } from '../src/catalog-supplement.ts'
import { assemble } from './assemble.ts'
import { closeMockServers, mockServer, textEvents } from './mock-server.ts'

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'test': { kind: 'test' } & ContextFormed
  }
}

const KEY_ENV = 'PI_TEST_KEY'
const FLASH = 'deepseek-ai/deepseek-v4.1-flash'

beforeEach(() => {
  vi.stubEnv(KEY_ENV, 'test-key')
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await closeMockServers()
})

async function harness(config: LlmPiAi.Options): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(LlmRuntime)
  await ctx.plugin(LlmPiAi, config)
  return ctx
}

describe('catalog supplement', () => {
  it('names only providers the installed catalog ships, and only models it does not describe', () => {
    const shipped = new Set(builtinProviders().map(provider => provider.id))
    for (const [provider, models] of Object.entries(CATALOG_SUPPLEMENT)) {
      expect(shipped).toContain(provider)
      const installed = new Set(getBuiltinModels(provider as BuiltinProvider).map(model => model.id))
      // An id the installed catalog now describes shadows its entry here, so
      // the entry is dead and should be deleted.
      expect(models.map(model => model.id).filter(id => installed.has(id))).toEqual([])
      for (const model of models) expect(model.provider).toBe(provider)
    }
  })

  it('serves supplementary models beside the installed catalog on an unconfigured route', async () => {
    const ctx = await harness({ providers: { nvidia: {} } })

    const listed = (await ctx.llm.listModels('nvidia')).map(model => model.id)
    expect(listed).toEqual(expect.arrayContaining([
      ...getBuiltinModels('nvidia').map(model => model.id),
      ...(CATALOG_SUPPLEMENT['nvidia'] ?? []).map(model => model.id),
    ]))
    await expect(ctx.llm.resolveModelInfo('nvidia', FLASH)).resolves.toMatchObject({
      context: { contextWindow: 1_048_576 },
      reasoning: {
        efforts: [
          { id: ReasoningEffortId('off'), name: 'Off' },
          { id: ReasoningEffortId('high'), name: 'High' },
        ],
      },
    })
  })

  it('offers supplementary models to discovery with their capacities and modalities', async () => {
    const ctx = await harness({})

    const models = await ctx.llm.discoverModels('llm-pi-ai', { provider: 'nvidia' })

    expect(models.find(model => model.id === FLASH)).toEqual({
      id: FLASH,
      name: 'DeepSeek V4.1 Flash',
      contextWindow: 1_048_576,
      maxTokens: 262_144,
      inputModalities: ['text', 'image'],
    })
  })

  it('sends a supplementary model through the catalog provider with its headers and thinking format', async () => {
    const server = await mockServer([{ events: textEvents }, { events: textEvents }])
    const ctx = await harness({ providers: { nvidia: { apiKeyEnv: KEY_ENV, baseURL: `${server.url}/v1` } } })
    const messages = [createUserMessage({ content: [{ type: 'text', text: 'hi' }], source: { kind: 'test' } })]

    const thinking = await assemble(ctx, { provider: 'nvidia', model: FLASH, messages, reasoningEffort: ReasoningEffortId('high') })
    const plain = await assemble(ctx, { provider: 'nvidia', model: FLASH, messages, reasoningEffort: ReasoningEffortId('off') })

    expect(thinking.finish).toEqual({ kind: 'stop' })
    expect(plain.finish).toEqual({ kind: 'stop' })
    expect(server.paths).toEqual(['/v1/chat/completions', '/v1/chat/completions'])
    expect(server.headers[0]?.['nvcf-poll-seconds']).toBe('3600')
    expect(server.requests[0]).toMatchObject({ model: FLASH, thinking: { type: 'enabled' } })
    expect(server.requests[0]).not.toHaveProperty('reasoning_effort')
    expect(server.requests[1]).toMatchObject({ thinking: { type: 'disabled' } })
  })
})
