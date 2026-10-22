/**
 * The runner argv contract: what the seam formats is exactly what the
 * runner parses back, and every malformed invocation names its violation
 * before any directory or ACL is touched.
 */

import { describe, expect, it } from 'vitest'
import { formatRunnerArgs, parseRunnerArgs, tempWriteSid, workspaceWriteSid } from '../src/index.ts'
import type { RunnerInvocation } from '../src/index.ts'

const MAIN = String.raw`C:\work\main`
const EXTRA = String.raw`D:\extra`
const TEMP = String.raw`C:\Temp\dsh-abc123`
const ARGV = ['pwsh', '/Command', 'x'] as const

const invocations: Array<[string, RunnerInvocation]> = [
  ['read-only', { grants: 'none', mode: 'read-only', workspaces: [MAIN, EXTRA], temp: TEMP }],
  ['runner-owned workspace-write', { grants: 'runner', mode: 'workspace-write', workspaces: [MAIN, EXTRA], temp: TEMP }],
  ['caller-owned workspace-write', {
    grants: 'caller',
    mode: 'workspace-write',
    writable: [{ dir: MAIN, writeSid: workspaceWriteSid(MAIN) }, { dir: EXTRA, writeSid: workspaceWriteSid(EXTRA) }],
    temp: { dir: TEMP, writeSid: tempWriteSid(TEMP) },
  }],
]

describe('formatRunnerArgs and parseRunnerArgs', () => {
  it.each(invocations)('round-trips a %s invocation', (_label, invocation) => {
    expect(parseRunnerArgs(formatRunnerArgs(invocation, ARGV))).toEqual({ invocation, command: 'pwsh', args: ['/Command', 'x'] })
  })

  it('pairs one --write-sid per --workspace, main first', () => {
    const [, caller] = invocations[2]!
    expect(formatRunnerArgs(caller, ARGV)).toEqual([
      '--workspace', MAIN,
      '--workspace', EXTRA,
      '--temp', TEMP,
      '--mode', 'workspace-write',
      '--write-sid', workspaceWriteSid(MAIN),
      '--write-sid', workspaceWriteSid(EXTRA),
      '--temp-write-sid', tempWriteSid(TEMP),
      '--', ...ARGV,
    ])
  })

  const base = ['--workspace', MAIN, '--temp', TEMP]
  const sids = ['--write-sid', workspaceWriteSid(MAIN), '--temp-write-sid', tempWriteSid(TEMP)]

  it.each([
    ['an unknown flag', [...base, '--mode', 'read-only', '--bogus', 'x', '--', 'cmd'], 'unknown argument: --bogus'],
    ['a flag without a value', [...base, '--mode'], 'missing value after --mode'],
    ['no workspace', ['--temp', TEMP, '--mode', 'read-only', '--', 'cmd'], 'missing --workspace'],
    ['no temp', ['--workspace', MAIN, '--mode', 'read-only', '--', 'cmd'], 'missing --temp'],
    ['a repeated temp', [...base, '--temp', TEMP, '--mode', 'read-only', '--', 'cmd'], '--temp may appear only once'],
    ['no command', [...base, '--mode', 'read-only', '--'], 'missing command after --'],
    ['an unknown mode', [...base, '--mode', 'full', '--', 'cmd'], 'unknown mode: full'],
    ['SIDs under read-only', [...base, '--mode', 'read-only', ...sids, '--', 'cmd'], 'read-only does not accept --write-sid or --temp-write-sid'],
    ['a write SID without a temp SID', [...base, '--mode', 'workspace-write', '--write-sid', workspaceWriteSid(MAIN), '--', 'cmd'],
      'workspace-write requires one --write-sid per --workspace and one --temp-write-sid'],
    ['fewer write SIDs than workspaces', ['--workspace', EXTRA, ...base, '--mode', 'workspace-write', ...sids, '--', 'cmd'],
      'workspace-write requires one --write-sid per --workspace and one --temp-write-sid'],
    ['a write SID for another root', [...base, '--mode', 'workspace-write', '--write-sid', workspaceWriteSid(EXTRA), '--temp-write-sid', tempWriteSid(TEMP), '--', 'cmd'],
      String.raw`--write-sid does not match --workspace C:\work\main`],
    ['a temp SID for another directory', [...base, '--mode', 'workspace-write', '--write-sid', workspaceWriteSid(MAIN), '--temp-write-sid', tempWriteSid(MAIN), '--', 'cmd'],
      '--temp-write-sid does not match --temp'],
  ])('rejects %s', (_label, raw, message) => {
    expect(() => parseRunnerArgs(raw)).toThrow(message)
  })
})
