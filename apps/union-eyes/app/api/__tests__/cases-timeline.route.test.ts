import { beforeEach, describe, expect, it, vi } from 'vitest'
const m = vi.hoisted(() => ({ actor: vi.fn(), find: vi.fn(), rls: vi.fn() }))
vi.mock('@/lib/api/with-api', () => ({ withApi: (_config: unknown, handler: unknown) => handler }))
vi.mock('@/lib/cases/case-authorization', async original => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  getCaseActor: m.actor, findReadableCase: m.find,
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.rls }))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn() }))
import { GET } from '../cases/[caseId]/timeline/route'
const call = (caseId?: string) => (GET as unknown as (context: unknown) => Promise<{data: unknown[]}> )({params:{caseId}})
beforeEach(() => {
  vi.clearAllMocks()
  m.actor.mockResolvedValue({ userId: 'actor', organizationId: 'org', role: 'member' })
  m.find.mockResolvedValue({ claimId: '11111111-1111-4111-8111-111111111111' })
  const query = { from: () => query, where: () => query, orderBy: async () => [
    {updateId:'history',createdAt:new Date('2026-10-23T05:00:00Z'),updateType:'note',message:'Visible',createdBy:'actor'},
  ] }
  m.rls.mockImplementation(async fn => fn({select:()=>query}))
})
describe('case timeline', () => {
  it('rejects a missing case reference', async () => {
    await expect(call()).rejects.toMatchObject({code:'NOT_FOUND'})
  })
  it('returns 404 for a foreign, unreadable or nonexistent case', async () => {
    m.find.mockResolvedValueOnce(null)
    await expect(call('foreign')).rejects.toMatchObject({code:'NOT_FOUND'})
  })
  it('loads the authorized case and history in the same tenant transaction', async () => {
    expect((await call('CASE-20261023-0001')).data).toEqual([
      {id:'history',timestamp:'2026-10-23T05:00:00.000Z',type:'note',description:'Visible',actor:'actor'},
    ])
    expect(m.rls).toHaveBeenCalledTimes(1)
    expect(m.find).toHaveBeenCalledWith(expect.anything(),expect.objectContaining({userId:'actor'}),'CASE-20261023-0001')
  })
})
