/**
 * Canonical directory-boundary checks for the Windows ACL workspace and
 * private-temp capabilities.
 * @module @deepseek-ai/dsh-sandbox-windows-acl/path-boundary
 */

import { realpathSync } from 'node:fs'
import { isAbsolute, relative, sep } from 'node:path'

/** Whether `root` is the same canonical directory as `candidate` or contains it. */
function containsDirectory(root: string, candidate: string): boolean {
  const relation = relative(realpathSync.native(root), realpathSync.native(candidate))
  return relation === '' || (!isAbsolute(relation) && relation !== '..' && !relation.startsWith(`..${sep}`))
}

/**
 * Reject a temp parent that is inside the workspace: every child created
 * below it would inherit the standing workspace capability.
 * @param workspaceRoot - the canonical workspace root that receives the standing ACE.
 * @param tempRoot - the existing parent beneath which a private temp child would be created.
 */
export function assertTempRootOutsideWorkspace(workspaceRoot: string, tempRoot: string): void {
  if (containsDirectory(workspaceRoot, tempRoot)) {
    throw new Error(`Windows ACL temp root must be outside the workspace: workspace=${workspaceRoot}; temp=${tempRoot}`)
  }
}

/**
 * Reject overlap between an actual private temp directory and any writable
 * directory: either inheritance direction would merge the two capabilities.
 * @param writableDirs - directories carrying the standing workspace capability.
 * @param tempDir - the existing directory carrying the revocable temp capability.
 */
export function assertPrivateTempDisjoint(writableDirs: readonly string[], tempDir: string): void {
  for (const writableDir of writableDirs) {
    if (containsDirectory(writableDir, tempDir) || containsDirectory(tempDir, writableDir)) {
      throw new Error(`AclSandbox private temp directory must be disjoint from writable directories: writable=${writableDir}; temp=${tempDir}`)
    }
  }
}

/**
 * Reject overlap between any two workspace roots: a root nested in another
 * would carry both roots' capabilities, so removing either root from a
 * session could not narrow the nested tree.
 * @param dirs - existing workspace roots granted to one invocation.
 */
export function assertDisjointDirectories(dirs: readonly string[]): void {
  for (const [index, first] of dirs.entries()) {
    for (const second of dirs.slice(index + 1)) {
      if (containsDirectory(first, second) || containsDirectory(second, first)) {
        throw new Error(`Windows ACL workspace roots must be disjoint: ${first}; ${second}`)
      }
    }
  }
}
