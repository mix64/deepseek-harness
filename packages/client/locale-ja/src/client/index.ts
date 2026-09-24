/**
 * Japanese language pack. Adds `ja` to the locale catalog with an English
 * fallback and contributes one Japanese dictionary per translated namespace
 * through the single-locale registration form. Every registration is an
 * owned effect, so unloading the pack removes the language and its copy;
 * keys the pack does not translate fall back to English.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from './namespaces.ts'
import { JA_DICTIONARIES, JA_LANGUAGE, JA_UNTYPED_DICTIONARIES } from './locales/index.ts'

/** Required service: the locale catalog and dictionary registry. */
export const inject = ['locale']

/**
 * Client plugin body: register the language definition, then every
 * namespace dictionary under the `ja` tag.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.addLanguage(JA_LANGUAGE), 'locale-ja: language')
  for (const group of [...JA_DICTIONARIES, ...JA_UNTYPED_DICTIONARIES]) {
    for (const [ns, dict] of Object.entries(group)) {
      ctx.effect(() => ctx.locale.register(ns, JA_LANGUAGE.id, dict), `locale-ja: ${ns} dictionary`)
    }
  }
}
