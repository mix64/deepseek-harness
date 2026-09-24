import type { JaDictionaries } from './types.ts'

/** Japanese dictionaries for the `@deepseek-ai/dsh-client-ui-workflow-run` namespaces. */
export const uiWorkflowRunJa = {
  'workflowRun': {
    'run.title': '{name}',
    'run.members.one': '{count} 件のメンバー',
    'run.members.other': '{count} 件のメンバー',
    'run.empty': '開始されたメンバーはありません',
    'phase.unassigned': 'フェーズ未割り当て',
    'phase.empty': 'フェーズ名なし',
    'statusCount.running': '実行中 {count}',
    'statusCount.completed': '完了 {count}',
    'statusCount.failed': '失敗 {count}',
    'statusCount.cancelled': 'キャンセル済み {count}',
    'statusCount.interrupted': '中断 {count}',
    'member.empty': 'メンバー名なし',
    'member.open': '{name} を開く',
    'status.running': '実行中',
    'status.completed': '完了',
    'status.failed': '失敗',
    'status.cancelled': 'キャンセル済み',
    'status.interrupted': '中断',
  },
} satisfies JaDictionaries
