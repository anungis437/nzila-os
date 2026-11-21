import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { canonicalActionScope } from './fixtures/canonical-action-scope'
import { UserRole } from '@/lib/auth/roles'
const io = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('unexpected business IO')
  }),
)
vi.mock('@/db', () => ({ db: new Proxy({}, { get: () => io }) }))
vi.mock('next/cache', () => ({ revalidatePath: io }))
import * as actions from '../rewards-actions'

beforeEach(() => {
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  io.mockClear()
})
afterEach(() => {
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2
})
const held = Object.entries(actions).filter(
  ([name]) =>
    !['nominatePeer', 'listPeerRecognitionPrograms', 'listPeerRecognitionAwardTypes'].includes(
      name,
    ),
)
describe('reward server actions preserve the institutional deferral', () => {
  it('accounts for every existing credit action separately from supported peer text', () => {
    expect(held).toHaveLength(21)
    expect(Object.keys(actions)).toHaveLength(24)
  })
  it.each(held)(
    '%s cannot mint institutional authority from a canonical member session',
    async (_name, action) => {
      const result = await canonicalActionScope(() =>
        (action as (...args: unknown[]) => Promise<unknown>)({}),
      )
      expect(result).toMatchObject({ success: false, status: 501, code: 'NOT_IMPLEMENTED' })
      expect(io).not.toHaveBeenCalled()
    },
  )
  it.each([UserRole.ADMIN, UserRole.PRESIDENT, UserRole.APP_OWNER])(
    'the existing %s title does not lift the credit deferral',
    async (role) => {
      expect(
        await canonicalActionScope(() => actions.getMyWalletBalance(), { role }),
      ).toMatchObject({ success: false, status: 501 })
      expect(io).not.toHaveBeenCalled()
    },
  )
  it('refuses the old identity-only mode before effects', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '0'
    expect(await canonicalActionScope(() => actions.nominatePeer({}))).toMatchObject({
      success: false,
    })
    expect(io).not.toHaveBeenCalled()
  })
})
