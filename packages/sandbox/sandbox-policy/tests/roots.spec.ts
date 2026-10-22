/**
 * The validated write path for a session's additional roots and its
 * `/add-dir` and `/remove-dir` commands, over a real local filesystem in
 * directories outside the host temp areas (temp areas are inadmissible).
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { createInboxStub } from '@deepseek-ai/dsh-agent-loop-testkit'
import { brandString } from '@deepseek-ai/dsh-brand'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import LocalFileSystem from '@deepseek-ai/dsh-fs-local'
import type { SandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import { FsError, FsTargetKey } from '@deepseek-ai/dsh-fs'
import type { FsTarget } from '@deepseek-ai/dsh-fs'
import SandboxPolicyService, { describeRootRefusal } from '@deepseek-ai/dsh-sandbox-policy'
import type { AdditionalRoot, AdditionalRootRefusal } from '@deepseek-ai/dsh-sandbox-policy'
import { createScope } from '@deepseek-ai/dsh-scope'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import type { Session } from '@deepseek-ai/dsh-session'
import SessionProjectionRegistry from '@deepseek-ai/dsh-session-projection'
import { outsideTempWorkspaceParent } from '../../../../scripts/snapshot-workspace-parent.ts'

const scratch: string[] = []
afterEach(() => {
  for (const dir of scratch.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/** A fresh canonical tree outside the temp areas: the session workspace plus named siblings. */
function tree(...names: string[]): { base: string; main: string; dirs: Record<string, string> } {
  const base = realpathSync.native(mkdtempSync(join(outsideTempWorkspaceParent(), '.dsh-policy-roots-')))
  scratch.push(base)
  const main = join(base, 'main')
  mkdirSync(main)
  const dirs: Record<string, string> = {}
  for (const name of names) {
    dirs[name] = join(base, name)
    mkdirSync(dirs[name], { recursive: true })
  }
  return { base, main, dirs }
}

async function harness(main: string, options: { maxAdditionalRoots?: number; confine?: (policy: SandboxPolicy) => void } = {}) {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SessionProjectionRegistry)
  await ctx.plugin(CommandRuntime)
  await ctx.plugin(LocalFileSystem, { cwd: main })
  const confine = vi.fn(async (argv: readonly string[], policy: SandboxPolicy) => {
    options.confine?.(policy)
    return { argv: [...argv], enforcement: 'full' as const, denialSignatures: [], runnerFailureRules: [] }
  })
  ctx.provide('sandbox', { confine } as never)
  await ctx.plugin(SandboxPolicyService, { mode: 'workspace-write', ...options.maxAdditionalRoots === undefined ? {} : { maxAdditionalRoots: options.maxAdditionalRoots } })
  const session = ctx.sessions.create(SessionId(`roots-${String(scratch.length)}`), { meta: { cwd: main } })
  return { ctx, session, confine }
}

function rootEvents(session: Session) {
  return session.snapshotEvents().filter(event => event.type === 'sandbox/additional-roots')
}

