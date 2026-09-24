import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-permission-presets` namespaces. */
export const uiPermissionPresetsJa = {
  'permission.access': {
    'mode': 'アクセスモード、現在: {name}',
    'close': '閉じる',
    'preset.readOnly': '読み取り専用',
    'preset.workspaceWrite': 'ワークスペース書き込み',
    'preset.fullAccess': 'フルアクセス',
    'confirm.title': 'フルアクセスを有効にしますか？',
    'confirm.description': 'フルアクセスを有効にすると確認ステップが減り、エージェントは機密性の高い操作、ファイルの変更、外部コマンドを含む多くの操作を直接実行できるようになります。現在のタスクを信頼できる場合にのみ使用してください。',
    'confirm.acknowledge': 'リスクを理解したうえで続行します',
    'confirm.cancel': 'キャンセル',
    'confirm.enable': 'フルアクセスを有効化',
    'auto.label': 'Auto review',
    'auto.badge': 'EXP',
    'auto.description': 'サンドボックスなしで実行し、ネイティブツール呼び出しと PTC 内部呼び出しのたびに同じモデルによる実験的なレビューを行います。',
    'auto.confirm.title': 'Auto review（実験的）を有効にしますか？',
    'auto.confirm.description': 'Auto review はサンドボックスを使用しません。ネイティブツール呼び出しと PTC 内部呼び出しの前に、現在のエージェントと同じモデルが許可するかどうかをレビューします。この機能は実験的なもので、誤って許可または拒否する可能性があり、追加のトークンを消費します。',
    'auto.confirm.acknowledge': 'これらのリスクを理解したうえで続行します',
    'auto.confirm.enable': 'Auto review を有効化',
  },
  'settings.permission': {
    'title': '権限',
    'description': '新しいセッションの既定の権限モードを選択します',
    'loading': '読み込み中',
    'unavailable': '利用不可',
    'preset.readOnly': '読み取り専用',
    'preset.workspaceWrite': 'ワークスペース書き込み',
    'preset.fullAccess': 'フルアクセス',
    'confirm.title': 'フルアクセスを有効にしますか？',
    'confirm.description': 'フルアクセスを有効にすると、新しいセッションでは確認ステップが減り、機密性の高い操作、ファイルの変更、外部コマンドを含む多くの操作を直接実行できるようになります。以降のタスクを信頼できる場合にのみ使用してください。',
    'confirm.acknowledge': 'リスクを理解したうえで続行します',
    'confirm.cancel': 'キャンセル',
    'confirm.enable': 'フルアクセスを有効化',
  },
} satisfies JaDictionaries
