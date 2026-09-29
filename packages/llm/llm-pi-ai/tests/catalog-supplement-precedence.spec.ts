import { describe, expect, it, vi } from 'vitest'
import { getBuiltinModels } from '@earendil-works/pi-ai/providers/all'
import { catalogModels } from '../src/catalog.ts'

const installed = getBuiltinModels('nvidia')[0]

// A supplement entry that collides with an installed id, as one does once a
// pi-ai upgrade starts describing the model itself.
vi.mock('../src/catalog-supplement.ts', async () => {
  const { getBuiltinModels: builtin } = await import('@earendil-works/pi-ai/providers/all')
  const [model] = builtin('nvidia')
  if (model === undefined) throw new Error('the installed catalog ships no nvidia model')
  return { CATALOG_SUPPLEMENT: { nvidia: [{ ...model, name: 'Stale supplement entry' }] } }
})

describe('catalog supplement precedence', () => {
  it('keeps the installed entry when the supplement names the same id', () => {
    if (installed === undefined) throw new Error('the installed catalog ships no nvidia model')

    const models = catalogModels('nvidia')

    expect(models.get(installed.id)?.name).toBe(installed.name)
    expect(models.size).toBe(getBuiltinModels('nvidia').length)
  })
})