describe('editAdditionalRoots', () => {
  it('admits an existing directory once, preflighting the prospective workspace-write policy', async () => {
    const { main, dirs } = tree('extra')
    const { ctx, session, confine } = await harness(main)
    const added = await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.extra! })
    expect(added).toEqual({ roots: [dirs.extra], changed: true, refused: [] })
    expect(confine).toHaveBeenCalledWith(['true'], { mode: 'workspace-write', workspaceRoot: main, additionalRoots: [dirs.extra], sessionId: session.id }, undefined)
    expect(ctx.sandboxPolicy.resolve({ session }).additionalRoots).toEqual([dirs.extra])

    expect(await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: join(dirs.extra!, '.') }))
      .toEqual({ roots: [dirs.extra], changed: false, refused: [] })
    expect(rootEvents(session)).toHaveLength(1)
    expect(confine).toHaveBeenCalledTimes(1)
  })

  it('resolves a relative path against the session workspace', async () => {
    const { main, dirs } = tree('sibling')
    const { ctx, session } = await harness(main)
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: '../sibling' })).roots).toEqual([dirs.sibling])
  })

  it('refuses inadmissible paths without logging anything', async () => {
    const { base, main, dirs } = tree('extra', 'extra/nested', 'main/inner')
    const file = join(base, 'file.txt')
    writeFileSync(file, 'x')
    const { ctx, session } = await harness(main, { maxAdditionalRoots: 1 })
    await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.extra! })
    const refusals = []
    for (const path of [join(base, 'missing'), file, main, dirs['main/inner']!, base, dirs['extra/nested']!, realpathSync.native(tmpdir())]) {
      const result = await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path })
      expect(result.changed).toBe(false)
      refusals.push(result.refused[0])
    }
    expect(refusals.map(refusal => refusal?.kind === 'rejected' ? refusal.rejection.kind : refusal?.kind)).toEqual([
      'not-found', 'not-directory', 'main-root', 'inside-main-root', 'contains-main-root', 'overlaps-additional-root', 'temp-area',
    ])
    const sibling = tree('other').dirs.other!
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: sibling })).refused)
      .toEqual([{ kind: 'rejected', path: sibling, rejection: { kind: 'limit', limit: 1 } }])
    expect(rootEvents(session)).toHaveLength(1)
  })

  it('serializes concurrent edits so a nested add sees the root admitted before it', async () => {
    const { main, dirs } = tree('outer', 'outer/inner')
    const { ctx, session } = await harness(main)
    const [outer, inner] = await Promise.all([
      ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.outer! }),
      ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs['outer/inner']! }),
    ])
    expect(outer.roots).toEqual([dirs.outer])
    expect(inner.refused).toEqual([{ kind: 'rejected', path: dirs['outer/inner'], rejection: { kind: 'overlaps-additional-root', root: dirs.outer } }])
    expect(rootEvents(session)).toHaveLength(1)
  })

  it('reports a sandbox refusal and logs nothing', async () => {
    const { main, dirs } = tree('denied', 'refused')
    const { ctx, session } = await harness(main, {
      confine: (policy) => {
        if (policy.additionalRoots.includes(dirs.denied!)) throw new Error('grant failed')
        // A provider may reject with a non-Error value; its text is the detail.
        if (policy.additionalRoots.includes(dirs.refused!)) throw 'runner refused'
      },
    })
    expect(await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'replace', paths: [dirs.denied!, dirs.refused!] })).toEqual({
      roots: [],
      changed: false,
      refused: [
        { kind: 'sandbox-refused', path: dirs.denied, detail: 'grant failed' },
        { kind: 'sandbox-refused', path: dirs.refused, detail: 'runner refused' },
      ],
    })
    expect(rootEvents(session)).toHaveLength(0)
  })

  it('reports the whole causal chain of a refusal on one bounded line', async () => {
    const { main, dirs } = tree('nested', 'aggregate', 'long')
    const win32 = new Error('SetNamedSecurityInfoW failed (Win32 5): Access is denied.\r\n: grantWrite(D:\\Temp\\dsh-1)')
    const { ctx, session } = await harness(main, {
      confine: (policy) => {
        const [root] = policy.additionalRoots.slice(-1)
        if (root === dirs.nested) throw new Error(`grant failed for workspace root ${main}`, { cause: win32 })
        if (root === dirs.aggregate) throw new AggregateError([win32, new Error('rmdir D:\\Temp\\dsh-1: EBUSY')], 'temp grant failed and its cleanup also failed')
        if (root === dirs.long) throw new Error('x'.repeat(5000), { cause: win32 })
      },
    })
    const refusal = async (path: string) => (await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path })).refused[0]!

    expect(describeRootRefusal(await refusal(dirs.nested!))).toBe(
      `the sandbox could not grant ${JSON.stringify(dirs.nested)}: grant failed for workspace root ${main}: `
      + 'SetNamedSecurityInfoW failed (Win32 5): Access is denied. : grantWrite(D:\\Temp\\dsh-1)',
    )
    expect(describeRootRefusal(await refusal(dirs.aggregate!))).toBe(
      `the sandbox could not grant ${JSON.stringify(dirs.aggregate)}: temp grant failed and its cleanup also failed `
      + '[SetNamedSecurityInfoW failed (Win32 5): Access is denied. : grantWrite(D:\\Temp\\dsh-1); rmdir D:\\Temp\\dsh-1: EBUSY]',
    )
    const long = await refusal(dirs.long!)
    expect(long.kind === 'sandbox-refused' && long.detail.length).toBeLessThanOrEqual(1000)
    const longText = describeRootRefusal(long)
    expect(longText).toMatch(/": x+\.\.\.x+: SetNamedSecurityInfoW/)
    expect(longText.endsWith('SetNamedSecurityInfoW failed (Win32 5): Access is denied. : grantWrite(D:\\Temp\\dsh-1)')).toBe(true)
  })

  it('admits without a preflight when no sandbox provider is composed', async () => {
    const { main, dirs } = tree('extra')
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(LocalFileSystem, { cwd: main })
    await ctx.plugin(SandboxPolicyService, {})
    const session = ctx.sessions.create(SessionId('roots-no-sandbox'), { meta: { cwd: main } })
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.extra! })).roots).toEqual([dirs.extra])
  })

  it('resolves against the deployment root for a session without a cwd', async () => {
    const { main, dirs } = tree('sibling')
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(LocalFileSystem, { cwd: main })
    await ctx.plugin(SandboxPolicyService, { workspaceRoot: main })
    const session = ctx.sessions.create(SessionId('roots-no-cwd'))
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: '../sibling' })).roots).toEqual([dirs.sibling])
  })

  it('checks only the temp areas the execution world can see', async () => {
    // A remote world exposes no host temp path, so a host temp spelling is an ordinary remote directory there.
    const hostTemp = realpathSync.native(tmpdir())
    const target = (path: string): FsTarget => ({ targetKey: FsTargetKey(path), displayPath: path })
    const remote = {
      resolve: (path: string) => {
        if (path === '/gone') return Promise.reject(new FsError('gone', 'FS_NOT_FOUND'))
        if (path === '/broken') return Promise.reject(new FsError('io failed', 'FS_IO_ERROR'))
        return Promise.resolve(target(path))
      },
      processPath: (resolved: FsTarget) => resolved.displayPath,
      processPathFromHostPath: () => undefined,
      stat: () => Promise.resolve({ version: 'v', type: 'directory' as const }),
    }
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    ctx.provide('fs', remote as never)
    await ctx.plugin(SandboxPolicyService, {})
    const session = ctx.sessions.create(SessionId('roots-remote'), { meta: { cwd: '/srv/work' } })
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: hostTemp })).roots).toEqual([hostTemp])
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: '/gone' })).refused).toEqual([{ kind: 'not-found', path: '/gone' }])
    await expect(ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: '/broken' })).rejects.toThrow('io failed')
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: '/srv/next' })).roots).toEqual([hostTemp, '/srv/next'])
  })

  it('removes by listed spelling even after the directory disappears, and refuses an unlisted path', async () => {
    const { main, dirs } = tree('gone', 'kept')
    const { ctx, session } = await harness(main)
    await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'replace', paths: [dirs.gone!, dirs.kept!] })
    rmSync(dirs.gone!, { recursive: true })
    expect(await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'remove', path: dirs.gone! }))
      .toEqual({ roots: [dirs.kept], changed: true, refused: [] })
    expect((await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'remove', path: dirs.gone! })).refused)
      .toEqual([{ kind: 'not-listed', path: dirs.gone }])
  })

  it('replaces the whole list in one event, admitting valid paths and refusing the rest', async () => {
    const { base, main, dirs } = tree('a', 'b', 'old')
    const { ctx, session } = await harness(main)
    await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.old! })
    const result = await ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'replace', paths: [dirs.a!, join(base, 'missing'), dirs.b!] })
    expect(result).toEqual({ roots: [dirs.a, dirs.b], changed: true, refused: [{ kind: 'not-found', path: join(base, 'missing') }] })
    expect(rootEvents(session).map(event => event.data.roots)).toEqual([[dirs.old], [dirs.a, dirs.b]])
  })

  it('appends nothing for an edit cancelled before it applies', async () => {
    const { main, dirs } = tree('extra')
    const { ctx, session } = await harness(main)
    const reason = new Error('cancelled')
    await expect(ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: dirs.extra! }, AbortSignal.abort(reason))).rejects.toBe(reason)
    expect(rootEvents(session)).toHaveLength(0)
  })

  it('still reads the logged list once the policy service has unloaded', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    const fiber = await ctx.plugin(SandboxPolicyService, {})
    const policy = ctx.sandboxPolicy
    const session = ctx.sessions.create(SessionId('roots-unloaded'))
    session.append('sandbox/additional-roots', { roots: [brandString<AdditionalRoot>('/extra')] })
    await fiber.dispose()
    expect(policy.additionalRootsOf(session)).toEqual(['/extra'])
  })

  it('fails explicitly without a filesystem provider', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SessionProjectionRegistry)
    await ctx.plugin(SandboxPolicyService, {})
    const session = ctx.sessions.create(SessionId('roots-no-fs'), { meta: { cwd: process.cwd() } })
    await expect(ctx.sandboxPolicy.editAdditionalRoots(session, { kind: 'add', path: process.cwd() }))
      .rejects.toThrow('sandbox-policy: editing additional roots requires a filesystem provider (ctx.fs)')
  })
})

