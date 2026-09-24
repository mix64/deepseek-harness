import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-settings-agent-loop` namespaces. */
export const uiSettingsAgentLoopJa = {
  'settings.agentLoop': {
    'title': 'エージェントループ',
    'description': 'エージェントがツール呼び出しをディスパッチする方法を制御します。',
    'maxParallel': '並列ツール呼び出し数',
    'maxParallelHint': '1 ステップ内で同時に実行できる並列可能な呼び出しの上限です。',
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
