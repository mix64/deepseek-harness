/**
 * Per-session additional writable roots: the session log as the store. The
 * list is recorded as whole-value `sandbox/additional-roots` events on the
 * session it applies to; the last event wins, so the list survives restart
 * by replay and two sessions never see each other's roots. The event is
 * log-only: the policy owner folds it into the `sandboxRoots` projection,
 * renders it into each model request's policy context, and stamps it onto
 * every resolved execution policy.
 *
 * This module also owns the pure edit planning: given the current list and
 * each requested path's execution-world facts, it decides the next list and
 * the refusals. The service performs the I/O and the sandbox preflight.
 *
 * @module dsh-sandbox-policy/session-roots
 */

import { checkAdditionalRoot } from '@deepseek-ai/dsh-sandbox'
import type { AdditionalRootRejection } from '@deepseek-ai/dsh-sandbox'
import type { SessionEventMap } from '@deepseek-ai/dsh-session'
import type { AdditionalRoot } from './types.ts'

declare module '@deepseek-ai/dsh-session/types' {
  interface SessionEventMap {
    /**
     * The session's complete additional-root list was replaced — log-only
     * (like `sandbox/mode`; NOT a surface event, carries no `surfaceOp`):
     * durable and replayable, never in the model transcript. The LAST such
     * event is the session's list. `source: 'delegation'` marks a list seeded
     * into a child; an absent source is a user edit.
     */
    'sandbox/additional-roots': {
      /** Every additional root after the edit, in admission order. */
      roots: AdditionalRoot[]
      /** Marks a list seeded into a child at delegation. */
      source?: 'delegation'
    }
  }
}

/** Payload of one `sandbox/additional-roots` event. */
export type AdditionalRootsEvent = SessionEventMap['sandbox/additional-roots']

/**
 * One requested change to a session's additional roots. Paths are
 * execution-world paths; relative paths resolve against the session's main
 * root. `replace` admits each valid path and refuses the rest.
 */
export type AdditionalRootsEdit =
  | { kind: 'add'; path: string }
  | { kind: 'remove'; path: string }
  | { kind: 'replace'; paths: readonly string[] }

/** Why one requested path was not applied, naming the path as requested. */
export type AdditionalRootRefusal =
  | { kind: 'not-found'; path: string }
  | { kind: 'not-directory'; path: string }
  | { kind: 'not-listed'; path: string }
  | { kind: 'rejected'; path: string; rejection: AdditionalRootRejection }
  | { kind: 'sandbox-refused'; path: string; detail: string }

/** The outcome of one edit. */
export interface AdditionalRootsEditResult {
  /** The session's additional roots after the edit. */
  roots: AdditionalRoot[]
  /** Whether the edit appended a `sandbox/additional-roots` event. */
  changed: boolean
  /** Requested paths that were not applied, in request order. */
  refused: AdditionalRootRefusal[]
}

/** One requested path with the execution-world facts the planner needs. */
export interface ResolvedRootRequest {
  /** The path as requested. */
  path: string
  /** The canonical execution-world path and its kind, or `missing` when nothing exists there. */
  target: { root: AdditionalRoot; directory: boolean } | 'missing'
}

/** The roots every candidate is checked against, canonical in the execution world. */
export interface RootAdmissionContext {
  /** The session's main root. */
  main: string
  /** Temp areas visible in the execution world. */
  temps: readonly string[]
  /** Maximum number of additional roots. */
  limit: number
}

/** A planned edit: the next list, the roots it newly admits, and the refusals. */
export interface RootsPlan {
  /** The list after the edit. */
  roots: AdditionalRoot[]
  /** Each root the edit admits that its base list lacked, with the path that requested it. */
  added: Array<{ root: AdditionalRoot; path: string }>
  /** Requests that were not applied. */
  refused: AdditionalRootRefusal[]
}

/**
 * Admit requested roots onto a list in request order. A request naming a
 * root already on the list is a no-op, so repeating an add converges.
 * @param current - the list the requests extend (empty for a replacement).
 * @param requests - each requested path with its execution-world facts.
 * @param context - the main root, temp areas, and limit.
 * @returns the extended list and the refusals.
 */
export function planRootAdmission(
  current: readonly AdditionalRoot[],
  requests: readonly ResolvedRootRequest[],
  context: RootAdmissionContext,
): RootsPlan {
  const roots = [...current]
  const added: RootsPlan['added'] = []
  const refused: AdditionalRootRefusal[] = []
  for (const { path, target } of requests) {
    if (target === 'missing') {
      refused.push({ kind: 'not-found', path })
      continue
    }
    if (!target.directory) {
      refused.push({ kind: 'not-directory', path })
      continue
    }
    if (roots.includes(target.root)) continue
    const rejection = checkAdditionalRoot(target.root, { ...context, others: roots })
    if (rejection === undefined) {
      roots.push(target.root)
      added.push({ root: target.root, path })
    } else {
      refused.push({ kind: 'rejected', path, rejection })
    }
  }
  return { roots, added, refused }
}

/**
 * Remove one root from a list. The request matches a listed root by its
 * exact spelling or by its canonical execution-world path, so a root whose
 * directory has since disappeared can still be removed by the listed name.
 * @param current - the session's list.
 * @param path - the path as requested.
 * @param canonical - the request's canonical execution-world path, when it resolves.
 * @returns the shortened list, or a `not-listed` refusal.
 */
export function planRootRemoval(current: readonly AdditionalRoot[], path: string, canonical: string | undefined): RootsPlan {
  const index = current.findIndex(root => root === path || root === canonical)
  if (index < 0) return { roots: [...current], added: [], refused: [{ kind: 'not-listed', path }] }
  return { roots: current.filter((_root, position) => position !== index), added: [], refused: [] }
}

/**
 * Describe a refusal for a human reader.
 * @param refusal - the refusal to describe.
 * @returns one sentence naming the path and the reason.
 */
export function describeRootRefusal(refusal: AdditionalRootRefusal): string {
  const path = JSON.stringify(refusal.path)
  switch (refusal.kind) {
    case 'not-found': return `${path} does not exist`
    case 'not-directory': return `${path} is not a directory`
    case 'not-listed': return `${path} is not an additional directory of this session`
    case 'sandbox-refused': return `the sandbox could not grant ${path}: ${refusal.detail}`
    case 'rejected': {
      const { rejection } = refusal
      switch (rejection.kind) {
        case 'filesystem-root': return `${path} is a filesystem root`
        case 'main-root': return `${path} is the session workspace`
        case 'inside-main-root': return `${path} is inside the session workspace`
        case 'contains-main-root': return `${path} contains the session workspace`
        case 'overlaps-additional-root': return `${path} overlaps the additional directory ${JSON.stringify(rejection.root)}`
        case 'temp-area': return `${path} overlaps the temporary area ${JSON.stringify(rejection.temp)}`
        case 'limit': return `a session can hold at most ${String(rejection.limit)} additional directories`
        /* v8 ignore next 4 -- AdditionalRootRejection is a closed union; this branch is the static exhaustiveness guard. */
        default: {
          const unreachable: never = rejection
          throw new Error(`unreachable rejection: ${JSON.stringify(unreachable)}`)
        }
      }
    }
    /* v8 ignore next 4 -- AdditionalRootRefusal is a closed union; this branch is the static exhaustiveness guard. */
    default: {
      const unreachable: never = refusal
      throw new Error(`unreachable refusal: ${JSON.stringify(unreachable)}`)
    }
  }
}
