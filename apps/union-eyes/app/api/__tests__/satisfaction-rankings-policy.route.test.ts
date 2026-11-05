import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MIN_RESPONSES_FOR_FIGURES, mayReadRepresentativeFigures, withEnoughResponses } from '@/lib/satisfaction/figures-policy'

const m = vi.hoisted(() => ({ rankings: vi.fn(), audit: vi.fn(), config: null as unknown }))

vi.mock('@/lib/api/framework', () => ({
  withApi: (cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => {
    m.config = cfg
    return (ctx: unknown) => handler(ctx)
  },
  ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) },
}))
vi.mock('@/lib/services/satisfaction-service', () => ({ getOrganizationLroRankings: m.rankings }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) => fn({}) }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))

describe('satisfaction figures policy', () => {
  it('leaves out a representative with fewer than the minimum number of responses and counts them', () => {
    const { shown, suppressed } = withEnoughResponses([{ completedSurveys: 1 }, { completedSurveys: 5 }, { completedSurveys: 12 }, { completedSurveys: 4 }])
    expect(shown.map((r) => r.completedSurveys)).toEqual([5, 12])
    expect(suppressed).toBe(2)
    expect(MIN_RESPONSES_FOR_FIGURES).toBe(5)
  })

  it('lets a caller read their own figures and an officer read anyone\'s', () => {
    expect(mayReadRepresentativeFigures({ callerUserId: 'a', representativeId: 'a', isOfficer: false })).toBe(true)
    expect(mayReadRepresentativeFigures({ callerUserId: 'a', representativeId: 'b', isOfficer: false })).toBe(false)
    expect(mayReadRepresentativeFigures({ callerUserId: 'a', representativeId: 'b', isOfficer: true })).toBe(true)
    expect(mayReadRepresentativeFigures({ callerUserId: null, representativeId: 'b', isOfficer: false })).toBe(false)
  })
})

describe('GET /api/satisfaction/rankings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.audit.mockResolvedValue(undefined)
  })

  it('is an officer read that suppresses small samples and records the read', async () => {
    m.rankings.mockResolvedValue([
      { lroId: 'l1', completedSurveys: 9, overallAverage: 4.5 },
      { lroId: 'l2', completedSurveys: 2, overallAverage: 5 },
    ])
    const { GET } = await import('../satisfaction/rankings/route')
    expect((m.config as { auth: { minRole: string } }).auth.minRole).toBe('officer')
    const result = (await (GET as never as (c: unknown) => Promise<unknown>)({ organizationId: 'org_1', userId: 'u1' })) as { rankings: Array<{ lroId: string }>; suppressed: number; minimumResponses: number }
    expect(result.rankings.map((r) => r.lroId)).toEqual(['l1'])
    expect(result.suppressed).toBe(1)
    expect(result.minimumResponses).toBe(5)
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'satisfaction.rankings.read', details: { returned: 1, suppressed: 1 } }))
  })

  it('refuses a caller with no organization before reading', async () => {
    const { GET } = await import('../satisfaction/rankings/route')
    await expect((GET as never as (c: unknown) => Promise<unknown>)({ organizationId: null, userId: 'u1' })).rejects.toMatchObject({ status: 400 })
    expect(m.rankings).not.toHaveBeenCalled()
  })
})
