/**
 * The sandbox POLICY home (`ctx.sandboxPolicy`): the single owner of the
 * deployment's sandbox fallbacks plus per-session resolution: the file-effect
 * {@link SandboxMode}, the `workspace-write` main root, the explicit extra
 * writable directories, the session's additional roots, and their override
 * kits (the `sandbox/mode` and `sandbox/additional-roots` events, their folds,
 * and their write paths; the folds are the `sandboxMode` and `sandboxRoots`
 * session-projection units registered here, while the events come from
 * `./session-mode.ts` and `./session-roots.ts`).
 * Before each agent request, the owner also contributes the resolved policy to
 * the cache-safe runtime-context snapshot. The agent loop logs that snapshot as
 * model history, so replay reconstructs the same mode and roots the enforcing
 * consumers resolve without rewriting the stable system prompt.
 *
 * Enforcing filesystem, one-shot bash, and terminal backends read the SAME
 * resolved policy here. The context describes that policy without inventorying
 * capabilities, while each backend retains its own enforcement dialect and each
 * tool owns its operation-specific denial and escalation guidance. The service
 * reads session state once at each operation boundary; executors and providers
 * remain session-free.
 *
 * @module @deepseek-ai/dsh-sandbox-policy
 */

import { isAbsolute } from 'node:path'
import { Context, Service } from '@deepseek-ai/cordis'
import { z as zod } from 'zod'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-agent'
import { brandString } from '@deepseek-ai/dsh-brand'
import { CommandDefinitionId } from '@deepseek-ai/dsh-commands'
import type { CommandResult } from '@deepseek-ai/dsh-commands'
import { FsError } from '@deepseek-ai/dsh-fs'
import type { FileSystem } from '@deepseek-ai/dsh-fs'
import { errorChain } from '@deepseek-ai/dsh-llm'
import { tempAreas } from '@deepseek-ai/dsh-sandbox'
import type { SandboxExecutionPolicy, SandboxMode } from '@deepseek-ai/dsh-sandbox'
import type { Session, SessionEvent, SessionId } from '@deepseek-ai/dsh-session'
import type { ProjectionHandle } from '@deepseek-ai/dsh-session-projection'
import type {} from '@deepseek-ai/dsh-system-prompt'
import { describeRootRefusal, planRootAdmission, planRootRemoval } from './session-roots.ts'
import type { AdditionalRootRefusal, AdditionalRootsEdit, AdditionalRootsEditResult, ResolvedRootRequest, RootAdmissionContext, RootsPlan } from './session-roots.ts'
import type { AdditionalRoot, SandboxRootsView } from './types.ts'

export { SANDBOX_MODES, setSandboxMode } from './session-mode.ts'
export { describeRootRefusal } from './session-roots.ts'
export type { AdditionalRootRefusal, AdditionalRootsEdit, AdditionalRootsEditResult, AdditionalRootsEvent } from './session-roots.ts'
export type { AdditionalRoot, SandboxRootsView } from './types.ts'

/** Preserve execution-world spelling; enforcing providers resolve filesystem identity on their host. */
function resolveWorkspaceRoot(path: string): string {
  if (!isAbsolute(path) || path.includes('\0')) throw new Error('sandbox-policy: workspace root must be an absolute execution-world path without NUL bytes')
  return path
}

/**
 * Validate and detach the configured extra writable directories. They stay in
 * their execution-world spelling here: a local host must not canonicalize a
 * remote path. The enforcing host validates each physical directory before granting.
 * @param roots - the configured extra roots, or the empty schema default.
 * @returns a frozen copy, or `undefined` when no extra grant exists.
 */
function resolveAdditionalWritableRoots(roots: readonly string[] | undefined): readonly string[] | undefined {
  if (roots === undefined || roots.length === 0) return undefined
  for (const root of roots) {
    if (!isAbsolute(root) || root.includes('\0')) {
      throw new Error('sandbox-policy: additionalWritableRoots entries must be absolute execution-world paths')
    }
  }
  return Object.freeze([...new Set(roots)])
}

