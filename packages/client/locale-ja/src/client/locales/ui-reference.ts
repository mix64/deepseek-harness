import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-reference` namespaces. */
export const uiReferenceJa = {
  'reference': {
    'section.files': 'ファイルとフォルダー',
    'section.subagents': 'サブエージェント',
    'section.sessions': 'セッション',
    'candidate.noCwd': '（作業ディレクトリなし）',
    'crumb.root': 'ワークスペース',
    'fileOpen.title': 'ファイルを開けませんでした',
    'fileOpen.failed': '「{path}」を開けませんでした。再試行するか、このメッセージを閉じてください。',
    'fileOpen.close': '閉じる',
    'fileOpen.retry': '再試行',
    'time.now': 'たった今',
    'time.minutes': '{n}分',
    'time.hours': '{n}時間',
    'time.days': '{n}日',
    'time.months': '{n}か月',
    'time.years': '{n}年',
  },
} satisfies JaDictionaries
