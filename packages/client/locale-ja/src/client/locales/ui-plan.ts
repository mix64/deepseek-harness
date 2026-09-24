import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-plan` namespaces. */
export const uiPlanJa = {
  'plan': {
    'chip.label': 'プラン',
    'preview.title': 'プラン',
    'preview.document': 'プラン · Markdown',
    'preview.action': '開く',
    'preview.open': 'サイドバーでプランを開く',
    'preview.full': 'プラン全体を表示',
    'preview.openNamed': 'プランを開く: {title}',
    'preview.loading': 'プランを読み込み中…',
    'preview.failed': 'プランを読み込めませんでした',
    'preview.invalidAddress': 'プランのアドレスが無効です',
    'preview.historyUnavailable': 'セッション履歴を利用できません',
    'preview.notFound': 'このプランが見つかりません',
    'preview.unavailable': 'プランのプレビューを利用できません',
    'preview.expired': 'この一時的なプランのプレビューは有効期限が切れました。承認待ちのカードから開き直してください。',
    'chip.on.aria': 'プランモードがオンです。押すとオフになります',
    'chip.on.title': 'プランモードがオンです — クリックでオフ（/plan off）',
    'chip.exitFailed': 'プランモードを終了できませんでした',
  },
} satisfies JaDictionaries
