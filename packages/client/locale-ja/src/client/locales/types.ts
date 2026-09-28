import type { LocaleDictOf, LocaleNamespaceMap } from '@deepseek-ai/dsh-client-ui-slots'

/**
 * Japanese contributions keyed by declared namespace. Each dictionary may
 * omit keys (lookup falls back to English) but may not name a key its owner
 * never declared, so a renamed or deleted owner key fails typechecking here.
 */
export type JaDictionaries = {
  [N in Extract<keyof LocaleNamespaceMap, string>]?: Partial<LocaleDictOf<N>>
}

/** Japanese contributions for namespaces registered outside the merge table. */
export type UntypedJaDictionaries = Record<string, Record<string, string>>
