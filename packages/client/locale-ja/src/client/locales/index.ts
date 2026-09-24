/** Every Japanese dictionary this pack contributes, grouped by owner package. */
import type { JaDictionaries, UntypedJaDictionaries } from './types.ts'
import { commonJa } from './common.ts'
import { sessionLogExportJa } from './session-log-export.ts'
import { uiAgentPresetJa } from './ui-agent-preset.ts'
import { uiApprovalJa } from './ui-approval.ts'
import { uiChatJa } from './ui-chat.ts'
import { uiCommandsJa } from './ui-commands.ts'
import { uiConversationJa } from './ui-conversation.ts'
import { uiCordisJa } from './ui-cordis.ts'
import { uiDeliverablesJa } from './ui-deliverables.ts'
import { uiDirectoryPickerBrowseUntypedJa } from './ui-directory-picker-browse.ts'
import { uiGoalJa } from './ui-goal.ts'
import { uiInputTriggerJa } from './ui-input-trigger.ts'
import { uiJobsJa } from './ui-jobs.ts'
import { uiLayoutJa } from './ui-layout.ts'
import { uiMessageFeedbackJa } from './ui-message-feedback.ts'
import { uiModelSelectionJa } from './ui-model-selection.ts'
import { uiOpenInAppJa } from './ui-open-in-app.ts'
import { uiPermissionPresetsJa } from './ui-permission-presets.ts'
import { uiPlanJa } from './ui-plan.ts'
import { uiPluginManagerJa } from './ui-plugin-manager.ts'
import { uiReferenceJa } from './ui-reference.ts'
import { uiScheduleJa } from './ui-schedule.ts'
import { uiSettingsAccountJa } from './ui-settings-account.ts'
import { uiSettingsAgentLoopJa } from './ui-settings-agent-loop.ts'
import { uiSettingsGeneralJa } from './ui-settings-general.ts'
import { uiSettingsModelsJa } from './ui-settings-models.ts'
import { uiSettingsPluginInventoryJa } from './ui-settings-plugin-inventory.ts'
import { uiSettingsPluginsJa } from './ui-settings-plugins.ts'
import { uiSettingsShellJa } from './ui-settings-shell.ts'
import { uiSettingsSubagentJa } from './ui-settings-subagent.ts'
import { uiSettingsWebSearchJa } from './ui-settings-web-search.ts'
import { uiShortcutsJa } from './ui-shortcuts.ts'
import { uiSidebarJa } from './ui-sidebar.ts'
import { uiSidebarBrowserJa } from './ui-sidebar-browser.ts'
import { uiSidebarDocumentpreviewJa } from './ui-sidebar-documentpreview.ts'
import { uiSidebarFilesJa } from './ui-sidebar-files.ts'
import { uiSidebarRightJa } from './ui-sidebar-right.ts'
import { uiSidebarTerminalJa } from './ui-sidebar-terminal.ts'
import { uiSkillJa } from './ui-skill.ts'
import { uiSubagentJa } from './ui-subagent.ts'
import { uiThemeJa } from './ui-theme.ts'
import { uiTrajectoryJa } from './ui-trajectory.ts'
import { uiUserQuestionsJa } from './ui-user-questions.ts'
import { uiWorkflowRunJa } from './ui-workflow-run.ts'
import { uiWorkspaceJa } from './ui-workspace.ts'

export { JA_LANGUAGE } from './language.ts'

/** Typed contributions; a namespace appears in at most one owner group. */
export const JA_DICTIONARIES: readonly JaDictionaries[] = [
  commonJa,
  sessionLogExportJa,
  uiAgentPresetJa,
  uiApprovalJa,
  uiChatJa,
  uiCommandsJa,
  uiConversationJa,
  uiCordisJa,
  uiDeliverablesJa,
  uiGoalJa,
  uiInputTriggerJa,
  uiJobsJa,
  uiLayoutJa,
  uiMessageFeedbackJa,
  uiModelSelectionJa,
  uiOpenInAppJa,
  uiPermissionPresetsJa,
  uiPlanJa,
  uiPluginManagerJa,
  uiReferenceJa,
  uiScheduleJa,
  uiSettingsAccountJa,
  uiSettingsAgentLoopJa,
  uiSettingsGeneralJa,
  uiSettingsModelsJa,
  uiSettingsPluginInventoryJa,
  uiSettingsPluginsJa,
  uiSettingsShellJa,
  uiSettingsSubagentJa,
  uiSettingsWebSearchJa,
  uiShortcutsJa,
  uiSidebarJa,
  uiSidebarBrowserJa,
  uiSidebarDocumentpreviewJa,
  uiSidebarFilesJa,
  uiSidebarRightJa,
  uiSidebarTerminalJa,
  uiSkillJa,
  uiSubagentJa,
  uiThemeJa,
  uiTrajectoryJa,
  uiUserQuestionsJa,
  uiWorkflowRunJa,
  uiWorkspaceJa,
]

/** Contributions for namespaces registered outside the typed merge table. */
export const JA_UNTYPED_DICTIONARIES: readonly UntypedJaDictionaries[] = [
  uiDirectoryPickerBrowseUntypedJa,
]
