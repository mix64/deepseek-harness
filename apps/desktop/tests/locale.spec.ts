import { describe, expect, it } from 'vitest'
import { en, formatDesktopMessage, ja, resolveDesktopLocale, resolveDesktopStartupLocale, zh } from '../src/locale.ts'

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{([^{}]+)\}/gu)].map(match => match[1]!).sort()
}

describe('desktop locale dictionaries', () => {
  it('ships the same key set in English, Chinese, and Japanese', () => {
    expect(Object.keys(zh)).toEqual(Object.keys(en))
    expect(Object.keys(ja)).toEqual(Object.keys(en))
    expect(resolveDesktopLocale('zh-Hans-CN').messages).toEqual(zh)
    expect(resolveDesktopLocale('ja-JP').messages).toEqual(ja)
    expect(resolveDesktopLocale('en-US').messages).toEqual(en)
    expect(resolveDesktopLocale('fr-FR').messages).toEqual(en)
  })

  it('keeps every Japanese placeholder identical to English', () => {
    for (const [key, value] of Object.entries(ja)) {
      expect.soft(placeholders(value), key).toEqual(placeholders(en[key as keyof typeof en]))
    }
  })

  it('formats named values without consuming unknown placeholders', () => {
    expect(formatDesktopMessage('{name}@{version} {missing}', { name: 'plugin', version: '1.2.3' }))
      .toBe('plugin@1.2.3 {missing}')
  })

  it('prefers an explicit supported choice, then the first supported system language', () => {
    expect(resolveDesktopStartupLocale('zh', ['en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale('EN', ['zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale('ja', ['zh-CN']).id).toBe('ja')
    expect(resolveDesktopStartupLocale(null, ['fr-FR', 'zh-Hant', 'en-US']).id).toBe('zh-CN')
    expect(resolveDesktopStartupLocale(null, ['ja-JP', 'zh-CN']).id).toBe('ja')
    expect(resolveDesktopStartupLocale(null, ['en-US', 'zh-CN']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, ['fr-FR']).id).toBe('en')
    expect(resolveDesktopStartupLocale(null, []).id).toBe('en')
    expect(resolveDesktopStartupLocale('fr', ['zh-CN']).id).toBe('zh-CN')
  })

})
