/**
 * The windows-acl confinement runner: the argv-prefix wrapper the sandbox
 * seam spawns in place of the caller's command. It creates the
 * WRITE_RESTRICTED token with the per-root write-SID allowlist, spawns the
 * wrapped argv under it with the CALLER'S stdio inherited (bytes flow
 * straight through), mirrors the child's exit code, and revokes its temp
 * grant on exit (workspace ACEs stay standing as the reuse cache).
 *
 * Argv contract: `[node, runner.js, ...formatRunnerArgs(invocation)]`; the
 * `runner-args` module owns the layout and its pure validation. Each
 * `--workspace` repeats once per workspace root, main first.
 *
 * Modes:
 *  - workspace-write: every workspace root and the temp directory carry
 *    distinct capability-SID Write grants; other ACL-addressable writes are
 *    denied except for the documented Everyone and hard-link boundaries.
 *    The roots must be pairwise disjoint and outside the temp directory.
 *  - read-only: no capability-SID grants; the restricting list carries no
 *    capability SID, so a standing grant ACE from an earlier
 *    workspace-write period stays inert. BOTH modes drop Authenticated Users
 *    (CIM unavailable — documented in README) and INTERACTIVE/LOCAL (the
 *    Public tree writes are denied); the two lists share the keep-alive group
 *    (logon SID, EVERYONE) and differ only by the capabilities.
 *
 * `--write-sid` + `--temp-write-sid`: the seam's grant contract — the
 * CALLER has already materialized one ACE per workspace root plus the
 * private-temp ACE and owns their revocation, so the runner neither grants
 * nor revokes (`manageDacls: false`). Every SID is checked against its
 * owning path. Without SIDs (standalone/agentless use), workspace-write treats
 * `--temp` as a ROOT, creates a random private child directory, derives its
 * own temp SID, and removes that directory after the child exits. In both
 * flows the runner rewrites TMP/TEMP in its OWN environment to the private
 * directory before spawning; the child inherits that block (`lpEnvironment`
 * NULL; an explicit block through koffi trips ERROR_INVALID_PARAMETER in
 * CreateProcessAsUserW, verified empirically). Read-only leaves the ambient
 * temp entries untouched (writes there are denied anyway).
 *
 * Failure contract: every runner-side failure (bad args, missing
 * directories, token/grant/spawn errors) prints `windows-acl-run: <detail>`
 * to stderr and exits 127 — the seam's RUNNER_FAILURE_RULES matches that
 * signature. The child is NEVER spawned unrestricted.
 * @module @deepseek-ai/dsh-sandbox-windows-acl/runner
 */

import { SUBPROCESS_CONTROL_ENV, SUBPROCESS_CONTROL_FD } from '@deepseek-ai/dsh-subprocess/control'
import { closeSync, existsSync, mkdtempSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { win32 } from './ffi.ts'
import { AclSandbox, assertDisjointDirectories, assertTempRootOutsideWorkspace } from './index.ts'
import { parseRunnerArgs } from './runner-args.ts'
import type { AclWritableDirectory, ParsedRunnerArgs, RunnerInvocation } from './runner-args.ts'
import { tempWriteSid, workspaceWriteSid } from './workspace-sid.ts'

const RUNNER_SIGNATURE = 'windows-acl-run'
const RUNNER_FAILURE_EXIT = 127

class RunnerFailure extends Error {}

/** Print the runner-failure signature line and unwind. */
function fail(detail: string): never {
  process.stderr.write(`${RUNNER_SIGNATURE}: ${detail}\n`)
  throw new RunnerFailure(detail)
}

/** Parse the runner argv, reporting a malformed invocation through the runner-failure signature. */
function parseArgs(raw: readonly string[]): ParsedRunnerArgs {
  try {
    return parseRunnerArgs(raw)
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error))
  }
}

/** The workspace roots of one invocation, main first. */
function workspacesOf(invocation: RunnerInvocation): readonly string[] {
  return invocation.grants === 'caller' ? invocation.writable.map(({ dir }) => dir) : invocation.workspaces
}

function requireDirectory(label: string, path: string): void {
  if (!existsSync(path) || !statSync(path).isDirectory()) {
    fail(`${label} is not an existing directory: ${path}`)
  }
}

