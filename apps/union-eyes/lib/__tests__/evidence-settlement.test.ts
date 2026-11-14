import { afterEach, describe, expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ warn: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { warn: state.warn } }))
import { settleUnionEvidencePack } from '../evidence-settlement'

describe('evidence settlement within the request transaction', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })
  it('keeps canonical work pending until durable sealing has completed', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    let finish!: () => void,
      returned = false
    const pending = new Promise<void>((resolve) => {
      finish = resolve
    })
    const settled = settleUnionEvidencePack(pending, 'CASE_CREATED').then(() => {
      returned = true
    })
    await Promise.resolve()
    expect(returned).toBe(false)
    finish()
    await settled
    expect(returned).toBe(true)
  })
  it('propagates canonical persistence failure instead of accepting the mutation', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    await expect(
      settleUnionEvidencePack(Promise.reject(new Error('SEAL_UNAVAILABLE')), 'CASE_CREATED'),
    ).rejects.toThrow('SEAL_UNAVAILABLE')
    expect(state.warn).not.toHaveBeenCalled()
  })
  it('preserves asynchronous legacy handling', async () => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    let fail!: (error: Error) => void
    const pending = new Promise<void>((_, reject) => {
      fail = reject
    })
    await settleUnionEvidencePack(pending, 'CASE_CREATED')
    fail(new Error('legacy storage error'))
    await Promise.resolve()
    expect(state.warn).toHaveBeenCalledWith(
      'Evidence pack failed',
      expect.objectContaining({ actionType: 'CASE_CREATED' }),
    )
  })
})