/** Render the policy without claiming which capabilities are mounted. */
/** Quote paths for model-visible text, comma-separated in order. */
function quotedList(paths: readonly string[]): string {
  return paths.map(path => JSON.stringify(path)).join(', ')
}

const REFUSAL_DETAIL_MAX_CHARS = 1000

/**
 * Render a preflight failure as one bounded line that keeps its whole causal
 * chain, because the actionable fault (a Win32 code, a denied path) is
 * usually the innermost cause or an AggregateError member. An over-long
 * chain is elided in the middle so both the outer operation and the
 * innermost cause survive.
 * @param error - the value `confine()` rejected with.
 * @returns the single-line detail of a `sandbox-refused` refusal.
 */
function refusalDetail(error: unknown): string {
  const text = errorChain(error).replace(/\s+/g, ' ').trim()
  if (text.length <= REFUSAL_DETAIL_MAX_CHARS) return text
  const half = Math.floor((REFUSAL_DETAIL_MAX_CHARS - 3) / 2)
  return `${text.slice(0, half)}...${text.slice(-half)}`
}

/**
 * Read one `/add-dir` or `/remove-dir` argument: a JSON string literal when
 * the trimmed input starts with a double quote, otherwise the trimmed text,
 * so paths with spaces work quoted or unquoted.
 * @param rawInput - the text after the command name.
 * @returns the path, `''` for no argument, or an error result for a malformed literal.
 */
function commandPath(rawInput: string): string | CommandResult {
  const input = rawInput.trim()
  if (!input.startsWith('"')) return input
  try {
    const parsed: unknown = JSON.parse(input)
    if (typeof parsed === 'string') return parsed
  } catch {
    // JSON.parse failed: the quoted argument is not one complete JSON string literal.
  }
  return { kind: 'error', text: `expected one JSON string literal, got ${input}` }
}

/**
 * Render the policy without claiming which capabilities are mounted. The
 * additional roots appear only when the session has some.
 */
function renderPolicyContext(policy: SandboxExecutionPolicy): string {
  const extra = policy.additionalRoots
  const listed = extra.length === 0 ? '' : ` Additional session directories: ${quotedList(extra)}.`
  switch (policy.mode) {
    case 'read-only':
      return 'Current DSH file policy: read-only. Any available operation enforced by the DSH file sandbox cannot modify files in the standing mode. Do not refuse a required modification from this policy alone: try an available tool normally and follow any denial and escalation guidance it returns.' + listed
    case 'workspace-write': {
      const explicit = policy.additionalWritableRoots === undefined
        ? ''
        : ` Additional writable directories: ${JSON.stringify(policy.additionalWritableRoots)}.`
      return extra.length === 0
        ? `Current DSH file policy: workspace-write. Any available operation enforced by the DSH file sandbox may modify files under the session workspace: ${JSON.stringify(policy.workspaceRoot)}.${explicit} Some platform temporary areas may also be writable.`
        : `Current DSH file policy: workspace-write. Any available operation enforced by the DSH file sandbox may modify files under the session workspace: ${JSON.stringify(policy.workspaceRoot)}, and under the additional session directories: ${quotedList(extra)}. Use absolute paths for files in the additional directories.${explicit} Some platform temporary areas may also be writable.`
    }
    case 'danger-full-access':
      return 'Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.' + listed
    /* v8 ignore next 4 -- SandboxMode is a typed same-process closed union; this branch is only the static exhaustiveness guard. */
    default: {
      const mode: never = policy.mode
      throw new Error(`unreachable sandbox mode: ${String(mode)}`)
    }
  }
}

declare module '@deepseek-ai/cordis' {
  interface Context {
    sandboxPolicy: SandboxPolicyService
  }
}

/**
 * Plugin config: the deployment's sandbox default. All optional — `Config`
 * supplies the defaults (`mode: 'read-only'` is the fail-safe default; a
 * deployment that wants a workspace-writable agent opts in explicitly). The
 * runner choice is NOT here (it is the `ctx.sandbox` provider's config), nor
 * is any per-family knob: this is the one shared policy home.
 */
