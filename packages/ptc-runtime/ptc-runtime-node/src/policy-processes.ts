/** Node PTC process invalidation after a committed Session file-policy change. */
import type { Context } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session'
import { sameSandboxPolicy } from '@deepseek-ai/dsh-sandbox'
import type { SandboxExecutionPolicy } from '@deepseek-ai/dsh-sandbox'
import type {} from '@deepseek-ai/dsh-sandbox-policy'

interface Process {
  sessionId: SessionId
  /** The Session's standing policy when the process was admitted. */
  policy: SandboxExecutionPolicy
  release: (reason: Error) => Promise<void>
  /** Why cleanup started; set at invalidation or provider disposal. */
  reason?: Error
  invalidated: boolean
  cleanup?: Promise<void>
}

/** Owns asynchronous process cleanup without delaying permission setters. */
export class PolicyProcesses {
  private readonly processes = new Set<Process>()

  /**
   * Begin cleanup on policy changes, even when no subsequent program runs.
   * @param ctx - Node provider lifecycle and Session services.
   */
  constructor(private readonly ctx: Context) {
    ctx.on('session/event', (session, event) => {
      for (const process of this.processes) {
        if (process.sessionId !== session.id) continue
        const next = ctx.sandboxPolicy.successor(process.policy, event)
        if (next === undefined || sameSandboxPolicy(process.policy, next)) continue
        process.invalidated = true
        process.reason ??= new Error(next.mode === process.policy.mode ? 'sandbox additional directories changed' : 'sandbox mode changed')
        void this.release(process).catch((error: unknown) => { ctx.logger.warn(error) })
      }
    }, { global: true })
    ctx.effect(() => async () => {
      const processes = [...this.processes]
      for (const process of processes) process.reason ??= new Error('Node PTC runtime disposed')
      await this.settle(processes)
    }, 'Node PTC policy cleanup')
  }

  /**
   * Track an admitted call or retained process until its owner confirms cleanup.
   * @param policy - Resolved process policy, including an optional Session identity.
   * @param release - Idempotent cancellation and awaited cleanup; receives why cleanup started.
   * @returns Removal after successful process cleanup.
   */
  register(policy: SandboxExecutionPolicy, release: (reason: Error) => Promise<void>): () => void {
    if (policy.sessionId === undefined) return () => {}
    const session = this.ctx.get('sessions')?.get(policy.sessionId)
    const process: Process = {
      sessionId: policy.sessionId,
      policy: session === undefined ? policy : this.ctx.sandboxPolicy.resolve({ session }),
      release,
      invalidated: false,
    }
    this.processes.add(process)
    return () => { this.processes.delete(process) }
  }

  /**
   * Wait for invalidated processes before admitting another program.
   * @param sessionId - Session carried by the resolved policy.
   * @returns Completion after prior cleanup; a failure rejects and remains retryable.
   */
  async wait(sessionId: SessionId | undefined): Promise<void> {
    await this.settle([...this.processes].filter(process => process.sessionId === sessionId && process.invalidated))
  }

  private release(process: Process): Promise<void> {
    if (process.cleanup !== undefined) return process.cleanup
    /* v8 ignore next -- only invalidation and disposal start cleanup, and both set the reason first. */
    const reason = process.reason ?? new Error('Node PTC process cleanup')
    process.cleanup = process.release(reason).then(() => { this.processes.delete(process) }, (error: unknown) => {
      delete process.cleanup
      throw error
    })
    return process.cleanup
  }

  private async settle(processes: Process[]): Promise<void> {
    const results = await Promise.allSettled(processes.map(process => this.release(process)))
    const failed = results.find(result => result.status === 'rejected')
    if (failed?.status === 'rejected') throw failed.reason
  }
}
