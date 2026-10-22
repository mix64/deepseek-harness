import { Context } from '@deepseek-ai/cordis'
import Sessions, { SessionId } from '@deepseek-ai/dsh-session'
import { brandString } from '@deepseek-ai/dsh-brand'
import SandboxPolicy, { setSandboxMode } from '@deepseek-ai/dsh-sandbox-policy'
import type { AdditionalRoot } from '@deepseek-ai/dsh-sandbox-policy'
import SessionProjections from '@deepseek-ai/dsh-session-projection'
import { expect, it, onTestFinished, vi } from 'vitest'
import { PtcCalls } from '../src/ptc-calls.ts'

async function setup() {
  const ctx = new Context()
  onTestFinished(async () => { await ctx.fiber.dispose() })
  await ctx.plugin(Sessions)
  await ctx.plugin(SessionProjections)
  await ctx.plugin(SandboxPolicy, { mode: 'workspace-write' })
  const session = ctx.sessions.create(SessionId('ptc-calls'))
  const calls = new PtcCalls(ctx)
  const policy = () => ctx.sandboxPolicy.resolve({ session })
  const signal = new AbortController().signal
  return { ctx, session, calls, policy, signal }
}

it('commits policy immediately, cancels existing calls, and waits for their complete cleanup before reading the latest mode', async () => {
  const { ctx, session, calls, policy, signal } = await setup()
  const cleanup = Promise.withResolvers<undefined>()
  let oldSignal: AbortSignal | undefined
  const first = calls.run(session.id, signal, policy, async (current) => { oldSignal = current; await cleanup.promise })
  const next = vi.fn(async () => policy().mode)
  try {
    session.append('turn/start', { turn: 1 })
    setSandboxMode(ctx.sessions.create(SessionId('another')), 'read-only')
    setSandboxMode(session, 'workspace-write')
    expect(oldSignal?.aborted).toBe(false)
    setSandboxMode(session, 'read-only')
    expect(policy().mode).toBe('read-only')
    expect(oldSignal?.aborted).toBe(true)
    const second = calls.run(session.id, signal, policy, next)
    expect(next).not.toHaveBeenCalled()
    setSandboxMode(session, 'danger-full-access')
    cleanup.resolve(undefined)
    await first
    expect(await second).toBe('danger-full-access')
  } finally { cleanup.resolve(undefined); await first }
})

it('releases failed calls and allows same-policy calls to overlap', async () => {
  const { session, calls, policy, signal } = await setup()
  const cleanup = Promise.withResolvers<undefined>()
  const first = calls.run(session.id, signal, policy, () => cleanup.promise)
  try {
    await expect(calls.run(session.id, signal, policy, async () => { throw new Error('failed call') })).rejects.toThrow('failed call')
    expect(await calls.run(session.id, signal, policy, async () => 'next')).toBe('next')
  } finally { cleanup.resolve(undefined); await first }
})

it('honors cancellation while waiting for a canceled predecessor', async () => {
  const { session, calls, policy, signal } = await setup()
  const cleanup = Promise.withResolvers<undefined>()
  const first = calls.run(session.id, signal, policy, () => cleanup.promise)
  setSandboxMode(session, 'read-only')
  const controller = new AbortController()
  const next = vi.fn(async () => 'unexpected')
  const second = calls.run(session.id, controller.signal, policy, next)
  const rejected = expect(second).rejects.toThrow('caller canceled')
  controller.abort(new Error('caller canceled'))
  cleanup.resolve(undefined)
  await first
  await rejected
  expect(next).not.toHaveBeenCalled()
})

it('unloads the executor only after calls stop and refuses late admission', async () => {
  const { ctx, session, calls, policy, signal } = await setup()
  const cleanup = Promise.withResolvers<undefined>()
  const stopped = Promise.withResolvers<undefined>()
  const first = calls.run(session.id, signal, policy, async (current) => {
    current.addEventListener('abort', () => { stopped.resolve(undefined) }, { once: true })
    await cleanup.promise
  })
  const disposed = ctx.fiber.dispose()
  try {
    await stopped.promise
    const next = calls.run(session.id, signal, policy, async () => 'unexpected')
    const rejected = expect(next).rejects.toThrow('PTC tool executor disposed')
    cleanup.resolve(undefined)
    await first
    await rejected
    await disposed
    await expect(calls.run(session.id, signal, policy, async () => 'unexpected')).rejects.toThrow('PTC tool executor disposed')
  } finally { cleanup.resolve(undefined); await first; await disposed }
})

it('cancels calls when the additional roots change and keeps them for an unchanged list', async () => {
  const { session, calls, policy, signal } = await setup()
  const cleanup = Promise.withResolvers<undefined>()
  let current: AbortSignal | undefined
  const first = calls.run(session.id, signal, policy, async (callSignal) => { current = callSignal; await cleanup.promise })
  try {
    session.append('sandbox/additional-roots', { roots: [] })
    expect(current?.aborted).toBe(false)
    session.append('sandbox/additional-roots', { roots: [brandString<AdditionalRoot>('/extra')] })
    expect(current?.aborted).toBe(true)
  } finally { cleanup.resolve(undefined); await first }
})
