import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-settings-shell` namespaces. */
export const uiSettingsShellJa = {
  'settings.shell': {
    'title': 'シェル',
    'description': '各コマンドの実行時間と出力量の上限を設定します。',
    'timeoutMs': 'コマンドのタイムアウト（ms）',
    'timeoutMsHint': '1 つのコマンドが強制終了されるまでに実行できる時間です。',
    'maxOutputBytes': 'ストリームごとの出力上限（バイト）',
    'maxOutputBytesHint': '上限を超えた出力は破棄されず、一時ファイルに書き出されます。',
    'overridden': '上書き済み',
    'reset': '既定値に戻す',
    'readOnly': 'このデプロイでは設定は読み取り専用です。',
    'unavailable': 'このプラグインは読み込まれていないため、現在は設定できません。',
    'save': '保存',
    'saving': '保存中…',
    'saveFailed': 'このデプロイではこれらの値が受け付けられませんでした。修正できるよう入力内容は保持されています。',
    'invalidNumber': '数値を入力してください。空欄にすると既定値が使われます。',
  },
} satisfies JaDictionaries
