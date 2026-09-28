import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-settings-web-search` namespaces. */
export const uiSettingsWebSearchJa = {
  'settings.webSearch': {
    'title': 'Web 検索',
    'description': 'DeepSeek の検索プロバイダーを設定します。',
    'useSearchApi': '新しい Web Search API を使用',
    'useSearchApiHint': '既定ではオフで、検索は DeepSeek Messages を経由します。新しい Web Search API の機能と料金については、次を参照してください: ',
    'searchGuide': 'Search & Fetch ガイド',
    'searchGuideUrl': 'https://api-docs.deepseek.com/guides/search',
    'apiKey': 'API キー',
    'apiKeyHint': '設定ファイルとは別に保存されます。現在のキーを維持する場合は空欄のままにしてください。',
    'apiKeySet': 'キーが設定されています。',
    'apiKeyUnset': 'キーが設定されていません。検索できるのは、DeepSeek アカウントのモデルを使う会話で既定のエンドポイントを経由する場合のみです。',
    'baseUrl': 'Messages API のベース URL',
    'baseUrlHint': 'https://api.deepseek.com/anthropic/v1 のように API のプレフィックスまで含めてください。プロバイダーが /messages を付け足します。既定値に戻す場合は空欄にしてください。',
    'searchApiBaseUrl': 'Search / Fetch API のベース URL',
    'searchApiBaseUrlHint': 'https://api.deepseek.com/v1/tools のように API のプレフィックスまで含めてください。プロバイダーが /search または /fetch を付け足します。既定値に戻す場合は空欄にしてください。',
    'maxUses': 'リクエストあたりの最大検索回数',
    'maxUsesHint': '1 回の Messages リクエストの中で補助モデルが実行できる検索の回数です。Messages API にのみ適用されます。',
    'count': '検索あたりの結果数',
    'countHint': '1 回のクエリで返す結果の数です。1〜50 の整数で、既定値は 10 です。検索の呼び出し回数ではなく、結果の件数を制御します。web_search が保持するソースの数は、web_search 自身の結果上限を超えません。',
    'overridden': '上書き済み',
    'reset': '既定値に戻す',
    'readOnly': 'このデプロイでは設定が読み取り専用で保存されています。',
    'unavailable': 'このプラグインは読み込まれていないため、現在は設定できません。',
    'save': '保存',
    'saving': '保存しています…',
    'saveFailed': 'デプロイがこれらの値を受け付けませんでした。修正できるよう入力内容はそのまま残しています。',
    'invalidNumber': '数値を入力するか、既定値を使用する場合は空欄のままにしてください。',
    'invalidCount': '1〜50 の整数を入力するか、既定値を使用する場合は空欄のままにしてください。',
  },
} satisfies JaDictionaries
