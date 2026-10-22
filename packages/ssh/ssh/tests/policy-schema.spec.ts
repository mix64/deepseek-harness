import { expect, it } from 'vitest'
import { policySchema } from '../src/schemas.ts'

it('carries the additional roots as absolute remote paths and rejects a policy without them', () => {
  const policy = { mode: 'workspace-write', workspaceRoot: '/work', additionalRoots: ['/extra/a', '/extra/b'], sessionId: 's' }
  expect(policySchema.parse(policy)).toEqual(policy)
  expect(policySchema.safeParse({ mode: 'workspace-write', workspaceRoot: '/work' }).success).toBe(false)
  expect(policySchema.safeParse({ ...policy, additionalRoots: ['relative'] }).success).toBe(false)
})
