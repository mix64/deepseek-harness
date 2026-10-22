// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import { bindSnapshotSelector, makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import type { DirectoryFlowOwnerProps } from '@deepseek-ai/dsh-client-ui-workspace/client'
import type { WorkspaceView } from '@deepseek-ai/dsh-api-workspace-controller/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import {
  SessionDirectories, type DirectoryEdit, type DirectoryEditOutcome, type SessionDirectoriesProps,
} from '../src/client/SessionDirectories.tsx'
import { en } from '../src/client/directories-locales.ts'

afterEach(cleanup)

const SESSION = 's1' as SessionId

function workspace(path: string, title: string): WorkspaceView {
  return {
    workspaceId: `w-${title}` as WorkspaceView['workspaceId'], path, title, sessionIds: [],
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
  }
}

interface Fixture {
  roots?: readonly string[] | undefined
  preset?: string
  workspaces?: readonly WorkspaceView[]
  flow?: boolean
  edit?: (edit: DirectoryEdit) => Promise<DirectoryEditOutcome>
}

function setup(fixture: Fixture = {}) {
  const projections = createSnapshotStore<{
    sandboxRoots: { roots: readonly string[] } | undefined
    permissions: { currentValue: string }
  }>({
    sandboxRoots: 'roots' in fixture
      ? (fixture.roots === undefined ? undefined : { roots: fixture.roots })
      : { roots: [] },
    permissions: { currentValue: fixture.preset ?? 'workspace-write' },
  })
  const sessions = createSnapshotStore({ byId: { [SESSION]: { cwd: '/home/me/project' } } })
  const workspaces = createSnapshotStore({ items: fixture.workspaces ?? [] })
  const flow = createSnapshotStore(fixture.flow ?? true)
  const edit = vi.fn(fixture.edit ?? (() => Promise.resolve<DirectoryEditOutcome>({ ok: true })))
  let owner: DirectoryFlowOwnerProps | undefined
  const useProjection = (key: 'sandboxRoots' | 'permissions', selector?: (value: unknown) => unknown) =>
    bindSnapshotSelector(projections)(state => (selector ?? (value => value))(state[key]))
  const props = {
    sessionId: SESSION,
    useProjection: useProjection as SessionDirectoriesProps['useProjection'],
    useSessions: bindSnapshotSelector(sessions) as SessionDirectoriesProps['useSessions'],
    useWorkspaces: bindSnapshotSelector(workspaces) as SessionDirectoriesProps['useWorkspaces'],
    useDirectoryFlow: bindSnapshotSelector(flow),
    renderSlot: ((_name: string, next: DirectoryFlowOwnerProps) => {
      owner = next
      return null
    }) as SessionDirectoriesProps['renderSlot'],
    edit,
    t: makeTranslate(en),
  } as Partial<SessionDirectoriesProps> as SessionDirectoriesProps
  render(<SessionDirectories {...props} />)
  return {
    edit,
    projections,
    owner: (): DirectoryFlowOwnerProps => {
      if (owner === undefined) throw new Error('the directory-flow hole was not rendered')
      return owner
    },
  }
}

function trigger(): HTMLButtonElement {
  return screen.getByRole('button', { name: /directories|directory|Granting/i }) as HTMLButtonElement
}