describe('/add-dir and /remove-dir', () => {
  async function agentFor(ctx: Context, session: Session): Promise<Agent> {
    const agent: Agent = {
      id: session.id,
      options: {},
      session,
      inbox: createInboxStub(),
      model: { current: () => undefined, select: () => {} },
      ctx: new Context(),
      status: 'idle',
      send: () => {},
      followup: () => {},
      steer: () => {},
      inject: () => {},
      cancel: () => {},
      runMaintenance: task => task(new AbortController().signal),
      whenIdle: () => Promise.resolve(),
    }
    await ctx.plugin(Object.assign((inner: Context) => { createScope(inner, agent) }, { inject: ['commands'] }))
    return agent
  }

  it('adds a JSON-quoted path, lists, and removes', async () => {
    const { main, dirs } = tree('with space')
    const { ctx, session } = await harness(main)
    const agent = await agentFor(ctx, session)
    const run = async (line: string) => (await ctx.commands.execute(agent, line, [], new AbortController().signal))?.result
    const quoted = JSON.stringify(dirs['with space'])
    expect(await run('/add-dir')).toEqual({ kind: 'success', text: 'no additional directories' })
    expect(await run(`/add-dir ${quoted}`)).toEqual({ kind: 'success', text: `added ${quoted}; additional directories: ${quoted}` })
    expect(await run(`/add-dir ${dirs['with space']!}`)).toEqual({ kind: 'success', text: `${quoted} is already an additional directory` })
    expect(await run('/add-dir')).toEqual({ kind: 'success', text: `additional directories: ${quoted}` })
    expect(await run(`/remove-dir ${quoted}`)).toEqual({ kind: 'success', text: `removed ${quoted}; additional directories: none` })
  })

  it('reports refusals and malformed input as command errors', async () => {
    const { main } = tree()
    const { ctx, session } = await harness(main)
    const agent = await agentFor(ctx, session)
    const run = async (line: string) => (await ctx.commands.execute(agent, line, [], new AbortController().signal))?.result
    expect(await run(`/add-dir ${JSON.stringify(main)}`)).toEqual({ kind: 'error', text: `${JSON.stringify(main)} is the session workspace` })
    expect(await run('/add-dir "unterminated')).toEqual({ kind: 'error', text: 'expected one JSON string literal, got "unterminated' })
    expect(await run('/remove-dir')).toEqual({ kind: 'error', text: 'usage: /remove-dir <directory>' })
    expect(await run('/remove-dir "a" "b"')).toEqual({ kind: 'error', text: 'expected one JSON string literal, got "a" "b"' })
    expect(await run('/add-dir "1"x')).toEqual({ kind: 'error', text: 'expected one JSON string literal, got "1"x' })
    expect(await run(`/remove-dir ${JSON.stringify(main)}`)).toEqual({ kind: 'error', text: `${JSON.stringify(main)} is not an additional directory of this session` })
    expect(rootEvents(session)).toHaveLength(0)
  })
})

