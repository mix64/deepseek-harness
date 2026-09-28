import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { readWorkspacePatches, stageRuntimePatches, verifyRuntimePatches } from '../scripts/runtime-patches.ts'

const roots: string[] = []

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

function tempDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'dsh-runtime-patches-'))
  roots.push(root)
  return root
}

function lockfile(snapshots: readonly string[]): string {
  return [
    "lockfileVersion: '9.0'",
    '',
    'packages:',
    '',
    "  '@scope/lib@1.0.0':",
    '    resolution: {integrity: sha512-x}',
    '',
    'snapshots:',
    '',
    ...snapshots.flatMap(key => [`  ${key}:`, '    dependencies: {}', '']),
  ].join('\n')
}

const PATCHES = { '@scope/lib@1.0.0': 'patches/@scope__lib@1.0.0.patch', 'tool@2.0.0': 'patches/tool@2.0.0.patch' }

describe('runtime patches', () => {
  it('stages every workspace patch into the runtime project', () => {
    const repo = tempDir()
    const project = tempDir()
    mkdirSync(join(repo, 'patches'))
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'patchedDependencies:\n  "@scope/lib@1.0.0": patches/@scope__lib@1.0.0.patch\n')
    writeFileSync(join(repo, 'patches', '@scope__lib@1.0.0.patch'), 'diff body\n')

    const staged = stageRuntimePatches(repo, project, readWorkspacePatches(repo))

    expect(staged).toEqual({ '@scope/lib@1.0.0': 'patches/@scope__lib@1.0.0.patch' })
    expect(readFileSync(join(project, 'patches', '@scope__lib@1.0.0.patch'), 'utf8')).toBe('diff body\n')
  })

  it('reads a workspace without patches as none', () => {
    const repo = tempDir()
    writeFileSync(join(repo, 'pnpm-workspace.yaml'), 'packages:\n  - .\n')
    expect(readWorkspacePatches(repo)).toEqual({})
  })

  it('accepts a patched resolution and ignores build-only targets the runtime never installs', () => {
    expect(() => {
      verifyRuntimePatches(lockfile([
        "'@scope/lib@1.0.0(patch_hash=abc)(peer@1.0.0)'",
        'other@3.0.0',
      ]), PATCHES)
    }).not.toThrow()
  })

  it('refuses a patched package resolved without its patch', () => {
    expect(() => { verifyRuntimePatches(lockfile(["'@scope/lib@1.0.0'"]), PATCHES) })
      .toThrow('@scope/lib@1.0.0 resolved without its patch')
  })

  it('refuses a patched package resolved at another version', () => {
    expect(() => { verifyRuntimePatches(lockfile(["'@scope/lib@1.0.1'"]), PATCHES) })
      .toThrow('@scope/lib resolved to 1.0.1, but its patch targets 1.0.0; port the patch')
  })

  it('does not mistake a package whose name extends a patched one', () => {
    expect(() => { verifyRuntimePatches(lockfile(['tool-extra@9.0.0']), PATCHES) }).not.toThrow()
  })

  it('rejects a patch target that names no version', () => {
    expect(() => { verifyRuntimePatches(lockfile([]), { lib: 'patches/lib.patch' }) })
      .toThrow('patch target lib names no version')
  })
})
