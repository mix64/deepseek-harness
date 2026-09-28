/** Every Japanese string keeps exactly the `{name}` placeholders of the
 * owner's English source, so interpolation never drops or invents a value. */
import { describe, expect, it } from 'vitest'
import { JA_DICTIONARIES } from '../src/client/locales/index.ts'
import { SOURCES } from './sources.ts'

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

describe('Japanese placeholders', () => {
  it('names an owner source for every contributed namespace', () => {
    const contributed = JA_DICTIONARIES.flatMap(group => Object.keys(group)).sort()
    expect(contributed).toEqual(Object.keys(SOURCES).sort())
  })

  it('keeps every translation\'s placeholders identical to English', () => {
    for (const group of JA_DICTIONARIES) {
      for (const [ns, dict] of Object.entries(group)) {
        const source = SOURCES[ns]!
        for (const [key, value] of Object.entries(dict ?? {})) {
          expect.soft(placeholders(value), `${ns}:${key}`).toEqual(placeholders(source[key] ?? ''))
        }
      }
    }
  })
})