describe('describeRootRefusal', () => {
  const path = '/p'
  it.each<[AdditionalRootRefusal, string]>([
    [{ kind: 'not-found', path }, '"/p" does not exist'],
    [{ kind: 'not-directory', path }, '"/p" is not a directory'],
    [{ kind: 'not-listed', path }, '"/p" is not an additional directory of this session'],
    [{ kind: 'sandbox-refused', path, detail: 'denied' }, 'the sandbox could not grant "/p": denied'],
    [{ kind: 'rejected', path, rejection: { kind: 'filesystem-root' } }, '"/p" is a filesystem root'],
    [{ kind: 'rejected', path, rejection: { kind: 'main-root' } }, '"/p" is the session workspace'],
    [{ kind: 'rejected', path, rejection: { kind: 'inside-main-root' } }, '"/p" is inside the session workspace'],
    [{ kind: 'rejected', path, rejection: { kind: 'contains-main-root' } }, '"/p" contains the session workspace'],
    [{ kind: 'rejected', path, rejection: { kind: 'overlaps-additional-root', root: '/q' } }, '"/p" overlaps the additional directory "/q"'],
    [{ kind: 'rejected', path, rejection: { kind: 'temp-area', temp: '/tmp' } }, '"/p" overlaps the temporary area "/tmp"'],
    [{ kind: 'rejected', path, rejection: { kind: 'limit', limit: 2 } }, 'a session can hold at most 2 additional directories'],
  ])('describes %o', (refusal, text) => {
    expect(describeRootRefusal(refusal)).toBe(text)
  })
})
