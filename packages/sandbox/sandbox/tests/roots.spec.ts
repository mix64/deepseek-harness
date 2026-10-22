/**
 * Tests for the workspace-root derivation: the additional-root admission
 * rule, the enforceable root list, and the mode's meaning as a canonical
 * allow-list. Pinned here so the fs fence and every runner dialect cannot
 * drift.
 */

import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  canonicalPath, checkAdditionalRoot, sameSandboxPolicy, tempAreas, workspaceRoots, workspaceWritableRoots, writableRoots,
} from '@deepseek-ai/dsh-sandbox'
import type { AdditionalRootContext, SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import { outsideTempWorkspaceParent } from '../../../../scripts/snapshot-workspace-parent.ts'

/** Every temp root created by this file, removed after each test. */
const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A fresh canonical directory inside the host temp area. */
function scratch(prefix: string): string {
  const dir = realpathSync.native(mkdtempSync(join(tmpdir(), prefix)))
  roots.push(dir)
  return dir
}

/** A fresh canonical directory outside every host temp area, where additional roots are admissible. */
function outsideTemp(name: string): string {
  const dir = join(realpathSync.native(mkdtempSync(join(outsideTempWorkspaceParent(), '.dsh-roots-'))), name)
  mkdirSync(dir)
  roots.push(dirname(dir))
  return dir
}

describe('canonicalPath', () => {
  it('resolves symlinks (an existing path realpaths)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dsh-roots-'))
    roots.push(dir)
    expect(canonicalPath(dir)).toBe(realpathSync.native(dir))
  })

  it('returns the spelling as-is when the path cannot be resolved (conservative — matches nothing until it exists)', () => {
    expect(canonicalPath('/does/not/exist/anywhere-xyz')).toBe('/does/not/exist/anywhere-xyz')
  })
})

describe('workspaceWritableRoots', () => {
  it('workspace-write grants only the workspace when no extra root is configured', () => {
    const ws = mkdtempSync(join(tmpdir(), 'dsh-ws-'))
    roots.push(ws)
    expect(workspaceWritableRoots({ mode: 'workspace-write', workspaceRoot: ws, additionalRoots: [] })).toEqual([realpathSync.native(ws)])
  })

  it('workspace-write deduplicates physical extra directories and rejects symlink aliases', () => {
    const ws = mkdtempSync(join(tmpdir(), 'dsh-ws-'))
    const extra = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-extra-')))
    const alias = join(ws, 'alias')
    symlinkSync(extra, alias, 'dir')
    roots.push(ws, extra)
    const grants = workspaceWritableRoots({
      mode: 'workspace-write',
      workspaceRoot: ws, additionalRoots: [],
      additionalWritableRoots: [extra, extra],
    })
    expect(grants).toEqual([realpathSync.native(ws), realpathSync.native(extra)])
    expect(() => workspaceWritableRoots({ mode: 'workspace-write', workspaceRoot: ws, additionalRoots: [], additionalWritableRoots: [alias] }))
      .toThrow('use the physical directory path')
  })

  it('rejects missing and non-directory extra roots before granting access', () => {
    const ws = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-roots-')))
    roots.push(ws)
    const file = join(ws, 'file.txt')
    writeFileSync(file, 'file')
    expect(() => workspaceWritableRoots({ mode: 'workspace-write', workspaceRoot: ws, additionalRoots: [], additionalWritableRoots: [file] }))
      .toThrow('expected an existing directory')
    expect(() => workspaceWritableRoots({ mode: 'workspace-write', workspaceRoot: ws, additionalRoots: [], additionalWritableRoots: [join(ws, 'missing')] }))
      .toThrow('cannot read the directory')
  })

  it('read-only grants nothing even when extra roots are carried on the policy', () => {
    expect(workspaceWritableRoots({ mode: 'read-only', workspaceRoot: '/ws', additionalRoots: [], additionalWritableRoots: ['/extra'] })).toEqual([])
    expect(writableRoots({ mode: 'read-only', workspaceRoot: '/ws', additionalRoots: [], additionalWritableRoots: ['/extra'] })).toEqual([])
  })
})