describe('SessionDirectories', () => {
  it('renders nothing without the sandboxRoots projection', () => {
    setup({ roots: undefined })
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('lists the main workspace, each additional directory, and the Workspaces not yet listed', () => {
    setup({
      roots: ['/data/a', '/data/b'],
      workspaces: [workspace('/home/me/project', 'project'), workspace('/data/a', 'a'), workspace('/srv/docs', 'docs')],
    })
    expect(trigger().textContent).toBe('Directories (2)')
    expect(trigger().getAttribute('aria-label')).toBe('Additional directories, 2')
    fireEvent.click(trigger())
    expect(screen.getByText('Writable directories')).toBeTruthy()
    expect(screen.getByText('In Workspace Write mode, the agent can also change files in these directories.')).toBeTruthy()
    expect(screen.getAllByRole('menuitem').map(item => item.textContent)).toEqual([
      '/home/me/projectWorkspace', '/data/a', '/data/b', 'Add directory…', 'docs/srv/docs',
    ])
    expect(screen.getByRole<HTMLButtonElement>('menuitem', { name: /project/ }).disabled).toBe(true)
    expect(screen.getByRole('menuitem', { name: 'Remove /data/b' })).toBeTruthy()
  })

  it('offers the add action only while a directory flow is composed and shows the empty state', () => {
    setup({ flow: false })
    expect(trigger().textContent).toBe('Add directory')
    expect(trigger().getAttribute('aria-label')).toBe('Add directory')
    fireEvent.click(trigger())
    expect(screen.getByText('No additional directories')).toBeTruthy()
    expect(screen.queryByRole('menuitem', { name: 'Add directory…' })).toBeNull()
  })

  it('adds a registered Workspace in one click and stays busy until the Host answers', async () => {
    const answered = Promise.withResolvers<DirectoryEditOutcome>()
    const { edit } = setup({ workspaces: [workspace('/srv/docs', 'docs')], edit: () => answered.promise })
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: /docs/ }))
    expect(edit).toHaveBeenCalledExactlyOnceWith({ kind: 'add', path: '/srv/docs' })
    expect(trigger().textContent).toBe('Granting access…')
    expect(trigger().disabled).toBe(true)
    await act(async () => { answered.resolve({ ok: true }) })
    expect(trigger().textContent).toBe('Add directory')
    expect(trigger().disabled).toBe(false)
  })

  it('removes a listed directory and shows a refusal beside the trigger', async () => {
    const { edit } = setup({
      roots: ['/data/a'],
      edit: () => Promise.resolve({ ok: false, message: '"/data/a" is not an additional directory' }),
    })
    fireEvent.click(trigger())
    await act(async () => { fireEvent.click(screen.getByRole('menuitem', { name: 'Remove /data/a' })) })
    expect(edit).toHaveBeenCalledExactlyOnceWith({ kind: 'remove', path: '/data/a' })
    expect(screen.getByRole('status').textContent)
      .toBe('Could not remove the directory: "/data/a" is not an additional directory')
  })

  it('adds a picked directory while the flow stays open and busy, then closes it', async () => {
    const answered = Promise.withResolvers<DirectoryEditOutcome>()
    const { edit, owner } = setup({ edit: () => answered.promise })
    expect(owner().open).toBe(false)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add directory…' }))
    expect(owner()).toMatchObject({ open: true, busy: false })
    act(() => { owner().onPicked('E:\\with space') })
    expect(edit).toHaveBeenCalledExactlyOnceWith({ kind: 'add', path: 'E:\\with space' })
    expect(owner()).toMatchObject({ open: true, busy: true })
    await act(async () => { answered.resolve({ ok: false, message: 'grant refused' }) })
    expect(owner()).toMatchObject({ open: false, busy: false })
    expect(screen.getByRole('status').textContent).toBe('Could not add the directory: grant refused')
  })

  it('closes the flow on cancel and reports a flow failure', () => {
    const { edit, owner } = setup()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add directory…' }))
    act(() => { owner().onCancel() })
    expect(owner().open).toBe(false)
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('menuitem', { name: 'Add directory…' }))
    act(() => { owner().onError('chooser unavailable') })
    expect(owner().open).toBe(false)
    expect(screen.getByRole('status').textContent).toBe('Could not add the directory: chooser unavailable')
    expect(edit).not.toHaveBeenCalled()
  })

  it('says the directories are not writable outside Workspace Write', () => {
    setup({ roots: ['/data/a'], preset: 'read-only' })
    expect(trigger().title).toBe('Not writable in the current mode')
    fireEvent.click(trigger())
    expect(screen.getByText('Not writable in the current mode')).toBeTruthy()
  })
})
