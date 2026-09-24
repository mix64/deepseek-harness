---
description: "Japanese language pack for the web GUI: adds 日本語 to the Settings language selector and contributes Japanese dictionaries for the shipped client namespaces."
kind: "package-reference"
---

# @deepseek-ai/dsh-client-locale-ja

English | [中文](README.zh.md)

## Summary

This package adds Japanese to the web GUI. Once mounted, Settings → General → Language lists 日本語 beside English and Chinese, and a browser whose preferred language is Japanese opens in Japanese until an explicit selection is stored. The pack contributes Japanese copy for every namespace registered by the Web App bundle's client plugins; any key it does not translate falls back to English.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

The Web App bundle mounts this row beside [`dsh-client-locale`](../locale/README.md); it takes no config. Removing the row removes 日本語 from the selector, and an active Japanese selection returns to the browser match or English while the stored preference waits for the language to register again.

Selecting 日本語 sets `<html lang="ja">` and switches every slot-rendered string immediately. User, model, provider, and protocol text stays verbatim, as it does for every locale. The product title `DeepSeek Harness` and units such as `tok` also stay in English; the pack omits the title key so it falls back to English. Japanese glyphs come from the page language: the shipped font stacks pin no CJK family, so the browser selects Japanese fonts for a `ja` page.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

The plugin follows the language-pack contract of [`dsh-client-locale`](../locale/README.md): one owned effect calls `ctx.locale.addLanguage({ id: 'ja', label: '日本語', fallback: 'en' })`, and one owned effect per namespace registers its dictionary through the single-locale `register(ns, 'ja', dict)` form. Definitions and dictionaries may register in either order, so the pack does not depend on the owners' activation order.

Dictionaries live under [`src/client/locales/`](src/client/locales/), one file per owner package. Each file is checked with `satisfies JaDictionaries`, a mapped type over `LocaleNamespaceMap`: a dictionary may omit keys, but naming a key its owner no longer declares fails typechecking. [`src/client/namespaces.ts`](src/client/namespaces.ts) pulls every owner's type-only merge into the program for that check. Namespaces registered outside the merge table use the untyped `UntypedJaDictionaries` shape.

| File | Role |
|---|---|
| [`src/client/index.ts`](src/client/index.ts) | Registers the language definition and every dictionary as owned effects |
| [`src/client/locales/index.ts`](src/client/locales/index.ts) | Collects the per-owner dictionary groups |
| [`src/client/locales/types.ts`](src/client/locales/types.ts) | The key-checked `JaDictionaries` shape |
| [`src/index.ts`](src/index.ts) | Empty Host half so the Loader lists the row |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

- [dsh-client-locale](../locale/README.md) — the language catalog, fallback chain, and preference storage this pack extends.
- [Client locale rollout decision](../../../.agents/notes/archived/architecture/2026-07-30-client-locale-full-rollout.md) — why added languages arrive as plugins rather than built-in locales.
- [Client group map](../README.md) — the browser half this package belongs to.

-----

<a id="model-experience"></a>
## Model Experience

None, as the language pack is browser-side UI copy that registers nothing model-facing.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

- **New owner keys start in English.** A key added to an owner's `zh`/`en` dictionaries renders in English under 日本語 until this pack translates it; the typecheck catches only removed or renamed keys.
- **Registry-held text keeps its registration language.** Copy captured outside the slot render path follows the [locale package limitation](../locale/README.md#known-limitations-and-deferred-work).
- **Only the Web App bundle's namespaces are covered.** Experimental client plugins outside that bundle keep English copy under 日本語.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

None.

</details>

**Runtime invariant:** No companion is published. The pack owns only effect-scoped registrations in the locale service, whose disposal and fallback lookup are asserted by behavior specs.
