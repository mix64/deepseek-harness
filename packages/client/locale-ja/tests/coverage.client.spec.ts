/** The pack stays complete and current against the owners' English copy:
 * every shipped English locale module has a Japanese counterpart, every
 * English key is translated, and every translation, including the Desktop
 * shell's, was made from the English text the owner ships today. `DSH_LOCALE_JA_BASELINE=record` rewrites the
 * English baseline after the affected translations are reviewed. */
import { globSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'
import { JA_DICTIONARIES } from '../src/client/locales/index.ts'
import { en as desktopEn, ja as desktopJa } from '../../../../apps/desktop/src/locale.ts'
import { SOURCES, UNTRANSLATED } from './sources.ts'

const root = resolve(import.meta.dirname, '../../../..')
const baselinePath = join(import.meta.dirname, 'english-baseline.json')
const recording = process.env['DSH_LOCALE_JA_BASELINE'] === 'record'

/** Owner locale modules outside the Web App bundle, with the reason they stay English. */
const EXCLUDED_MODULES: Record<string, string> = {
  'packages/experimental/client-ui-agent-team/src/client/locales.ts': 'experimental; not mounted by the Web App bundle',
  'packages/experimental/client-ui-claude-code-mods/src/client/locales.ts': 'experimental; not mounted by the Web App bundle',
  'packages/experimental/client-ui-voice-input/src/client/locales.ts': 'experimental; not mounted by the Web App bundle',
  'packages/experimental/inspector/src/client/bottom/locales.ts': 'experimental; mounted only by the opt-in Inspector profile',
  'packages/experimental/session-inspector/src/client/locales.ts': 'experimental; mounted only by the opt-in Inspector profile',
}

const japanese: Record<string, Readonly<Record<string, string>>> = Object.fromEntries(
  JA_DICTIONARIES.flatMap(group => Object.entries(group) as [string, Readonly<Record<string, string>>][]))

/** Repository-relative paths of modules that export an owner English dictionary. */
function ownerLocaleModules(): string[] {
  return globSync(['packages/**/src/**/*locale*.ts'], { cwd: root, exclude: path => path === 'node_modules' || path === 'lib' })
    .map(path => path.split(sep).join('/'))
    .filter(path => !path.startsWith('packages/client/locale-ja/'))
    .filter(path => /^export const (?:en|accessEn)\b/m.test(readFileSync(join(root, path), 'utf8')))
    .sort()
}

describe('Japanese coverage', () => {
  it('translates or excludes every owner English locale module', async () => {
    const sources = new Set<object>(Object.values(SOURCES))
    const uncovered: string[] = []
    for (const path of ownerLocaleModules()) {
      if (EXCLUDED_MODULES[path]) continue
      const module = await import(pathToFileURL(join(root, path)).href) as Record<string, unknown>
      const exported = ['en', 'accessEn'].map(name => module[name]).filter(value => value !== undefined)
      if (!exported.every(value => sources.has(value as object))) uncovered.push(path)
    }
    expect(uncovered, 'add each module to tests/sources.ts and translate it, or exclude it with a reason').toEqual([])
  })

  it('names only existing modules as excluded', () => {
    const modules = new Set(ownerLocaleModules())
    expect(Object.keys(EXCLUDED_MODULES).filter(path => !modules.has(path))).toEqual([])
  })

  it('translates every English key', () => {
    const missing: string[] = []
    for (const [ns, source] of Object.entries(SOURCES)) {
      const skipped = new Set(UNTRANSLATED[ns] ?? [])
      for (const key of Object.keys(source)) {
        if (!skipped.has(key) && japanese[ns]?.[key] === undefined) missing.push(`${ns}:${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  it('leaves untranslated only keys the owners still declare', () => {
    const stale = Object.entries(UNTRANSLATED).flatMap(([ns, keys]) =>
      keys.filter(key => SOURCES[ns]?.[key] === undefined || japanese[ns]?.[key] !== undefined).map(key => `${ns}:${key}`))
    expect(stale).toEqual([])
  })

  it('translates from the English the owners ship today', () => {
    type Pair = readonly [section: string, english: Readonly<Record<string, string>>, translated: Readonly<Record<string, string>>]
    const pairs: Pair[] = [
      ...Object.keys(SOURCES).map((ns): Pair => [ns, SOURCES[ns]!, japanese[ns] ?? {}]),
      ['apps/desktop', desktopEn, desktopJa],
    ]
    const current: Record<string, Record<string, string>> = {}
    for (const [section, english, translated] of pairs.sort(([left], [right]) => left.localeCompare(right))) {
      const keys = Object.keys(translated).filter(key => english[key] !== undefined).sort()
      if (keys.length > 0) current[section] = Object.fromEntries(keys.map(key => [key, english[key]!]))
    }
    if (recording) writeFileSync(baselinePath, `${JSON.stringify(current, null, 2)}\n`)
    const baseline = JSON.parse(readFileSync(baselinePath, 'utf8')) as Record<string, Record<string, string>>
    const changed: string[] = []
    for (const ns of new Set([...Object.keys(current), ...Object.keys(baseline)])) {
      for (const key of new Set([...Object.keys(current[ns] ?? {}), ...Object.keys(baseline[ns] ?? {})])) {
        const was = baseline[ns]?.[key]
        const now = current[ns]?.[key]
        if (was !== now) changed.push(`${ns}:${key}\n  was: ${was ?? '(absent)'}\n  now: ${now ?? '(absent)'}`)
      }
    }
    expect(changed, `review these translations, then rerun with DSH_LOCALE_JA_BASELINE=record (${relative(root, baselinePath)})`).toEqual([])
  })
})