export interface Config {
  /** File-sandbox mode a session starts from (default: `read-only`). */
  mode?: SandboxMode
  /**
   * Absolute fallback root for agentless calls and sessions without a cwd (default:
   * `process.cwd()`). Normal agent calls use their session cwd instead.
   */
  workspaceRoot?: string
  /**
   * Extra physical absolute directories that `workspace-write` may also write under
   * (default: none). The supervisor names them explicitly; there is no
   * automatic repository or gitfile discovery. Entries are execution-world
   * paths: this service validates absoluteness and detaches the list, while
   * the enforcing host rejects missing, non-directory, or symlinked paths. They grant nothing under
   * `read-only`.
   */
  additionalWritableRoots?: string[]
  /**
   * Maximum number of additional roots one session may hold (default: 16);
   * `0` disables additional roots.
   */
  maxAdditionalRoots?: number
}

/** Inputs that select the sandbox policy for one capability call. */
export interface SandboxPolicyRequest {
  /** Calling session; its immutable cwd becomes the workspace boundary. */
  session?: Session
  /** Explicit approved mode override, which outranks session policy. */
  mode?: SandboxMode
}

/** The sandbox-mode projection's state schema (state equals the public shape). */
const sandboxModeStateSchema = zod.union([
  zod.literal('read-only'),
  zod.literal('workspace-write'),
  zod.literal('danger-full-access'),
]).nullable()

/** The additional-root projection's state schema: the logged list, re-branded on restore. */
const sandboxRootsStateSchema = zod.array(zod.string().transform(root => brandString<AdditionalRoot>(root)))

/** The additional-root projection's wire schema. */
const sandboxRootsViewSchema: zod.ZodType<SandboxRootsView> = zod.object({ roots: sandboxRootsStateSchema }).strict()
/**
 * The sandbox-policy service (`ctx.sandboxPolicy`). Owns the deployment
 * default mode, fallback workspace root, and current request-time policy
 * section. Tool layers call {@link resolve} for each execution so a session's
 * mode log and immutable cwd travel together to every enforcing capability.
 */
export class SandboxPolicyService extends Service {
  // Inline schema call: the config catalog walks `static Config` statically.
  static Config: z<Config> = z.object({
    mode: z.union(['read-only', 'workspace-write', 'danger-full-access'] as const).default('read-only'),
    // No schema default: process.cwd() is resolved in the constructor so the
    // stored root is always absolute regardless of how it was supplied.
    workspaceRoot: z.string(),
    additionalWritableRoots: z.array(z.string()).default([]),
    maxAdditionalRoots: z.natural().default(16),
  })

  static inject = ['sessionProjections']

  /** The deployment default mode — the fallback beneath a session override. */
  readonly defaultMode: SandboxMode
  /** The absolute `workspace-write` fallback root for calls without a session cwd. */
  readonly workspaceRoot: string
  /** The frozen extra writable directories shared by every resolved policy, or `undefined` for none. */
  readonly additionalWritableRoots: readonly string[] | undefined
  /** Maximum number of additional roots one session may hold. */
  readonly maxAdditionalRoots: number
  /** Per-session tail of the additional-root edit queue. */
  private readonly rootEdits = new Map<SessionId, Promise<void>>()
  private sandboxModeProjectionHandle!: ProjectionHandle<SandboxMode | null>
  private sandboxRootsProjectionHandle!: ProjectionHandle<AdditionalRoot[]>
  constructor(ctx: Context, config: Config) {
    super(ctx, 'sandboxPolicy')
    // schemastery (static Config) already filled `mode`; the cast records that
    // runtime fact. `workspaceRoot` has NO schema default, so its fallback to
    // the process cwd is real branching, resolved absolute either way.
    this.defaultMode = config.mode as SandboxMode
    this.workspaceRoot = resolveWorkspaceRoot(config.workspaceRoot ?? process.cwd())
    this.additionalWritableRoots = resolveAdditionalWritableRoots(config.additionalWritableRoots)
    this.maxAdditionalRoots = config.maxAdditionalRoots as number
  }

