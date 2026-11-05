import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ rows: [] as unknown[][], scope: vi.fn(), below: vi.fn() }))

vi.mock('@/db', () => {
  const chain: Record<string, unknown> = {}
  for (const name of ['select', 'from', 'where']) chain[name] = () => chain
  chain.limit = async () => h.rows.shift() ?? []
  return { db: chain }
})
vi.mock('@/db/schema', () => ({ committeeMemberships: { id: 'id', committeeId: 'committeeId', memberId: 'memberId', status: 'status' } }))
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }))
vi.mock('@/lib/api/errors', () => ({ ApiError: { notFound: (what: string) => Object.assign(new Error(what), { code: 'NOT_FOUND' }) } }))
vi.mock('@/lib/api/crud-low-role-guard', () => ({ isBelowStaff: h.below }))
vi.mock('@/lib/services/committee-workspace-service', () => ({ requireCommitteeScope: h.scope }))

import { requireCommitteeReader } from '../committee-read-access'

// DEF-0B5-COMMITTEE-READ-IGNORES-MEMBERSHIP
describe('requireCommitteeReader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.rows = []
    h.scope.mockResolvedValue(undefined)
  })

  it('checks the committee and children belong to the organization first', async () => {
    h.below.mockResolvedValue(false)
    await requireCommitteeReader('o1', 'c1', 'u1', { meetingId: 'm1' })
    expect(h.scope).toHaveBeenCalledWith('o1', 'c1', { meetingId: 'm1' })
  })

  it('lets staff read without a membership row', async () => {
    h.below.mockResolvedValue(false)
    await expect(requireCommitteeReader('o1', 'c1', 'steward')).resolves.toBeUndefined()
  })

  it('lets an active member of the committee read', async () => {
    h.below.mockResolvedValue(true)
    h.rows = [[{ id: 'mem1' }]]
    await expect(requireCommitteeReader('o1', 'c1', 'member')).resolves.toBeUndefined()
  })

  it('answers a member who is not on the committee exactly as for a missing committee', async () => {
    h.below.mockResolvedValue(true)
    h.rows = [[]]
    await expect(requireCommitteeReader('o1', 'c1', 'outsider')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('refuses a caller with no identity', async () => {
    await expect(requireCommitteeReader('o1', 'c1', null)).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })

  it('does not reach the membership check when the committee is another organization\'s', async () => {
    h.scope.mockRejectedValueOnce(Object.assign(new Error('Committee'), { code: 'NOT_FOUND' }))
    await expect(requireCommitteeReader('o2', 'c1', 'u1')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(h.below).not.toHaveBeenCalled()
  })
})
