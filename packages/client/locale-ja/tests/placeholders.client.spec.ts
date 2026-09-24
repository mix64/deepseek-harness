/** Every Japanese string keeps exactly the `{name}` placeholders of the
 * owner's English source, so interpolation never drops or invents a value. */
import { describe, expect, it } from 'vitest'
import { en as common } from '@deepseek-ai/dsh-client-locale/src/locales/index.ts'
import { en as settingsLocale } from '@deepseek-ai/dsh-client-locale/src/locales/settings.ts'
import { en as agentPreset } from '@deepseek-ai/dsh-client-ui-agent-preset/src/client/locales.ts'
import { en as approval } from '@deepseek-ai/dsh-client-ui-approval/src/client/locales.ts'
import { en as chat } from '@deepseek-ai/dsh-client-ui-chat/src/client/locale.ts'
import { en as command } from '@deepseek-ai/dsh-client-ui-commands/src/client/locales.ts'
import { en as conversation } from '@deepseek-ai/dsh-client-ui-conversation/src/client/locales.ts'
import { en as cordis } from '@deepseek-ai/dsh-client-ui-cordis/src/client/locales.ts'
import { en as deliverables } from '@deepseek-ai/dsh-client-ui-deliverables/src/client/locales.ts'
import { en as goal } from '@deepseek-ai/dsh-client-ui-goal/src/client/locales.ts'
import { en as slashMenu } from '@deepseek-ai/dsh-client-ui-input-trigger/src/client/locales.ts'
import { en as job } from '@deepseek-ai/dsh-client-ui-jobs/src/client/locales.ts'
import { en as shortcutsLayout } from '@deepseek-ai/dsh-client-ui-layout/src/client/shortcut-locales.ts'
import { en as feedback } from '@deepseek-ai/dsh-client-ui-message-feedback/src/client/locales.ts'
import { en as model } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/locales.ts'
import { en as openInApp } from '@deepseek-ai/dsh-client-ui-open-in-app/src/client/locales.ts'
import { accessEn, en as settingsPermission } from '@deepseek-ai/dsh-client-ui-permission-presets/src/client/locales.ts'
import { en as plan } from '@deepseek-ai/dsh-client-ui-plan/src/client/locales.ts'
import { en as pluginManager } from '@deepseek-ai/dsh-client-ui-plugin-manager/src/client/locales.ts'
import { en as reference } from '@deepseek-ai/dsh-client-ui-reference/src/client/locales.ts'
import { en as schedule } from '@deepseek-ai/dsh-client-ui-schedule/src/client/locales.ts'
import { en as settingsAccount } from '@deepseek-ai/dsh-client-ui-settings-account/src/client/locales.ts'
import { en as settingsAgentLoop } from '@deepseek-ai/dsh-client-ui-settings-agent-loop/src/client/locales.ts'
import { en as settings } from '@deepseek-ai/dsh-client-ui-settings-general/src/client/locales.ts'
import { en as settingsModels } from '@deepseek-ai/dsh-client-ui-settings-models/src/client/locales.ts'
import { en as settingsPluginInventory } from '@deepseek-ai/dsh-client-ui-settings-plugin-inventory/src/client/locales.ts'
import { en as settingsPlugins } from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/locales.ts'
import { en as settingsShell } from '@deepseek-ai/dsh-client-ui-settings-shell/src/client/locales.ts'
import { en as settingsSubagent } from '@deepseek-ai/dsh-client-ui-settings-subagent/src/client/locales.ts'
import { en as settingsWebSearch } from '@deepseek-ai/dsh-client-ui-settings-web-search/src/client/locales.ts'
import { en as shortcuts } from '@deepseek-ai/dsh-client-ui-shortcuts/src/client/locales.ts'
import { en as sidebar } from '@deepseek-ai/dsh-client-ui-sidebar/src/client/locales.ts'
import { en as sidebarBrowser } from '@deepseek-ai/dsh-client-ui-sidebar-browser/src/client/locales.ts'
import { en as sidebarDocumentPreview } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/locales.ts'
import { en as sidebarCodePreview } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/code/locales.ts'
import { en as sidebarExcel } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/excel/locales.ts'
import { en as documentHtml } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/html/locales.ts'
import { en as sidebarImage } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/image/locales.ts'
import { en as documentMarkdown } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/markdown/locales.ts'
import { en as sidebarOffice } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/office/locales.ts'
import { en as sidebarPdf } from '@deepseek-ai/dsh-client-ui-sidebar-documentpreview/src/client/pdf/locales.ts'
import { en as sidebarFiles } from '@deepseek-ai/dsh-client-ui-sidebar-files/src/client/locales.ts'
import { en as sidebarRight } from '@deepseek-ai/dsh-client-ui-sidebar-right/src/client/locales.ts'
import { en as sidebarTerminal } from '@deepseek-ai/dsh-client-ui-sidebar-terminal/src/client/locales.ts'
import { en as skill } from '@deepseek-ai/dsh-client-ui-skill/src/client/locales.ts'
import { en as subagent } from '@deepseek-ai/dsh-client-ui-subagent/src/client/locales.ts'
import { en as settingsTheme } from '@deepseek-ai/dsh-client-ui-theme/src/client/locales.ts'
import { en as trajectory } from '@deepseek-ai/dsh-client-ui-trajectory/src/client/locales.ts'
import { en as question } from '@deepseek-ai/dsh-client-ui-user-questions/src/client/locales.ts'
import { en as workflowRun } from '@deepseek-ai/dsh-client-ui-workflow-run/src/client/locales.ts'
import { en as workspace } from '@deepseek-ai/dsh-client-ui-workspace/src/client/locales.ts'
import { en as sessionLogDownload } from '@deepseek-ai/dsh-session-log-export/src/client/locales.ts'
import { JA_DICTIONARIES } from '../src/client/locales/index.ts'