  protected async [Service.init](): Promise<void> {
    const ctx = this.ctx
    this.sandboxModeProjectionHandle = await ctx.sessionProjections.register({
      key: 'sandboxMode',
      stateVersion: 1,
      stateSchema: sandboxModeStateSchema,
      init: () => null,
      apply: (state, event) => (event.type === 'sandbox/mode' ? event.data.mode : state),
    })

    this.sandboxRootsProjectionHandle = await ctx.sessionProjections.register({
      key: 'sandboxRoots',
      stateVersion: 1,
      stateSchema: sandboxRootsStateSchema,
      init: () => [],
      apply: (state, event) => (event.type === 'sandbox/additional-roots' ? event.data.roots : state),
      wire: {
        viewSchema: sandboxRootsViewSchema,
        // The view changes exactly when the state reference does, so a fresh object never over-publishes.
        view: state => ({ roots: state }),
      },
    })

    // /add-dir and /remove-dir: the write path a web client uses. The child
    // activates only when a command registry is composed.
    ctx.inject(['commands'], (commandCtx) => {
      commandCtx.commands.register({
        definitionId: CommandDefinitionId('@deepseek-ai/dsh-sandbox-policy/add-dir'),
        name: 'add-dir',
        description: 'Add a writable directory to this session, or list the additional directories',
        input: { hint: '<directory>' },
        handler: async ({ agent, rawInput, signal }) => {
          const path = commandPath(rawInput)
          if (typeof path !== 'string') return path
          if (path === '') {
            const roots = this.additionalRootsOf(agent.session)
            return { kind: 'success', text: roots.length === 0 ? 'no additional directories' : `additional directories: ${quotedList(roots)}` }
          }
          return this.commandResult(await this.editAdditionalRoots(agent.session, { kind: 'add', path }, signal), 'added', path)
        },
      })
      commandCtx.commands.register({
        definitionId: CommandDefinitionId('@deepseek-ai/dsh-sandbox-policy/remove-dir'),
        name: 'remove-dir',
        description: 'Remove an additional writable directory from this session',
        input: { hint: '<directory>' },
        handler: async ({ agent, rawInput, signal }) => {
          const path = commandPath(rawInput)
          if (typeof path !== 'string') return path
          if (path === '') return { kind: 'error', text: 'usage: /remove-dir <directory>' }
          return this.commandResult(await this.editAdditionalRoots(agent.session, { kind: 'remove', path }, signal), 'removed', path)
        },
      })
    })

    ctx.inject(['systemPrompt'], (scope: Context) => {
      scope.systemPrompt.context({
        name: 'sandbox:policy',
        order: scope.systemPrompt.getContextOrder('SANDBOX_POLICY'),
        text: (context) => {
          const session = context.agent?.session
          return session === undefined
            ? ''
            : renderPolicyContext(this.resolve({ session }))
        },
      })
    })
  }