describe('checkAdditionalRoot', () => {
  const posixContext: AdditionalRootContext = { main: '/work/main', others: ['/work/extra'], temps: ['/tmp'], limit: 4 }

  it.each([
    ['/', { kind: 'filesystem-root' }],
    ['/work/main', { kind: 'main-root' }],
    ['/work/main/', { kind: 'main-root' }],
    ['/work/main/sub', { kind: 'inside-main-root' }],
    ['/work', { kind: 'contains-main-root' }],
    ['/tmp/scratch', { kind: 'temp-area', temp: '/tmp' }],
    ['/work/extra', { kind: 'overlaps-additional-root', root: '/work/extra' }],
    ['/work/extra/deeper', { kind: 'overlaps-additional-root', root: '/work/extra' }],
  ])('rejects %s under POSIX rules', (candidate, rejection) => {
    expect(checkAdditionalRoot(candidate, posixContext)).toEqual(rejection)
  })

  it('treats every candidate as inside a main root that is the filesystem root', () => {
    expect(checkAdditionalRoot('/work', { ...posixContext, main: '/' })).toEqual({ kind: 'inside-main-root' })
  })

  it('admits a disjoint sibling, including one that shares a name prefix', () => {
    expect(checkAdditionalRoot('/work/other', posixContext)).toBeUndefined()
    expect(checkAdditionalRoot('/work/main-two', posixContext)).toBeUndefined()
    expect(checkAdditionalRoot('/work/extra2', posixContext)).toBeUndefined()
  })

  it('rejects a root that contains a temp area', () => {
    expect(checkAdditionalRoot('/home/u', { ...posixContext, temps: ['/home/u/.cache/tmp'] }))
      .toEqual({ kind: 'temp-area', temp: '/home/u/.cache/tmp' })
  })

  it('reports the limit only after every path rule passes', () => {
    expect(checkAdditionalRoot('/work/other', { ...posixContext, limit: 1 })).toEqual({ kind: 'limit', limit: 1 })
    expect(checkAdditionalRoot('/work/main/sub', { ...posixContext, limit: 1 })).toEqual({ kind: 'inside-main-root' })
  })

  it('compares drive-letter roots case-insensitively and ignores POSIX-only temp spellings', () => {
    const context: AdditionalRootContext = {
      main: String.raw`C:\Work\Main`,
      others: [String.raw`D:\Extra`],
      temps: ['/tmp', String.raw`C:\Users\me\AppData\Local\Temp`],
      limit: 4,
    }
    expect(checkAdditionalRoot(String.raw`c:\work\main\Sub`, context)).toEqual({ kind: 'inside-main-root' })
    expect(checkAdditionalRoot(String.raw`d:\extra`, context)).toEqual({ kind: 'overlaps-additional-root', root: String.raw`D:\Extra` })
    expect(checkAdditionalRoot(String.raw`C:\Users\me`, context)).toEqual({ kind: 'temp-area', temp: String.raw`C:\Users\me\AppData\Local\Temp` })
    expect(checkAdditionalRoot('E:\\', context)).toEqual({ kind: 'filesystem-root' })
    expect(checkAdditionalRoot(String.raw`E:\Other`, context)).toBeUndefined()
  })

  it('treats a UNC share root as a filesystem root', () => {
    const context: AdditionalRootContext = { main: String.raw`\\server\share\work`, others: [], temps: [], limit: 4 }
    expect(checkAdditionalRoot('\\\\server\\share\\', context)).toEqual({ kind: 'filesystem-root' })
    expect(checkAdditionalRoot(String.raw`\\server\share\other`, context)).toBeUndefined()
  })
})

