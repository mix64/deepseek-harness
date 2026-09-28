/** Carry the repository's pnpm dependency patches into the Desktop runtime install. */

import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { basename, join } from 'node:path'
import yaml from 'js-yaml'

/** Directory, relative to the runtime build project, holding the staged patch files. */
const RUNTIME_PATCHES_DIR = 'patches'

/**
 * Read the workspace's `patchedDependencies`.
 * @param repoRoot - Repository root holding `pnpm-workspace.yaml`.
 * @returns Patch file paths relative to `repoRoot`, keyed by `name@version`.
 */
export function readWorkspacePatches(repoRoot: string): Readonly<Record<string, string>> {
  const workspace = yaml.load(readFileSync(join(repoRoot, 'pnpm-workspace.yaml'), 'utf8')) as { patchedDependencies?: Record<string, string> }
  return workspace.patchedDependencies ?? {}
}

/**
 * Copy each workspace patch into the runtime build project.
 * @param repoRoot - Repository root the workspace patch paths are relative to.
 * @param projectDir - Runtime build project that receives the patch files.
 * @param patches - Workspace patches keyed by `name@version`.
 * @returns The same keys mapped to paths relative to `projectDir`.
 */
export function stageRuntimePatches(
  repoRoot: string,
  projectDir: string,
  patches: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  mkdirSync(join(projectDir, RUNTIME_PATCHES_DIR), { recursive: true })
  return Object.fromEntries(Object.entries(patches).map(([target, path]) => {
    const staged = `${RUNTIME_PATCHES_DIR}/${basename(path)}`
    copyFileSync(join(repoRoot, path), join(projectDir, staged))
    return [target, staged]
  }))
}

function splitTarget(target: string): { name: string; version: string } {
  const at = target.lastIndexOf('@')
  if (at <= 0) throw new Error(`desktop runtime: patch target ${target} names no version`)
  return { name: target.slice(0, at), version: target.slice(at + 1) }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
}

/**
 * Require every patched package the runtime resolves to resolve at the patched
 * version, with the patch applied. Build-only patch targets absent from the
 * runtime are allowed.
 * @param lockfile - The runtime build project's `pnpm-lock.yaml`.
 * @param patches - Patches the runtime project declared, keyed by `name@version`.
 * @throws Error naming the package that resolved around its patch.
 */
export function verifyRuntimePatches(lockfile: string, patches: Readonly<Record<string, string>>): void {
  const start = lockfile.search(/^snapshots:$/mu)
  const snapshots = start === -1 ? '' : lockfile.slice(start)
  for (const target of Object.keys(patches)) {
    const { name, version } = splitTarget(target)
    const entry = new RegExp(`^  ['"]?${escapeRegExp(name)}@([^(:'"\\s]+)(\\([^\\r\\n]*\\))?['"]?:`, 'gmu')
    for (const match of snapshots.matchAll(entry)) {
      if (match[1] !== version) {
        throw new Error(`desktop runtime: ${name} resolved to ${match[1]}, but its patch targets ${version}; port the patch`)
      }
      if (!match[2]?.includes('(patch_hash=')) {
        throw new Error(`desktop runtime: ${target} resolved without its patch`)
      }
    }
  }
}