/** Owner English dictionaries keyed by their registered namespace. */
const SOURCES: Record<string, Readonly<Record<string, string>>> = {
  common,
  'settings.locale': settingsLocale,
  'settings.agentPreset': agentPreset,
  approval,
  chat,
  command,
  conversation,
  cordis,
  deliverables,
  goal,
  'slash.menu': slashMenu,
  job,
  'shortcuts.layout': shortcutsLayout,
  shortcuts,
  feedback,
  model,
  'open-in-app': openInApp,
  'permission.access': accessEn,
  'settings.permission': settingsPermission,
  plan,
  pluginManager,
  reference,
  'schedule.catalog': schedule,
  'settings.account': settingsAccount,
  'settings.agentLoop': settingsAgentLoop,
  settings,
  'settings.models': settingsModels,
  'settings.pluginInventory': settingsPluginInventory,
  'settings.plugins': settingsPlugins,
  'settings.shell': settingsShell,
  'settings.subagent': settingsSubagent,
  'settings.webSearch': settingsWebSearch,
  sidebar,
  sidebarBrowser,
  sidebarDocumentPreview,
  sidebarCodePreview,
  sidebarExcel,
  documentHtml,
  sidebarImage,
  documentMarkdown,
  sidebarOffice,
  sidebarPdf,
  sidebarFiles,
  sidebarRight,
  sidebarTerminal,
  skill,
  subagent,
  'settings.theme': settingsTheme,
  trajectory,
  question,
  workflowRun,
  workspace,
  'session-log-download': sessionLogDownload,
}

function placeholders(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort()
}

describe('Japanese placeholders', () => {
  it('names an owner source for every contributed namespace', () => {
    const contributed = JA_DICTIONARIES.flatMap(group => Object.keys(group)).sort()
    expect(contributed).toEqual(Object.keys(SOURCES).sort())
  })

  it('keeps every translation\'s placeholders identical to English', () => {
    for (const group of JA_DICTIONARIES) {
      for (const [ns, dict] of Object.entries(group)) {
        const source = SOURCES[ns]!
        for (const [key, value] of Object.entries(dict ?? {})) {
          expect.soft(placeholders(value), `${ns}:${key}`).toEqual(placeholders(source[key] ?? ''))
        }
      }
    }
  })
})
