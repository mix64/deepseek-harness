/** Cancellation and settlement of complete PTC calls, including nested tools. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { sameSandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-sandbox-policy'

interface Call {
  policy: SandboxExecutionPolicy
  controller: AbortController
  done: Promise<void>
}

/** Keeps calls under a changed policy from overlapping their canceled predecessors. */
export class PtcCalls {
  private readonly calls = new Map<SessionId, Set<Call>>()
  private disposed = false

  /**
   * Observe policy changes for the owning executor.
   * @param ctx - Executor lifecycle and Session events.
   */
  constructor(ctx: Context) {
    ctx.on('session/event', (session, event) => {
      const policies = ctx.get('sandboxPolicy')
      if (policies === undefined) return
      for (const call of this.calls.get(session.id) ?? []) {
        const next = policies.successor(call.policy, event)
        if (next === undefined || sameSandboxPolicy(call.policy, next)) continue
        call.controller.abort(new Error(next.mode === call.policy.mode ? 'sandbox additional directories changed' : 'sandbox mode changed'))
      }
    }, { global: true })
    ctx.effect(() => async () => {
      this.disposed = true
      const calls = [...this.calls.values()].flatMap(calls => [...calls])
      for (const call of calls) call.controller.abort(new Error('PTC tool executor disposed'))
      await Promise.all(calls.map(call => call.done))
    }, 'PTC calls')
  }

  /**
   * Await canceled predecessors before resolving authority and admitting a call.
   * @param sessionId - Calling Session.
   * @param signal - Caller cancellation.
   * @param policy - Current standing policy, read after preceding cleanup.
   * @param run - Complete call, including nested-tool cleanup.
   * @returns The call result.
   */
  async run<T>(
    sessionId: SessionId,
    signal: AbortSignal,
    policy: () => SandboxExecutionPolicy,
    run: (signal: AbortSignal) => Promise<T>,
  ): Promise<T> {
    for (;;) {
      const pending = [...this.calls.get(sessionId) ?? []].filter(call => call.controller.signal.aborted)
      if (pending.length === 0) break
      await Promise.all(pending.map(call => call.done))
    }
    signal.throwIfAborted()
    if (this.disposed) throw new Error('PTC tool executor disposed')
    const controller = new AbortController()
    const done = Promise.withResolvers<undefined>()
    const call = { policy: policy(), controller, done: done.promise }
    let calls = this.calls.get(sessionId)
    if (calls === undefined) this.calls.set(sessionId, calls = new Set())
    calls.add(call)
    try { return await run(AbortSignal.any([signal, controller.signal])) } finally {
      calls.delete(call)
      if (calls.size === 0) this.calls.delete(sessionId)
      done.resolve(undefined)
    }
  }
}
