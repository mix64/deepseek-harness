/**
 * Client-namespace projection of the sandbox-policy domain: a pure re-export
 * of the package's types outlet, so client aggregates read the `sandboxRoots`
 * view without importing host code.
 *
 * @module @deepseek-ai/dsh-sandbox-policy/client
 */

export type * from './types.ts'
