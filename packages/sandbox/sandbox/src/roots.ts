/**
 * The workspace-root derivation shared by every enforcement dialect. A
 * policy names one main root, the deployment's explicit extra directories,
 * and the session's ordered additional roots; `workspace-write` means "every
 * workspace root plus the platform temp areas", and this module is that
 * meaning's one home. The Seatbelt profile
 * (`@deepseek-ai/dsh-sandbox-local`) and the in-process filesystem fence
 * (`@deepseek-ai/dsh-fs-sandbox`) both derive their allow-list from
 * {@link writableRoots}; the bwrap, Landlock, and Windows ACL dialects
 * iterate {@link workspaceRoots} and keep their own temp grant spellings (an
 * ephemeral `/tmp` mount, launcher-owned flags, a private temp capability).
 *
 * An explicit extra directory must be an existing physical directory; one
 * that is not stops the call with {@link SandboxInvalidRootError}.
 * {@link checkAdditionalRoot} is the single admission rule for a session's
 * additional root. Session admission applies it before logging a root, and
 * {@link workspaceRoots} applies it again on the enforcing host, so a root
 * that later stops being a directory, moves inside another root, or reaches
 * a temp area is dropped from enforcement instead of widening it.
 *
 * @module dsh-sandbox/roots
 */

import { realpathSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { posix, resolve, win32 } from 'node:path'
import { HarnessError } from '@deepseek-ai/dsh-llm'
import type { SandboxExecutionPolicy } from './index.ts'

/** An explicit directory grant cannot be enforced without changing the caller's selected path. */
export class SandboxInvalidRootError extends HarnessError {
  constructor(path: string, detail: string) {
    super(`Invalid additional writable directory ${JSON.stringify(path)}: ${detail}`, 'SANDBOX_INVALID_ROOT')
    this.name = 'SandboxInvalidRootError'
  }
}

/** Reject mutable path aliases before they can redirect an explicit grant. */
function additionalRoot(path: string): string {
  let physical: string
  let directory: boolean
  try {
    physical = realpathSync.native(path)
    directory = statSync(physical).isDirectory()
  } catch (error) {
    throw new SandboxInvalidRootError(path, `cannot read the directory: ${String(error)}`)
  }
  if (!directory) throw new SandboxInvalidRootError(path, 'expected an existing directory')
  if (physical !== resolve(path)) {
    throw new SandboxInvalidRootError(path, `use the physical directory path ${JSON.stringify(physical)}; symlinked grants are not supported`)
  }
  return physical
}

/**
 * Resolve a granted root to the path the enforcement layer actually compares:
 * canonical (symlinks resolved), because both Seatbelt filters and the fs
 * fence's containment check match resolved paths — `/tmp` IS `/private/tmp`
 * on darwin, and an as-spelled grant would match nothing.
 * @param path - the root as configured or platform-reported.
 * @returns the canonical path, or the spelling as-is when resolution fails
 *   (a missing root matches nothing until it exists — the conservative
 *   outcome; inventing a fallback would grant a path the caller never named).
 */
export function canonicalPath(path: string): string {
  try {
    // Node's JavaScript realpath implementation lexically collapses `..`
    // before resolving a preceding symlink on some platforms. The native
    // implementation follows the filesystem's component-by-component lookup,
    // matching chdir/spawn and the enforcement layers this identity feeds.
    return realpathSync.native(path)
  } catch {
    // realpathSync.native failed: the path (or a prefix) is missing or unreadable.
    return path
  }
}

/**
 * Why a candidate cannot join a session's workspace roots. Path-carrying
 * variants name the canonical root or temp area the candidate collides with.
 */
export type AdditionalRootRejection =
  | { kind: 'filesystem-root' }
  | { kind: 'main-root' }
  | { kind: 'inside-main-root' }
  | { kind: 'contains-main-root' }
  | { kind: 'overlaps-additional-root'; root: string }
  | { kind: 'temp-area'; temp: string }
  | { kind: 'limit'; limit: number }

/** The roots an additional-root candidate is checked against. Every path is canonical and absolute in the execution world. */
export interface AdditionalRootContext {
  /**
   * The session's main workspace root. Its spelling selects the path rules:
   * drive-letter or UNC paths compare case-insensitively under win32 rules,
   * anything else under POSIX rules.
   */
  main: string
  /** The additional roots already admitted, in order. */
  others: readonly string[]
  /** Temp areas no root may equal, contain, or sit inside. Entries that are not absolute under the selected path rules are ignored. */
  temps: readonly string[]
  /** Maximum number of additional roots; a candidate beyond it is rejected. */
  limit: number
}

/** One path dialect: separator, normalization, and case folding for comparison keys. */
interface PathRules {
  sep: string
  isAbsolute: (path: string) => boolean
  key: (path: string) => string
}

const WIN32_ABSOLUTE = /^(?:[a-zA-Z]:[\\/]|[\\/]{2}[^\\/])/u

const WIN32_RULES: PathRules = {
  sep: '\\',
  isAbsolute: path => WIN32_ABSOLUTE.test(path),
  key: path => stripTrailingSep(win32.normalize(path), '\\').toLowerCase(),
}

const POSIX_RULES: PathRules = {
  sep: '/',
  isAbsolute: path => path.startsWith('/'),
  key: path => stripTrailingSep(posix.normalize(path), '/'),
}

/** Drop a trailing separator unless it terminates a filesystem root (`/`, `c:\`, `\\server\share\`). */
function stripTrailingSep(path: string, sep: string): string {
  if (!path.endsWith(sep)) return path
  const parent = sep === '\\' ? win32.dirname(path) : posix.dirname(path)
  return parent === path ? path : path.slice(0, -1)
}

/** Whether `child` is `parent` or a descendant of it, comparing normalized keys. */
function containsKey(rules: PathRules, parent: string, child: string): boolean {
  if (parent === child) return true
  const prefix = parent.endsWith(rules.sep) ? parent : parent + rules.sep
  return child.startsWith(prefix)
}

/**
 * Decide whether `candidate` may join a session's additional roots. The
 * check is lexical over canonical paths and performs no I/O; callers resolve
 * the candidate and confirm it is an existing directory first. A candidate
 * equal to an admitted root is reported as an overlap, so callers that treat
 * re-adding as a no-op test equality before calling.
 * @param candidate - the canonical absolute candidate directory.
 * @param context - the main root, admitted roots, temp areas, and limit to check against.
 * @returns the first rule the candidate violates, or `undefined` when it is admissible.
 */
export function checkAdditionalRoot(candidate: string, context: AdditionalRootContext): AdditionalRootRejection | undefined {
  const rules = WIN32_RULES.isAbsolute(context.main) ? WIN32_RULES : POSIX_RULES
  const key = rules.key(candidate)
  const parent = rules === WIN32_RULES ? win32.dirname(key) : posix.dirname(key)
  if (parent === key) return { kind: 'filesystem-root' }
  const main = rules.key(context.main)
  if (key === main) return { kind: 'main-root' }
  if (containsKey(rules, main, key)) return { kind: 'inside-main-root' }
  if (containsKey(rules, key, main)) return { kind: 'contains-main-root' }
  for (const temp of context.temps) {
    if (!rules.isAbsolute(temp)) continue
    const tempKey = rules.key(temp)
    if (containsKey(rules, tempKey, key) || containsKey(rules, key, tempKey)) return { kind: 'temp-area', temp }
  }
  for (const root of context.others) {
    const rootKey = rules.key(root)
    if (containsKey(rules, rootKey, key) || containsKey(rules, key, rootKey)) return { kind: 'overlaps-additional-root', root }
  }
  if (context.others.length >= context.limit) return { kind: 'limit', limit: context.limit }
  return undefined
}

/**
 * The host's temp areas as canonical paths: `/tmp` and the per-user
 * platform temp dir (`os.tmpdir()`, the real temp area for mkstemp-family
 * tools). `workspace-write` grants both, and no workspace root may overlap
 * either.
 * @returns the canonical temp areas, deduplicated.
 */
export function tempAreas(): string[] {
  return [...new Set(['/tmp', tmpdir()].map(canonicalPath))]
}

/** Whether a canonical path currently names a directory on this host. */
function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory()
  } catch {
    // statSync failed: the root is missing or unreadable, so it grants nothing.
    return false
  }
}

