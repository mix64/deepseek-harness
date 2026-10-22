import { useEffect, useRef, useState } from 'react'
import clsx from 'clsx'
import {
  IconChevronDownOutlineRegular, IconCloseOutlineRegular, IconFolderCloseRegular, IconPlusOutlineRegular, Menu,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { MenuEntry } from '@deepseek-ai/dsh-client-ui-primitives'
import type {
  HostObservable, InjectFace, PropsLocale, PropsRenderSlots, PropsRuntime,
} from '@deepseek-ai/dsh-client-ui-slots'
// Type-only: the `sandboxRoots` Session projection value.
import type {} from '@deepseek-ai/dsh-sandbox-policy/client'
// Type-only: the directory-flow hole this entry declares and its owner contract.
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-permission-presets/client'
import { PERMISSION_DIRECTORIES_NS } from './directories-locales.ts'
import css from './SessionDirectories.module.css'

/** The preset under which the Session's additional directories are writable. */
const WORKSPACE_WRITE = 'workspace-write'

const ADD = '::add'
const REMOVE = 'remove:'
const WORKSPACE = 'workspace:'

/** One requested change to the current Session's additional directories. */
export interface DirectoryEdit {
  /** Whether the path is added or removed. */
  readonly kind: 'add' | 'remove'
  /** Host path as the user chose it; a removal names a listed root. */
  readonly path: string
}

/** Settlement of one edit; a refusal carries the Host's untranslated reason. */
export type DirectoryEditOutcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

/**
 * Business face injected by the permission package's slot registration. A
 * type alias supplies the implicit index signature required by the registry.
 */
export type SessionDirectoriesInjected = {
  hooks: {
    /** True while this control's directory-flow hole is occupied. */
    directoryFlow: HostObservable<boolean>
  }
  /** Apply one edit to the current Session through its `/add-dir` or `/remove-dir` command. */
  edit: (edit: DirectoryEdit) => Promise<DirectoryEditOutcome>
}

/** Complete props: the composer row seat, the flow hole, the injected face, and the locale seat. */
export type SessionDirectoriesProps =
  PropsRuntime<'conversation.input.left'>
  & PropsRenderSlots<'conversation.input.directories.directoryFlow'>
  & InjectFace<SessionDirectoriesInjected>
  & PropsLocale<typeof PERMISSION_DIRECTORIES_NS>

/**
 * What the control is doing. A picked path is added while the flow stays
 * open, so the flow's own busy state covers the Host's grant, which can take
 * seconds on Windows.
 */
type Activity =
  | { readonly kind: 'idle' }
  | { readonly kind: 'picking' }
  | { readonly kind: 'running'; readonly action: DirectoryEdit['kind']; readonly viaFlow: boolean }

/** The last edit's refusal, shown beside the trigger until the next edit starts. */
type Failure = { readonly action: DirectoryEdit['kind']; readonly message: string }

/**
 * The current Session's writable directories: the main workspace, each
 * additional directory with its removal, a picker entry through the
 * directory-flow hole, and registered Workspaces to add in one click. The
 * list reads the `sandboxRoots` projection, so the pushed frame after a
 * command is the only confirmation; the control renders nothing while that
 * projection is absent.
 */
export function SessionDirectories({
  sessionId, useProjection, useSessions, useWorkspaces, useDirectoryFlow, renderSlot, edit, t,
}: SessionDirectoriesProps) {
  const view = useProjection('sandboxRoots')
  const preset = useProjection('permissions', selection => selection?.currentValue)
  const main = useSessions(state => state.byId[sessionId]?.cwd)
  const workspaces = useWorkspaces(state => state.items)
  const flowAvailable = useDirectoryFlow(occupied => occupied)
  const [open, setOpen] = useState(false)
  const [activity, setActivity] = useState<Activity>({ kind: 'idle' })
  const [failure, setFailure] = useState<Failure | null>(null)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => { alive.current = false }
  }, [])
  // An occupant that unloads mid-pick leaves nobody to cancel the flow.
  useEffect(() => {
    if (activity.kind === 'picking' && !flowAvailable) setActivity({ kind: 'idle' })
  }, [activity, flowAvailable])

  if (view === undefined) return null
  const roots: readonly string[] = view.roots
  const busy = activity.kind === 'running'

  const run = (change: DirectoryEdit, viaFlow: boolean): void => {
    setFailure(null)
    setActivity({ kind: 'running', action: change.kind, viaFlow })
    void edit(change).then(
      outcome => outcome,
      (reason: unknown): DirectoryEditOutcome => ({ ok: false, message: reason instanceof Error ? reason.message : String(reason) }),
    ).then((outcome) => {
      if (!alive.current) return
      setActivity({ kind: 'idle' })
      if (!outcome.ok) setFailure({ action: change.kind, message: outcome.message })
    })
  }

  const listed = new Set([main, ...roots])
  const candidates = workspaces.filter(workspace => !listed.has(workspace.path))
  const items: MenuEntry[] = [
    { type: 'label', id: 'heading', text: t('menu.heading') },
    { type: 'label', id: 'description', text: preset === WORKSPACE_WRITE ? t('menu.description') : t('inactive') },
    ...main === undefined ? [] : [{
      id: 'main',
      disabled: true,
      icon: <IconFolderCloseRegular size={16} />,
      label: (
        <span className={css.row} title={main}>
          <span className={css.path}>{main}</span>
          <span className={css.tag}>{t('menu.main')}</span>
        </span>
      ),
    }],
    ...roots.length === 0
      ? [{ type: 'label' as const, id: 'empty', text: t('menu.empty') }]
      : roots.map(root => ({
        id: `${REMOVE}${root}`,
        disabled: busy,
        icon: <IconFolderCloseRegular size={16} />,
        label: (
          <span className={css.row} title={root} aria-label={t('menu.remove', { path: root })}>
            <span className={css.path}>{root}</span>
            <span className={css.remove} aria-hidden><IconCloseOutlineRegular size={14} /></span>
          </span>
        ),
      })),
    ...flowAvailable
      ? [{ type: 'separator' as const, id: 'add-separator' }, { id: ADD, label: t('menu.add'), icon: <IconPlusOutlineRegular size={16} />, disabled: busy }]
      : [],
    ...candidates.length === 0 ? [] : [
      { type: 'separator' as const, id: 'workspaces-separator' },
      { type: 'label' as const, id: 'workspaces', text: t('menu.workspaces') },
      ...candidates.map(workspace => ({
        id: `${WORKSPACE}${workspace.path}`,
        disabled: busy,
        icon: <IconFolderCloseRegular size={16} />,
        label: (
          <span className={css.row} title={workspace.path}>
            {workspace.title === '' ? null : <span className={css.title}>{workspace.title}</span>}
            <span className={workspace.title === '' ? css.path : css.dimPath}>{workspace.path}</span>
          </span>
        ),
      })),
    ],
  ]

  const choose = (id: string): void => {
    setOpen(false)
    if (id === ADD) {
      setFailure(null)
      setActivity({ kind: 'picking' })
    } else if (id.startsWith(REMOVE)) {
      run({ kind: 'remove', path: id.slice(REMOVE.length) }, false)
    } else if (id.startsWith(WORKSPACE)) {
      run({ kind: 'add', path: id.slice(WORKSPACE.length) }, false)
    }
  }

  const flowOwner: DirectoryFlowOwnerProps = {
    open: activity.kind === 'picking' || (activity.kind === 'running' && activity.viaFlow),
    busy,
    onPicked: (path) => { run({ kind: 'add', path }, true) },
    onCancel: () => { setActivity({ kind: 'idle' }) },
    onError: (message) => {
      setActivity({ kind: 'idle' })
      setFailure({ action: 'add', message })
    },
  }

  const granting = activity.kind === 'running' && activity.action === 'add'
  const label = granting
    ? t('busy')
    : roots.length === 0 ? t('trigger.add') : t('trigger.count', { count: roots.length })

  return (
    <span className={css.wrap}>
      <Menu
        open={open}
        items={items}
        onSelect={choose}
        onClose={() => { setOpen(false) }}
        side="top"
        portal
        anchor={
          <button
            type="button"
            className={clsx(css.trigger, preset !== WORKSPACE_WRITE && css.inactive)}
            aria-label={granting || roots.length === 0 ? label : t('trigger.aria', { count: roots.length })}
            aria-busy={busy}
            title={preset === WORKSPACE_WRITE ? t('menu.description') : t('inactive')}
            disabled={busy}
            onClick={() => { setOpen(!open) }}
          >
            <span className={css.triggerIcon} aria-hidden><IconFolderCloseRegular /></span>
            <span className={css.triggerLabel}>{label}</span>
            <span className={clsx(css.chevron, open && css.chevronOpen)} aria-hidden>
              <IconChevronDownOutlineRegular />
            </span>
          </button>
        }
      />
      {failure !== null && (
        <span className={css.error} role="status" title={failure.message}>
          {t(failure.action === 'add' ? 'error.add' : 'error.remove', { message: failure.message })}
        </span>
      )}
      {renderSlot('conversation.input.directories.directoryFlow', flowOwner)}
    </span>
  )
}
