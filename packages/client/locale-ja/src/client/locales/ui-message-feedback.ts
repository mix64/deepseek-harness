import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-message-feedback` namespaces. */
export const uiMessageFeedbackJa = {
  'feedback': {
    'action.like': '良い回答',
    'action.likeActive': '評価を取り消す',
    'action.dislike': '問題のある回答',
    'action.dislikeActive': '評価を取り消す',
    'dialog.title': 'フィードバックを送信',
    'dialog.categories': 'フィードバックの分類',
    'dialog.detail': 'フィードバックの詳細',
    'dialog.hint': '改善のため詳細をご記入ください。送信内容には現在の会話のログが含まれます。',
    'category.task-result': 'タスクの結果',
    'category.instruction-following': '指示の理解と遵守',
    'category.product-interaction': '製品の機能と操作性',
    'category.service-stability': '安定性と速度',
    'category.resource-cost': 'リソース使用量と料金',
    'category.security-privacy-permission': 'セキュリティ、プライバシー、権限',
    'category.other': 'その他',
    'toast.recorded': 'フィードバックありがとうございます',
    'error.conflict': 'このフィードバックは別の場所で変更されました。最新の状態を表示しています',
    'error.load': 'フィードバックを読み込めませんでした',
    'error.generic': 'フィードバックを保存できませんでした',
    'error.noteTooLarge': '説明が長すぎます。短くしてから再度送信してください',
  },
} satisfies JaDictionaries
