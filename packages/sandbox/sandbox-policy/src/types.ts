/**
 * Pure types of the sandbox-policy domain shared by host and client: the
 * additional-root identity and the client-visible `sandboxRoots` projection
 * view, free of this package's host-side value imports. The package root
 * re-exports them for host consumers and `./client` for client aggregates.
 *
 * @module @deepseek-ai/dsh-sandbox-policy/types
 */

import type { Branded } from '@deepseek-ai/dsh-brand'

/**
 * An absolute execution-world directory admitted as an additional writable
 * root of one session, in the canonical spelling the execution world
 * reported at admission.
 */
export type AdditionalRoot = Branded<'AdditionalRoot'>

/** Client view of a session's additional roots. */
export interface SandboxRootsView {
  /** Admitted additional roots in admission order; empty when the session has none. */
  roots: AdditionalRoot[]
}

declare module '@deepseek-ai/dsh-session-projection/types' {
  interface SessionProjectionMap {
    /**
     * The session's additional writable roots, folded from the last
     * `sandbox/additional-roots` event. The main root is the session's
     * immutable cwd and is not repeated here. Key absence means no sandbox
     * policy service is composed.
     */
    sandboxRoots: SandboxRootsView
  }
}
