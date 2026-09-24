import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-sidebar-browser` namespaces. */
export const uiSidebarBrowserJa = {
  'sidebarBrowser': {
    'type.label': 'ブラウザー',
    'guide.title': 'ブラウザー',
    'guide.description': 'Web ページを閲覧します',
    'shortcut.noSession': '先にセッションを開いてください',
    'address.placeholder': 'HTTP(S) アドレスを入力',
    'address.changed': 'URL が変更されました',
    'back': '戻る',
    'forward': '進む',
    'reload': '再読み込み',
    'go': '移動',
    'external': 'システムのブラウザーで開く',
    'sandbox.disable': 'サンドボックス制限を無効化',
    'sandbox.enable': 'サンドボックス制限を復元',
    'sandbox.warning': 'サンドボックス制限が無効になっています。ページはトップレベルのアプリを遷移させたり、ダウンロード、モーダルダイアログ、入力ロックを使用したりできます。',
    'start': 'HTTP(S) アドレスを入力して閲覧を開始',
    'loading': '開いています…',
    'restore.previous': '前回開いたページ',
    'restore.action': 'ページを復元',
    'error.empty': 'アドレスを入力してください。',
    'error.invalid': 'このアドレスは無効か、長すぎます。',
    'error.protocol': 'HTTP と HTTPS のアドレスのみ対応しています。ローカルファイルにはドキュメントプレビューを使用してください。',
    'error.credentials': 'アドレスにユーザー名やパスワードを含めることはできません。',
    'error.application-origin': '埋め込みブラウザーで DSH アプリケーション自体を開くことはできません。',
    'load.failed': 'ページを読み込めませんでした。再読み込みするか、システムのブラウザーで開いてください。',
    'load.failed.detail': 'ページの読み込みに失敗しました ({code}): {description}',
    'address.unknown': 'ページが遷移しましたが、このキャリアでは新しい URL を読み取れません。',
  },
} satisfies JaDictionaries
