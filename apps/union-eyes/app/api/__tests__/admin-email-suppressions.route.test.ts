import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ lift: vi.fn(), atomic: vi.fn(), tx: { tx: true } }))

vi.mock('@/lib/api-auth-guard', () => ({
  withSystemAdminAuth: (handler: (r: NextRequest, c: unknown) => Promise<Response>) => (r: NextRequest, c: unknown = { userId: 'admin_1', organizationId: 'org_1' }) => handler(r, c),
}))
vi.mock('@/lib/audit/operation-audit', () => ({
  performAtomicAuditedOperation: m.atomic,
  operationAuditResponse: (e: unknown) => (e instanceof Error && e.message === 'audit refused' ? { status: 409, body: { error: 'audit' } } : null),
}))
vi.mock('@/lib/communications/address-suppression', async (importOriginal) => ({ ...(await importOriginal<typeof import('@/lib/communications/address-suppression')>()), liftAddressSuppression: m.lift }))
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { VALIDATION_ERROR: 'VALIDATION_ERROR', RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND' },
  standardErrorResponse: (code: string) => new Response(JSON.stringify({ code }), { status: code === 'RESOURCE_NOT_FOUND' ? 404 : 400 }),
}))

const post = (body: unknown) => new NextRequest('http://localhost/api/admin/email-suppressions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
const route = () => import('../admin/email-suppressions/route')

describe('admin/email-suppressions route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.atomic.mockImplementation(async (_op: unknown, work: (tx: unknown) => Promise<unknown>) => work(m.tx))
    m.lift.mockResolvedValue(true)
  })

  it('lifts a suppression and audits it on the same transaction, with the address hash fragment and never the address', async () => {
    const { POST } = await route()
    const response = await POST(post({ address: 'Person@Example.com', reason: 'The member confirmed this address by phone.' }))
    expect(response.status).toBe(200)
    expect(m.lift).toHaveBeenCalledWith(m.tx, { address: 'Person@Example.com', liftedBy: 'admin_1', reason: 'The member confirmed this address by phone.' })
    const op = m.atomic.mock.calls[0][0]
    expect(op).toMatchObject({ action: 'communications.address_suppression.lift', scope: 'system', userId: 'admin_1' })
    expect(JSON.stringify(op)).not.toContain('Person@Example.com')
    expect(op.details.addressSha256Prefix).toMatch(/^[0-9a-f]{12}$/)
  })

  it('answers 404 when there is no active suppression, so the lift (and its audit record) is abandoned', async () => {
    m.lift.mockResolvedValue(false)
    const { POST } = await route()
    expect((await POST(post({ address: 'a@example.com', reason: 'A sufficiently long reason.' }))).status).toBe(404)
  })

  it.each([[{ address: 'not-an-address', reason: 'A sufficiently long reason.' }], [{ address: 'a@example.com', reason: 'short' }], [null]])('refuses %j', async (body) => {
    const { POST } = await route()
    expect((await POST(post(body))).status).toBe(400)
    expect(m.atomic).not.toHaveBeenCalled()
  })

  it('answers 409 when the audit record cannot be written, lifting nothing', async () => {
    m.atomic.mockRejectedValue(new Error('audit refused'))
    const { POST } = await route()
    expect((await POST(post({ address: 'a@example.com', reason: 'A sufficiently long reason.' }))).status).toBe(409)
  })
})