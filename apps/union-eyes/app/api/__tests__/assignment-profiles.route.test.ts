import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const m = vi.hoisted(() => ({ allowed: vi.fn(), save: vi.fn(), requireAdmin: vi.fn(), query: vi.fn(), eligible: vi.fn(), workload: vi.fn(), invitations: vi.fn() }))
vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: (fn: (request: Request, context: { userId: string; organizationId: string }) => Promise<Response>) => (request: Request) => fn(request, { userId: 'admin-a', organizationId: 'org-a' }) }))
vi.mock('@nzila/platform-auth/invites', () => ({ canManageOrganizationInvites: m.allowed, listOrganizationInvites: m.invitations }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: (fn: (tx: unknown) => Promise<unknown>) => Promise.resolve().then(() => fn({ synthetic: 'transaction' })) }))
vi.mock('@/lib/cases/assignment-profiles', () => ({ requireMatchingProfileAdmin: m.requireAdmin, saveAssignmentProfile: m.save }))
vi.mock('@/lib/cases/assignment-eligibility', () => ({ matchingRepresentativeEligible: m.eligible }))
vi.mock('@/lib/cases/assignment-capacity', () => ({ representativeWorkloads: m.workload }))
vi.mock('@/lib/authority/store/route-adapter', () => ({ drizzleExecutor: () => ({ query: m.query }) }))
import { GET, PUT } from '../assignment-profiles/route'
import { ApiError } from '@/lib/api/errors'
const body = { userId: '11111111-1111-4111-8111-111111111111', specialization: 'safety', maxCaseload: 5, active: true }
const request = (input: unknown = body) => new NextRequest('http://localhost/api/assignment-profiles?organizationId=foreign', { method: 'PUT', body: JSON.stringify(input) })
beforeEach(() => {
  vi.clearAllMocks(); m.allowed.mockResolvedValue(true); m.invitations.mockResolvedValue([])
  m.query.mockResolvedValue({ rows: [] }); m.eligible.mockResolvedValue(true); m.workload.mockResolvedValue(new Map())
  m.requireAdmin.mockResolvedValue(undefined); m.save.mockResolvedValue({ ...body, id: 'profile', openCases: 2 })
})
describe('matching profile API', () => {
  it('refuses both reading and writing without direct active administration', async () => {
    m.allowed.mockResolvedValue(false)
    expect((await GET(request())).status).toBe(403); expect((await PUT(request())).status).toBe(403)
    expect(m.query).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled()
  })
  it.each(['organizationId','actorUserId','id'])('rejects client override %s', async key => {
    expect((await PUT(request({ ...body, [key]: 'forged' }))).status).toBe(400)
    expect(m.save).not.toHaveBeenCalled()
  })
  it('saves only through the authenticated actor and organization, ignoring URL tenant input', async () => {
    const response = await PUT(request())
    expect(response.status).toBe(200)
    expect(m.save).toHaveBeenCalledWith({ synthetic: 'transaction' }, { userId: 'admin-a', organizationId: 'org-a' }, body)
    expect(await response.json()).toMatchObject({ openCases: 2 })
  })
  it.each([['FORBIDDEN',403],['CONFLICT',409]] as const)('returns %s without calling a refused mutation successful', async (code,status) => {
    m.save.mockRejectedValueOnce(new ApiError(code, 'Refused'))
    expect((await PUT(request())).status).toBe(status)
  })
  it('rechecks administration inside the read transaction before returning tenant profiles', async () => {
    m.requireAdmin.mockRejectedValueOnce(ApiError.forbidden())
    expect((await GET(request())).status).toBe(403); expect(m.query).not.toHaveBeenCalled()
  })
  it('returns the eligible representative labels that the profile screen reads', async () => {
    m.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ userId: body.userId, name: 'Synthetic representative', email: 'synthetic@example.invalid' }] })
    const response = await GET(request())
    expect(await response.json()).toMatchObject({ representatives: [{ userId: body.userId, label: 'Synthetic representative' }] })
  })
})