/**
 * The canonical workspace roots one confined execution may write under in
 * `workspace-write`. The main root comes first and is kept even when it does
 * not exist (it then matches nothing). Under `workspace-write` the explicit
 * extra directories follow; each must be an existing physical directory.
 * Each session additional root follows in policy order when it is an
 * existing directory that still passes {@link checkAdditionalRoot} against
 * the roots kept before it and the host temp areas; any other session entry
 * is dropped.
 * @param policy - the file-effect policy whose roots to derive.
 * @returns the main root followed by the enforceable extra and additional roots, all canonical and deduplicated.
 * @throws {SandboxInvalidRootError} An explicit extra directory is missing, is not a directory, or uses a symlink.
 */
export function workspaceRoots(policy: SandboxExecutionPolicy): [string, ...string[]] {
  const main = canonicalPath(policy.workspaceRoot)
  const explicit = policy.mode === 'workspace-write'
    ? (policy.additionalWritableRoots ?? []).map(additionalRoot)
    : []
  const temps = tempAreas()
  const kept: string[] = []
  for (const root of policy.additionalRoots) {
    const candidate = canonicalPath(root)
    if (!isDirectory(candidate)) continue
    const others = [...explicit, ...kept]
    if (checkAdditionalRoot(candidate, { main, others, temps, limit: Number.POSITIVE_INFINITY }) !== undefined) continue
    kept.push(candidate)
  }
  return [...new Set([main, ...explicit, ...kept])] as [string, ...string[]]
}

