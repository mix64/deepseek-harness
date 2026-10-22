/** `permission.directories` namespace dictionaries: the composer's session-directories control. */

/** Locale namespace of the session-directories control. */
export const PERMISSION_DIRECTORIES_NS = 'permission.directories'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger.add': '添加目录',
  'trigger.count': '目录（{count}）',
  'trigger.aria': '附加目录，共 {count} 个',
  'menu.heading': '可写目录',
  'menu.description': '在“工作区内修改”模式下，智能体也可以修改这些目录中的文件。',
  'menu.main': '工作区',
  'menu.empty': '没有附加目录',
  'menu.add': '添加目录…',
  'menu.workspaces': '工作区',
  'menu.remove': '移除 {path}',
  'busy': '正在授予访问权限…',
  'inactive': '当前模式下不可写入',
  'error.add': '无法添加目录：{message}',
  'error.remove': '无法移除目录：{message}',
} satisfies Record<string, string>

/** The permission.directories namespace key union. */
export type PermissionDirectoriesKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger.add': 'Add directory',
  'trigger.count': 'Directories ({count})',
  'trigger.aria': 'Additional directories, {count}',
  'menu.heading': 'Writable directories',
  'menu.description': 'In Workspace Write mode, the agent can also change files in these directories.',
  'menu.main': 'Workspace',
  'menu.empty': 'No additional directories',
  'menu.add': 'Add directory…',
  'menu.workspaces': 'Workspaces',
  'menu.remove': 'Remove {path}',
  'busy': 'Granting access…',
  'inactive': 'Not writable in the current mode',
  'error.add': 'Could not add the directory: {message}',
  'error.remove': 'Could not remove the directory: {message}',
} satisfies Record<PermissionDirectoriesKey, string>

/** Japanese dictionary, checked complete against the zh key set. */
export const ja = {
  'trigger.add': 'ディレクトリを追加',
  'trigger.count': 'ディレクトリ（{count}）',
  'trigger.aria': '追加ディレクトリ、{count} 件',
  'menu.heading': '書き込み可能なディレクトリ',
  'menu.description': '「ワークスペース書き込み」モードでは、エージェントはこれらのディレクトリ内のファイルも変更できます。',
  'menu.main': 'ワークスペース',
  'menu.empty': '追加ディレクトリはありません',
  'menu.add': 'ディレクトリを追加…',
  'menu.workspaces': 'ワークスペース',
  'menu.remove': '{path} を削除',
  'busy': 'アクセスを付与しています…',
  'inactive': '現在のモードでは書き込みできません',
  'error.add': 'ディレクトリを追加できませんでした: {message}',
  'error.remove': 'ディレクトリを削除できませんでした: {message}',
} satisfies Record<PermissionDirectoriesKey, string>
