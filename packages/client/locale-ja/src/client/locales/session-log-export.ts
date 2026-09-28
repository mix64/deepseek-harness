import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-session-log-export` namespaces. */
export const sessionLogExportJa = {
  'session-log-download': {
    'header.more': 'その他の操作',
    'menu.download': 'セッションログをダウンロード',
    'menu.feedback': 'フィードバック',
    'dialog.preparingTitle': 'セッションをエクスポート中',
    'dialog.preparingDescription': 'このセッション、サブセッション、添付ファイルを含む ZIP を準備しています。',
    'dialog.successTitle': 'セッションのダウンロードを開始しました',
    'dialog.successDescription': 'ブラウザーがセッションの ZIP をダウンロードしています。',
    'dialog.errorTitle': 'セッションのエクスポートに失敗しました',
    'dialog.close': '閉じる',
    'dialog.commandFailed': 'セッションのエクスポートを開始できませんでした。',
  },
} satisfies JaDictionaries