/**
 * The workspace-owned writable roots: {@link workspaceRoots} under
 * `workspace-write`, kept separate from the platform temp policy each backend
 * documents for itself (Seatbelt and the fs fence use {@link writableRoots};
 * bwrap and Landlock add their own temp grants).
 * @param policy - the file-effect policy to derive the allow-list from.
 * @returns the canonical workspace-owned roots; empty outside `workspace-write`.
 * @throws {SandboxInvalidRootError} An explicit extra directory is missing, is not a directory, or uses a symlink.
 */
export function workspaceWritableRoots(policy: SandboxExecutionPolicy): string[] {
  return policy.mode === 'workspace-write' ? workspaceRoots(policy) : []
}

/**
 * The roots one confined execution may WRITE under — the mode's meaning as a
 * canonical, deduplicated allow-list. `read-only` allows nothing;
 * `workspace-write` allows every {@link workspaceRoots} entry plus the
 * {@link tempAreas} (omitting a temp area would deny what the mode promises).
 * @param policy - the file-effect policy to derive the allow-list from.
 * @returns the canonical writable roots; empty exactly under `read-only`.
 */
export function writableRoots(policy: SandboxExecutionPolicy): string[] {
  if (policy.mode !== 'workspace-write') return []
  return [...new Set([...workspaceRoots(policy), ...tempAreas()])]
}

/**
 * Whether two resolved policies confine identically: same mode, main root,
 * the same set of explicit extra directories, session additional roots in
 * the same order, and calling session. Consumers that
 * cache a confined process or runtime per policy compare with this.
 * @param a - one resolved policy.
 * @param b - the other resolved policy.
 * @returns true when every confinement-relevant field is equal.
 */
export function sameSandboxPolicy(a: SandboxExecutionPolicy, b: SandboxExecutionPolicy): boolean {
  return a.mode === b.mode
    && a.workspaceRoot === b.workspaceRoot
    && a.sessionId === b.sessionId
    && sameList(explicitSet(a), explicitSet(b))
    && sameList(a.additionalRoots, b.additionalRoots)
}

/** The explicit extra directories as a sorted set: their order and repetition grant nothing different. */
function explicitSet(policy: SandboxExecutionPolicy): string[] {
  return [...new Set(policy.additionalWritableRoots ?? [])].sort()
}

/** Whether two path lists hold the same entries in the same order. */
function sameList(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((entry, index) => entry === b[index])
}
