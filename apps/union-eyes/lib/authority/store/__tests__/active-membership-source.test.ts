import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ direct: vi.fn(), definer: vi.fn() }))
vi.mock('../identity', () => ({ canonicalMembershipSource: m.direct }))
vi.mock('../platform-identity', () => ({ membershipSourceViaDefiner: m.definer }))

const ORG = '11111111-1111-4111-8111-111111111111'
const exec = { query: vi.fn() } as never

describe('activeMembershipSource', () => {
  const prior = process.env.UE_CANONICAL_BOOTSTRAP_V2
  beforeEach(() => {
    vi.clearAllMocks()
    m.direct.mockResolvedValue([{ userId: 'direct' }])
    m.definer.mockResolvedValue([{ userId: 'definer' }])
  })
  afterEach(() => {
    if (prior === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = prior
  })

  it('reads the identity tables directly on the legacy lineage', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '0'
    const { activeMembershipSource } = await import('../active-membership-source')
    expect(await activeMembershipSource(exec, ORG, ['u1'])).toEqual([{ userId: 'direct' }])
    expect(m.definer).not.toHaveBeenCalled()
  })

  it('uses only the reader-owned definer function under the canonical V2 topology, where the runtime role has no table grant', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    const { activeMembershipSource } = await import('../active-membership-source')
    expect(await activeMembershipSource(exec, ORG, ['u1'])).toEqual([{ userId: 'definer' }])
    expect(m.direct).not.toHaveBeenCalled()
  })

  it('refuses an invalid topology flag instead of guessing', async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = 'maybe'
    const { activeMembershipSource } = await import('../active-membership-source')
    expect(() => activeMembershipSource(exec, ORG, ['u1'])).toThrow(/must be 0 or 1/)
  })
})