describe('workspaceRoots', () => {
  it('keeps the main root first even when it does not exist', () => {
    const missing = join(tmpdir(), 'dsh-roots-missing-main-xyz')
    expect(workspaceRoots({ mode: 'read-only', workspaceRoot: missing, additionalRoots: [] })).toEqual([missing])
  })

  it('keeps admissible additional roots canonical and in policy order, independent of mode', () => {
    const main = outsideTemp('main')
    const second = outsideTemp('second')
    const first = outsideTemp('first')
    for (const mode of ['read-only', 'workspace-write', 'danger-full-access'] as const) {
      expect(workspaceRoots({ mode, workspaceRoot: main, additionalRoots: [second, first] })).toEqual([main, second, first])
    }
  })

  it('drops entries that are missing, not directories, or overlap the main root, an earlier root, or a temp area', () => {
    const main = outsideTemp('main')
    const extra = outsideTemp('extra')
    const file = join(extra, 'file.txt')
    writeFileSync(file, 'x')
    const nested = join(main, 'nested')
    mkdirSync(nested)
    const tempChild = scratch('dsh-roots-temp-')
    const policy: SandboxExecutionPolicy = {
      mode: 'workspace-write',
      workspaceRoot: main,
      additionalRoots: [join(extra, 'missing'), file, nested, extra, join(extra, '.'), tempChild, main],
    }
    expect(workspaceRoots(policy)).toEqual([main, extra])
  })

  it('places explicit extra directories before session roots and drops a session root inside one', () => {
    const main = outsideTemp('main')
    const shared = outsideTemp('shared')
    const inner = join(shared, 'inner')
    mkdirSync(inner)
    const session = outsideTemp('session')
    const policy: SandboxExecutionPolicy = {
      mode: 'workspace-write',
      workspaceRoot: main,
      additionalWritableRoots: [shared],
      additionalRoots: [inner, session],
    }
    expect(workspaceRoots(policy)).toEqual([main, shared, session])
    expect(workspaceRoots({ ...policy, mode: 'read-only' })).toEqual([main, inner, session])
  })
})

describe('writableRoots', () => {
  it('read-only grants nothing', () => {
    expect(writableRoots({ mode: 'read-only', workspaceRoot: process.cwd(), additionalRoots: [] })).toEqual([])
  })

  it('workspace-write grants every workspace root plus the temp areas', () => {
    const main = outsideTemp('main')
    const extra = outsideTemp('extra')
    expect(writableRoots({ mode: 'workspace-write', workspaceRoot: main, additionalRoots: [extra] })).toEqual([main, extra, ...tempAreas()])
  })

  it('workspace-write grants the workspace root plus the platform temp areas, canonical and deduplicated', () => {
    const ws = mkdtempSync(join(tmpdir(), 'dsh-ws-'))
    roots.push(ws)
    const writable = writableRoots({ mode: 'workspace-write', workspaceRoot: ws, additionalRoots: [] })
    expect(writable).toContain(realpathSync.native(ws))
    expect(writable).toContain(canonicalPath('/tmp'))
    expect(writable).toContain(realpathSync.native(tmpdir()))
    // Deduplicated after canonicalization (/tmp and os.tmpdir() may coincide).
    expect(new Set(writable).size).toBe(writable.length)
  })

  it('workspace-write includes an explicit extra directory beside the temp areas', () => {
    const ws = mkdtempSync(join(tmpdir(), 'dsh-ws-'))
    const extra = realpathSync.native(mkdtempSync(join(tmpdir(), 'dsh-extra-')))
    roots.push(ws, extra)
    expect(writableRoots({
      mode: 'workspace-write',
      workspaceRoot: ws,
      additionalRoots: [],
      additionalWritableRoots: [extra],
    })).toContain(realpathSync.native(extra))
  })
})

describe('sameSandboxPolicy', () => {
  const base: SandboxExecutionPolicy = { mode: 'workspace-write', workspaceRoot: '/w', additionalRoots: ['/a', '/b'] }

  it('is true for field-wise equal policies', () => {
    expect(sameSandboxPolicy(base, { ...base, additionalRoots: ['/a', '/b'] })).toBe(true)
  })

  it.each([
    ['mode', { mode: 'read-only' }],
    ['main root', { workspaceRoot: '/v' }],
    ['root order', { additionalRoots: ['/b', '/a'] }],
    ['root count', { additionalRoots: ['/a'] }],
    ['explicit extra directories', { additionalWritableRoots: ['/c'] }],
  ] as const)('is false when the %s differs', (_label, change) => {
    expect(sameSandboxPolicy(base, { ...base, ...change })).toBe(false)
  })
})
