/** Japanese pack wiring: catalog entry, per-namespace dictionaries, English
 * fallback for untranslated keys, and removal on dispose. Key validity is
 * the typecheck's job (`satisfies JaDictionaries`); placeholder parity is
 * checked against the owners' English dictionaries in placeholders.client.spec. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, onTestFinished } from 'vitest'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { en, zh } from '@deepseek-ai/dsh-client-locale/src/locales/index.ts'
import { apply, inject } from '../src/client/index.ts'
import { JA_DICTIONARIES, JA_UNTYPED_DICTIONARIES } from '../src/client/locales/index.ts'

async function bench() {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  const locale = new LocaleRuntime(ctx)
  locale.register('common', { zh, en })
  ctx.provide('locale', locale)
  const pack = ctx.plugin({ inject: [...inject], apply })
  await pack.await()
  return { locale, pack }
}

const groups = [...JA_DICTIONARIES, ...JA_UNTYPED_DICTIONARIES]

describe('Japanese language pack', () => {
  it('adds ja to the catalog and translates registered namespaces', async () => {
    const { locale } = await bench()
    expect(locale.getLocale().locales.map(item => item.id)).toEqual(['zh', 'en', 'ja'])
    expect(locale.getLocale().locales.at(-1)).toMatchObject({ label: '日本語', fallback: 'en' })

    locale.setLocale('ja')
    const t = locale.bind('common')
    expect(t('cancel')).toBe('キャンセル')
    expect(t('markdown.truncatedCharacters', { total: 12 })).toContain('12')
  })

  it('falls back to English for keys the pack leaves untranslated', async () => {
    const { locale } = await bench()
    locale.register('test.owner', 'en', { 'only.en': 'English only' })
    locale.setLocale('ja')
    expect(locale.bind('test.owner' as never)('only.en' as never)).toBe('English only')
  })

  it('removes the language and its dictionaries on dispose', async () => {
    const { locale, pack } = await bench()
    locale.setLocale('ja')
    await pack.dispose()
    expect(locale.getLocale().locales.map(item => item.id)).toEqual(['zh', 'en'])
    expect(locale.getLocale().active).toBe('en')
    expect(locale.bind('common')('cancel')).toBe('Cancel')
  })

  it('contributes each namespace from exactly one owner group', () => {
    const namespaces = groups.flatMap(group => Object.keys(group))
    expect(new Set(namespaces).size).toBe(namespaces.length)
  })
})
