import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-sidebar-files` namespaces. */
export const uiSidebarFilesJa = {
  'sidebarFiles': {
    'shortcut.noSession': '先にセッションを選択してください',
    'type.label': 'ファイル',
    'guide.title': 'ワークスペースのファイル',
    'guide.description': 'このセッションのワークスペース内のファイルを閲覧します',
    'loading': '読み込んでいます…',
    'empty': '空のディレクトリ',
    'truncated': '項目が多すぎるため、一部のみ表示しています。',
    'noWorkspace': 'このセッションにはワークスペースディレクトリがありません。',
    'reload': '再読み込み',
    'autoRefresh': '自動更新',
    'autoRefresh.enable': '自動更新を有効化',
    'autoRefresh.disable': '自動更新を無効化',
    'entry.other': 'ファイルでもディレクトリでもないため、開けません。',
    'error.notFound': 'このディレクトリは存在しません。移動または削除された可能性があります。',
    'error.outsideWorkspace': 'このディレクトリはワークスペースの外にあるため、サイドバーでは読み込みません。',
    'error.notDirectory': 'これはディレクトリではありません。',
    'error.unavailable': '読み込みに失敗しました: {message}',
  },
} satisfies JaDictionaries