  /**
   * Resolve the complete policy for one capability call. An approved explicit
   * mode outranks the session's last `sandbox/mode` event, which outranks the
   * deployment default. A session cwd is its workspace-write main root; the
   * configured root is the fallback for agentless calls and sessions without a
   * cwd. The session's last `sandbox/additional-roots` list supplies the
   * additional roots; agentless calls have none.
   * @param request - optional session and approved mode override.
   * @returns the fully resolved per-call mode, absolute main root, and additional roots.
   */
  resolve(request: SandboxPolicyRequest = {}): SandboxExecutionPolicy {
    const { session } = request
    return {
      mode: request.mode ?? (session === undefined ? undefined : this.overrideOf(session)) ?? this.defaultMode,
      workspaceRoot: resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot),
      ...this.additionalWritableRoots === undefined ? {} : { additionalWritableRoots: this.additionalWritableRoots },
      additionalRoots: session === undefined ? [] : this.additionalRootsOf(session),
      ...session === undefined ? {} : { sessionId: session.id },
    }
  }

  /**
   * Read the session's additional roots.
   * @param session - session whose log supplies the list.
   * @returns the last logged list, empty without one.
   */
  additionalRootsOf(session: Session): AdditionalRoot[] {
    return this.sandboxRootsProjectionHandle.stateOf(session)
  }

  /**
   * THE validated write path for a session's additional roots. Edits of one
   * session run one at a time, each against the list the previous one left.
   * Every requested path is resolved and inspected through `ctx.fs` (the
   * execution world), relative paths against the session's main root, then
   * planned by {@link planRootAdmission} or {@link planRootRemoval}. Each newly
   * admitted root is preflighted through `ctx.sandbox.confine()` under the
   * prospective workspace-write policy, so a backend that grants per root
   * (Windows ACL) materializes the grant now and a refusal is reported now;
   * compositions without a sandbox provider skip the preflight. The edit
   * appends at most one `sandbox/additional-roots` event, and none when the
   * list is unchanged.
   * @param session - the session whose list is edited.
   * @param edit - the requested change.
   * @param signal - cancellation of the resolution and preflight; an aborted edit appends nothing.
   * @returns the resulting list, whether it changed, and the refused paths.
   * @throws when no `ctx.fs` provider is mounted, on cancellation, or on an
   *   execution-world I/O failure other than a missing path.
   */
  editAdditionalRoots(session: Session, edit: AdditionalRootsEdit, signal?: AbortSignal): Promise<AdditionalRootsEditResult> {
    const previous = this.rootEdits.get(session.id) ?? Promise.resolve()
    const next = previous.then(() => this.applyRootsEdit(session, edit, signal))
    const settled = next.then(() => undefined, () => undefined)
    this.rootEdits.set(session.id, settled)
    void settled.then(() => {
      if (this.rootEdits.get(session.id) === settled) this.rootEdits.delete(session.id)
    })
    return next
  }

  /** Run one edit against the session's current list. */
  private async applyRootsEdit(
    session: Session,
    edit: AdditionalRootsEdit,
    signal: AbortSignal | undefined,
  ): Promise<AdditionalRootsEditResult> {
    signal?.throwIfAborted()
    const fs = this.ctx.get('fs')
    if (fs === undefined) throw new Error('sandbox-policy: editing additional roots requires a filesystem provider (ctx.fs)')
    const current = this.additionalRootsOf(session)
    const mainPath = resolveWorkspaceRoot(session.header.cwd ?? this.workspaceRoot)
    const main = fs.processPath(await fs.resolve(mainPath, signal === undefined ? {} : { signal }))
    let plan: RootsPlan
    if (edit.kind === 'remove') {
      const request = await resolveRootRequest(fs, edit.path, mainPath, signal)
      plan = planRootRemoval(current, edit.path, request.target === 'missing' ? undefined : request.target.root)
    } else {
      const paths = edit.kind === 'add' ? [edit.path] : edit.paths
      const requests: ResolvedRootRequest[] = []
      for (const path of paths) requests.push(await resolveRootRequest(fs, path, mainPath, signal))
      const temps = tempAreas().flatMap(temp => fs.processPathFromHostPath(temp) ?? [])
      const context: RootAdmissionContext = { main, temps, limit: this.maxAdditionalRoots }
      plan = await this.preflight(session.id, mainPath, planRootAdmission(edit.kind === 'add' ? current : [], requests, context), current, signal)
    }
    signal?.throwIfAborted()
    const changed = plan.roots.length !== current.length || plan.roots.some((root, index) => root !== current[index])
    if (changed) session.append('sandbox/additional-roots', { roots: plan.roots })
    return { roots: plan.roots, changed, refused: plan.refused }
  }

  /**
   * Preflight every root a plan admits that the session did not already
   * hold, in order, under the prospective workspace-write policy; a root the
   * provider refuses is dropped from the plan and reported.
   */
  private async preflight(
    sessionId: SessionId,
    mainPath: string,
    plan: RootsPlan,
    current: readonly AdditionalRoot[],
    signal: AbortSignal | undefined,
  ): Promise<RootsPlan> {
    const sandbox = this.ctx.get('sandbox')
    if (sandbox === undefined) return plan
    const added = new Map(plan.added.map(({ root, path }) => [root, path]))
    const roots: AdditionalRoot[] = []
    const refused: AdditionalRootRefusal[] = [...plan.refused]
    for (const root of plan.roots) {
      const path = added.get(root)
      if (path !== undefined && !current.includes(root)) {
        try {
          await sandbox.confine(['true'], {
            mode: 'workspace-write',
            workspaceRoot: mainPath,
            ...this.additionalWritableRoots === undefined ? {} : { additionalWritableRoots: this.additionalWritableRoots },
            additionalRoots: [...roots, root],
            sessionId,
          }, signal)
        } catch (error) {
          signal?.throwIfAborted()
          refused.push({ kind: 'sandbox-refused', path, detail: refusalDetail(error) })
          continue
        }
      }
      roots.push(root)
    }
    return { roots, added: plan.added.filter(({ root }) => roots.includes(root)), refused }
  }

  /** Format an edit outcome as the command's settlement. */
  private commandResult(result: AdditionalRootsEditResult, verb: 'added' | 'removed', path: string): CommandResult {
    const [refusal] = result.refused
    if (refusal !== undefined) return { kind: 'error', text: describeRootRefusal(refusal) }
    if (!result.changed) return { kind: 'success', text: `${JSON.stringify(path)} is already an additional directory` }
    return { kind: 'success', text: `${verb} ${JSON.stringify(path)}; additional directories: ${result.roots.length === 0 ? 'none' : quotedList(result.roots)}` }
  }

  /**
   * The policy a session resolves after one event commits, given the policy
   * it resolved before. Consumers that hold a process, runtime, or call open
   * under a resolved policy compare the successor with `sameSandboxPolicy` to
   * decide whether that resource is still valid.
   * @param before - the policy resolved before the event.
   * @param event - the committed or committing session event.
   * @returns the next policy, or `undefined` when the event cannot change the policy.
   */
  successor(before: SandboxExecutionPolicy, event: SessionEvent): SandboxExecutionPolicy | undefined {
    switch (event.type) {
      case 'sandbox/mode': return { ...before, mode: event.data.mode }
      case 'sandbox/additional-roots': return { ...before, additionalRoots: event.data.roots }
      // Other events never change the file-effect policy.
      default: return undefined
    }
  }

  /**
   * Read the session override without applying the deployment default.
   * @param session - session whose log supplies the override.
   * @returns the last logged mode, or `undefined` without one.
   */
  overrideOf(session: Session): SandboxMode | undefined {
    return this.sandboxModeProjectionHandle.stateOf(session) ?? undefined
  }
}

/**
 * Resolve one requested path in the execution world.
 * @param fs - the execution-world filesystem.
 * @param path - the path as requested.
 * @param cwd - the base for a relative path.
 * @param signal - cancellation.
 * @returns the request with its canonical path and kind, or `missing`.
 */
async function resolveRootRequest(
  fs: FileSystem,
  path: string,
  cwd: string,
  signal: AbortSignal | undefined,
): Promise<ResolvedRootRequest> {
  let target
  try {
    target = await fs.resolve(path, { cwd, ...signal === undefined ? {} : { signal } })
  } catch (error) {
    if (error instanceof FsError && error.code === 'FS_NOT_FOUND') return { path, target: 'missing' }
    throw error
  }
  const info = await fs.stat(target, signal)
  if (info === undefined) return { path, target: 'missing' }
  return { path, target: { root: brandString<AdditionalRoot>(fs.processPath(target)), directory: info.type === 'directory' } }
}

export default SandboxPolicyService