async function main(): Promise<number> {
  const { invocation: parsed, command, args } = parseArgs(process.argv.slice(2))
  const workspaces = workspacesOf(parsed)
  const temp = parsed.grants === 'caller' ? parsed.temp.dir : parsed.temp
  // Every directory is validated in every mode: a provider bug that passes
  // a bogus root must fail loudly at the runner boundary, never mid-child.
  for (const workspace of workspaces) requireDirectory('--workspace', workspace)
  requireDirectory('--temp', temp)
  if (parsed.mode === 'workspace-write') {
    assertDisjointDirectories(workspaces)
    for (const workspace of workspaces) assertTempRootOutsideWorkspace(workspace, temp)
  }

  const api = await win32()
  // Ignore this process's own CTRL+C: the confined child (same console) keeps
  // handling its own; the runner must survive to revoke grants and mirror the
  // child's exit code.
  if (api.setConsoleCtrlHandler(null, 1) === 0) {
    fail(`SetConsoleCtrlHandler failed (Win32 ${api.getLastError()})`)
  }

  let ownedTempDir: string | undefined
  let sandbox: AclSandbox | undefined
  let initialized = false
  try {
    let privateTempDir: string | null = null
    let writable: readonly AclWritableDirectory[] = []
    let privateTempSid: string | undefined
    switch (parsed.grants) {
      case 'none':
        break
      case 'runner':
        writable = parsed.workspaces.map(dir => ({ dir, writeSid: workspaceWriteSid(dir) }))
        ownedTempDir = mkdtempSync(join(parsed.temp, 'dsh-'))
        privateTempDir = ownedTempDir
        privateTempSid = tempWriteSid(privateTempDir)
        break
      case 'caller':
        writable = parsed.writable
        privateTempDir = parsed.temp.dir
        privateTempSid = parsed.temp.writeSid
        break
      /* v8 ignore next 4 -- RunnerInvocation is a closed union; this branch is the static exhaustiveness guard. */
      default: {
        const unreachable: never = parsed
        throw new Error(`unreachable runner grants: ${JSON.stringify(unreachable)}`)
      }
    }
    sandbox = new AclSandbox({
      writable,
      tempDir: privateTempDir,
      mode: parsed.mode,
      ...privateTempSid === undefined ? {} : { tempWriteSid: privateTempSid },
      manageDacls: parsed.grants !== 'caller',
    })
    await sandbox.init()
    initialized = true

    if (privateTempDir !== null) {
      if (api.setEnvironmentVariableW('TMP', privateTempDir) === 0) {
        fail(`SetEnvironmentVariableW TMP failed (Win32 ${api.getLastError()})`)
      }
      if (api.setEnvironmentVariableW('TEMP', privateTempDir) === 0) {
        fail(`SetEnvironmentVariableW TEMP failed (Win32 ${api.getLastError()})`)
      }
    }

    const child = sandbox.spawn({
      command,
      args,
      stdio: 'inherit',
      ...process.env[SUBPROCESS_CONTROL_ENV] === 'pipe' ? { controlFileDescriptor: SUBPROCESS_CONTROL_FD } : {},
    })
    if (process.env[SUBPROCESS_CONTROL_ENV] === 'pipe') closeSync(SUBPROCESS_CONTROL_FD)
    const result = await child.wait()
    return result.exitCode
  } finally {
    // Cleanup failures must not mask the child's exit code: report and keep going.
    if (initialized) {
      try {
        sandbox?.dispose()
      } catch (error) {
        process.stderr.write(`${RUNNER_SIGNATURE}: cleanup: ${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
    if (ownedTempDir !== undefined) {
      try {
        rmSync(ownedTempDir, { recursive: true, force: true })
      } catch (error) {
        process.stderr.write(`${RUNNER_SIGNATURE}: cleanup: ${error instanceof Error ? error.message : String(error)}\n`)
      }
    }
  }
}

main().then(
  (exitCode) => {
    // Exit-code mirroring is full-width on Windows, verified empirically on
    // this machine (Windows 11 build 26200, Node 24): a child that exits
    // with the NTSTATUS 0xC0000005 (STATUS_ACCESS_VIOLATION) is read back
    // by GetExitCodeProcess as the uint32 3221225477, and after
    // process.exitCode = 3221225477 the parent observes exactly
    // 3221225477 (spawnSync status). PowerShell's $LASTEXITCODE and cmd
    // print the signed view (-1073741819), but no truncation or masking
    // happens anywhere in the chain — the mirror contract holds for the
    // full 32-bit range, so no re-mapping is needed.
    process.exitCode = exitCode
  },
  (error: unknown) => {
    if (!(error instanceof RunnerFailure)) {
      process.stderr.write(`${RUNNER_SIGNATURE}: ${error instanceof Error ? error.message : String(error)}\n`)
    }
    process.exitCode = RUNNER_FAILURE_EXIT
  },
)
