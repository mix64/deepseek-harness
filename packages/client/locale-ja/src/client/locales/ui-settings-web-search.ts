import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-settings-web-search` namespaces. */
export const uiSettingsWebSearchJa = {
  'settings.webSearch': {
    'title': 'Web 検索',
    'description': 'DeepSeek の検索プロバイダーを設定します。',
    'apiKey': 'API キー',
    'apiKeyHint': '設定ファイルとは別に保存されます。現在のキーを維持する場合は空欄のままにしてください。',
    'apiKeySet': 'キーが設定されています。',
    'apiKeyUnset': 'キーが設定されていません。設定するまで検索は利用できません。',
    'baseUrl': 'エンドポイント',
    'baseUrlHint': 'プロバイダーの既定値を使用する場合は空欄のままにしてください。',
    'maxUses': 'リクエストあたりの最大検索回数',
    'maxUsesHint': '1 回のリクエストで回答するまでに検索できる回数です。',
    'overridden': '上書き済み',
    'reset': '既定値に戻す',
    'readOnly': 'このデプロイでは設定が読み取り専用で保存されています。',
    'unavailable': 'このプラグインは読み込まれていないため、現在は設定できません。',
    'save': '保存',
    'saving': '保存しています…',
    'saveFailed': 'デプロイがこれらの値を受け付けませんでした。修正できるよう入力内容はそのまま残しています。',
    'invalidNumber': '数値を入力するか、既定値を使用する場合は空欄のままにしてください。',
  },
} satisfies JaDictionaries
