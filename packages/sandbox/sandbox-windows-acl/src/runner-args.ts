/**
 * The windows-acl runner's argv: the one place that builds and parses it.
 * The sandbox seam formats an invocation with {@link formatRunnerArgs}; the
 * runner parses its own argv with {@link parseRunnerArgs}. Both functions
 * are pure: filesystem checks (existence, disjointness) stay in the runner.
 *
 * Argv layout (a native-exe replacement keeps the same contract):
 *   ['--workspace', <dir>]+, '--temp', <dir>, '--mode', <read-only|workspace-write>,
 *   [['--write-sid', <S-1-4-…>]+, '--temp-write-sid', <S-1-4-…>], '--', <argv...>
 *
 * The first `--workspace` is the main root. With caller-owned grants,
 * `--write-sid` repeats once per `--workspace` and pairs with it by
 * position; each SID must equal `workspaceWriteSid(dir)` and the temp SID
 * must equal `tempWriteSid(temp)`.
 * @module @deepseek-ai/dsh-sandbox-windows-acl/runner-args
 */

import { tempWriteSid, workspaceWriteSid } from './workspace-sid.ts'

/** One directory the confined child may write, with the capability SID its ACE names. */
export interface AclWritableDirectory {
  /** The directory carrying the capability ACE. */
  dir: string
  /** The capability SID the ACE names (`workspaceWriteSid(dir)` for a workspace root). */
  writeSid: string
}

/**
 * The runner's confinement for one invocation. `grants` names who owns the
 * DACL grants: `none` under read-only, `runner` when the runner grants the
 * workspaces and a private child of the temp root for one invocation,
 * `caller` when the seam has already materialized every ACE and the runner
 * only checks the SIDs.
 */
export type RunnerInvocation =
  | {
    grants: 'none'
    mode: 'read-only'
    /** Workspace roots, main first; validated for existence only. */
    workspaces: readonly [string, ...string[]]
    /** The ambient temp directory; validated for existence only. */
    temp: string
  }
  | {
    grants: 'runner'
    mode: 'workspace-write'
    /** Workspace roots, main first; the runner grants each its derived SID. */
    workspaces: readonly [string, ...string[]]
    /** The temp ROOT beneath which the runner creates and removes a private directory. */
    temp: string
  }
  | {
    grants: 'caller'
    mode: 'workspace-write'
    /** Workspace roots with their SIDs, main first. */
    writable: readonly [AclWritableDirectory, ...AclWritableDirectory[]]
    /** The caller-granted private temp directory and its SID. */
    temp: AclWritableDirectory
  }

/** A parsed runner argv: the confinement plus the wrapped command. */
export interface ParsedRunnerArgs {
  /** The confinement the runner applies. */
  invocation: RunnerInvocation
  /** The wrapped program. */
  command: string
  /** The wrapped program's arguments. */
  args: string[]
}

/**
 * Build the runner arguments (everything after the runner program) for one invocation.
 * @param invocation - the grants owner, roots, and temp directory.
 * @param argv - the wrapped program and its arguments.
 * @returns the runner arguments, ending with `--` and the wrapped argv.
 */
export function formatRunnerArgs(invocation: RunnerInvocation, argv: readonly string[]): string[] {
  switch (invocation.grants) {
    case 'none':
    case 'runner':
      return [
        ...invocation.workspaces.flatMap(dir => ['--workspace', dir]),
        '--temp', invocation.temp,
        '--mode', invocation.mode,
        '--', ...argv,
      ]
    case 'caller':
      return [
        ...invocation.writable.flatMap(({ dir }) => ['--workspace', dir]),
        '--temp', invocation.temp.dir,
        '--mode', invocation.mode,
        ...invocation.writable.flatMap(({ writeSid }) => ['--write-sid', writeSid]),
        '--temp-write-sid', invocation.temp.writeSid,
        '--', ...argv,
      ]
    /* v8 ignore next 4 -- RunnerInvocation is a closed union; this branch is the static exhaustiveness guard. */
    default: {
      const unreachable: never = invocation
      throw new Error(`unreachable runner grants: ${JSON.stringify(unreachable)}`)
    }
  }
}

/** Read a single-valued flag; repetition is an error. */
function single(values: readonly string[] | undefined, flag: string): string | undefined {
  if (values === undefined) return undefined
  if (values.length > 1) throw new Error(`${flag} may appear only once`)
  return values[0]
}

const FLAGS = new Set(['--workspace', '--temp', '--mode', '--write-sid', '--temp-write-sid'])

/**
 * Parse the runner's argv (after the runner program).
 * @param raw - the runner arguments, ending with `--` and the wrapped argv.
 * @returns the validated invocation and wrapped command.
 * @throws Error naming the first violated rule: an unknown, repeated, or
 *   valueless flag, a missing workspace, temp, mode, or command, SIDs under
 *   read-only, unpaired SIDs, or a SID that does not match its directory.
 */
export function parseRunnerArgs(raw: readonly string[]): ParsedRunnerArgs {
  const values = new Map<string, string[]>()
  let index = 0
  while (index < raw.length) {
    const flag = raw[index++]
    if (flag === undefined || flag === '--') break
    if (!FLAGS.has(flag)) throw new Error(`unknown argument: ${flag}`)
    const value = raw[index++]
    if (value === undefined) throw new Error(`missing value after ${flag}`)
    values.set(flag, [...values.get(flag) ?? [], value])
  }
  const [main, ...extra] = values.get('--workspace') ?? []
  if (main === undefined) throw new Error('missing --workspace')
  const workspaces: [string, ...string[]] = [main, ...extra]
  const temp = single(values.get('--temp'), '--temp')
  if (temp === undefined) throw new Error('missing --temp')
  const mode = single(values.get('--mode'), '--mode')
  const [command, ...args] = raw.slice(index)
  if (command === undefined) throw new Error('missing command after --')
  const writeSids = values.get('--write-sid') ?? []
  const tempSid = single(values.get('--temp-write-sid'), '--temp-write-sid')
  const seamManaged = writeSids.length > 0 || tempSid !== undefined
  const parsed = (invocation: RunnerInvocation): ParsedRunnerArgs => ({ invocation, command, args })
  switch (mode) {
    case 'read-only':
      if (seamManaged) throw new Error('read-only does not accept --write-sid or --temp-write-sid')
      return parsed({ grants: 'none', mode, workspaces, temp })
    case 'workspace-write': {
      if (!seamManaged) return parsed({ grants: 'runner', mode, workspaces, temp })
      if (tempSid === undefined || writeSids.length !== workspaces.length) {
        throw new Error('workspace-write requires one --write-sid per --workspace and one --temp-write-sid')
      }
      const paired = (dir: string, position: number): AclWritableDirectory => {
        const writeSid = workspaceWriteSid(dir)
        if (writeSids[position] !== writeSid) throw new Error(`--write-sid does not match --workspace ${dir}`)
        return { dir, writeSid }
      }
      const writable: [AclWritableDirectory, ...AclWritableDirectory[]] = [
        paired(main, 0),
        ...extra.map((dir, position) => paired(dir, position + 1)),
      ]
      if (tempSid !== tempWriteSid(temp)) throw new Error('--temp-write-sid does not match --temp')
      return parsed({ grants: 'caller', mode, writable, temp: { dir: temp, writeSid: tempSid } })
    }
    default:
      throw new Error(`unknown mode: ${String(mode)}`)
  }
}
