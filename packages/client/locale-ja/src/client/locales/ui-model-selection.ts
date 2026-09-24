import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-model-selection` namespaces. */
export const uiModelSelectionJa = {
  'model': {
    'provider.account': 'DeepSeek アカウント',
    'command.label': 'モデル',
    'command.description': 'この会話で使用するモデルを選択します',
    'option.loadError': 'カタログを読み込めませんでした: {message}',
    'option.deepseekV4Flash.description': '高速・高効率で経済的です。目的が明確なタスク、定型タスク、並列タスクに適しています。',
    'option.deepseekV4Pro.description': 'エージェント型コーディング、知識、難しい推論に優れています。複雑なタスクや品質重視のタスクに適していますが、コストは高くなります。',
    'trigger.fallback': 'モデルを選択',
    'trigger.loading': 'モデルを読み込んでいます…',
    'trigger.selectAria': 'モデルを選択',
    'trigger.aria': 'モデルを選択、現在: {model}',
    'trigger.ariaEffort': 'モデルを選択、現在: {model}、推論レベル: {effort}',
    'menu.aria': 'モデルと推論レベル',
    'menu.model': 'モデル',
    'menu.effort': '推論レベル',
    'effort.providerDefault': 'Default',
    'status.loading': 'モデル一覧を更新しています…',
    'error.action': 'モデルの操作に失敗しました: {message}',
    'error.sessionInUse': 'このセッションはすでに使用中です。別の DSH（dsh web やデスクトップアプリなど）が実行中の可能性があります。実行中の他の DSH を終了してから、もう一度お試しください。',
    'action.reload': '再読み込み',
    'warning.groupLoad': '{name} を読み込めませんでした: {message}',
    'empty.models': '利用可能なモデルがありません。',
    'empty.efforts': 'このモデルには推論レベルがありません。',
  },
} satisfies JaDictionaries
