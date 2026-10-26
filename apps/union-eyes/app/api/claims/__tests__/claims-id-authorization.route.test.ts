import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  organization: vi.fn(),
  role: vi.fn(),
  audit: vi.fn(),
  findReadableCase: vi.fn(),
  db: null as null | { execute: (query: unknown) => Promise<{ rows: unknown[] }> },
}))

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }))
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.organization, getUserRoleInOrganization: m.role }))
vi.mock('@/lib/audit-logger', () => ({ auditLog: m.audit, AuditEventType: { AUTH_FAILED: 'AUTH_FAILED' }, AuditSeverity: { HIGH: 'HIGH' } }))
vi.mock('@/lib/auth/canonical-bootstrap', () => ({ currentStateContextEnabled: () => true }))
// The kernel decision itself is proven in lib/cases/kernel-claims.pglite.test.ts; this file proves how the route uses it.
vi.mock('@/lib/cases/case-authorization', async (original) => ({
  ...(await original<typeof import('@/lib/cases/case-authorization')>()),
  findReadableCase: m.findReadableCase,
}))
vi.mock('@/db/schema', () => ({ claims: {} }))
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ PATCH: vi.fn(), DELETE: vi.fn() }) }))
// The route handler runs directly; authentication is supplied by the mocked platform session above.
vi.mock('@/lib/api/with-api', () => ({ withApi: (_options: unknown, handler: unknown) => handler }))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (fn: (tx: unknown) => unknown) =>
    fn({ execute: async (query: unknown) => (await m.db!.execute(query)).rows }),
}))

import { GET } from '../[id]/route'
import { caseAuthorizationResponse } from '@/lib/cases/case-authorization'

type Handler = (ctx: { params: { id: string } }) => Promise<{ data: Record<string, unknown> }>
const handler = GET as unknown as Handler

const org = '11111111-1111-4111-8111-111111111111'
const foreignOrg = '22222222-2222-4222-8222-222222222222'
const ids = { own: randomUUID(), other: randomUUID(), assigned: randomUUID(), foreign: randomUUID() }
const SECRET_OTHER = 'PRIVATE-OTHER-MEMBER-DETAIL'
let pg: PGlite

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(fs.readFileSync(new URL('../../../../db/queries/__tests__/fixtures/canonical-claim-write.sql', import.meta.url), 'utf8'))
  await pg.exec('CREATE TABLE organization_members (user_id text, organization_id uuid, name text, email text, phone text)')
  m.db = drizzle(pg) as unknown as typeof m.db
  const rows: Array<[keyof typeof ids, string, string, string | null, string]> = [
    ['own', org, 'member-1', null, 'own case'],
    ['other', org, 'member-2', null, SECRET_OTHER],
    ['assigned', org, 'member-3', 'steward-1', 'assigned case'],
    ['foreign', foreignOrg, 'member-1', null, 'foreign case'],
  ]
  for (const [name, orgId, member, assignee, description] of rows) {
    await pg.query(
      `INSERT INTO claims(id,claim_id,claim_number,created_at,updated_at,organization_id,member_id,assigned_to,description,
        is_anonymous,previously_reported,witnesses_present,priority,progress,status,ai_score,ai_analysis,legal_costs)
       VALUES($1,$2,$3,now(),now(),$4,$5,$6,$7,false,false,false,'medium',0,'submitted',80,'{"risk":"high"}'::jsonb,'1500')`,
      [randomUUID(), ids[name], `CASE-${name.toUpperCase()}`, orgId, member, assignee, description],
    )
  }
})
afterAll(async () => { await pg?.close() })

function signIn(userId: string | null, role: string | null, organizationId: string | null = org) {
  m.auth.mockResolvedValue({ userId })
  m.organization.mockResolvedValue(organizationId)
  m.role.mockResolvedValue(role)
}
const asMember = () => signIn('member-1', 'member')

async function call(reference: string) {
  try {
    const body = await handler({ params: { id: reference } })
    return { status: 200, body: body as unknown }
  } catch (error) {
    const response = caseAuthorizationResponse(error)
    if (!response) throw error
    return { status: response.status, body: await response.json() as unknown }
  }
}

beforeEach(() => { vi.clearAllMocks(); m.audit.mockResolvedValue(undefined) })

describe('GET /api/claims/[id] authorization', () => {
  it('resolves the case through the kernel read decision, then returns the member their own case by claimId and by case number', async () => {
    asMember()
    for (const reference of [ids.own, 'CASE-OWN']) {
      m.findReadableCase.mockResolvedValueOnce({ claimId: ids.own, visibility: 'member_visible' })
      const result = await call(reference)
      expect(result.status).toBe(200)
      expect((result.body as { data: { claimId: string } }).data.claimId).toBe(ids.own)
      expect(m.findReadableCase).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ userId: 'member-1', organizationId: org }), reference, false, 'case:read')
    }
  })

  it('removes the internal assessment fields from a member-visible decision but keeps the case the member filed', async () => {
    asMember()
    m.findReadableCase.mockResolvedValueOnce({ claimId: ids.own, visibility: 'member_visible' })
    const { data } = (await call(ids.own)).body as { data: Record<string, unknown> }
    for (const field of ['aiScore', 'aiAnalysis', 'meritConfidence', 'precedentMatch', 'complexityScore', 'legalCosts', 'courtCosts']) {
      expect(data).not.toHaveProperty(field)
    }
    expect(data).toMatchObject({ claimId: ids.own, claimNumber: 'CASE-OWN', description: 'own case' })
  })

  it('keeps the internal assessment fields for an internal decision', async () => {
    signIn('steward-1', 'steward')
    m.findReadableCase.mockResolvedValueOnce({ claimId: ids.own, visibility: 'internal' })
    const { data } = (await call(ids.own)).body as { data: Record<string, unknown> }
    expect(data).toMatchObject({ claimId: ids.own, aiScore: 80, aiAnalysis: { risk: 'high' }, legalCosts: '1500' })
  })

  it('answers 404 for an unreadable case by both identifiers without disclosing anything about it', async () => {
    asMember()
    m.findReadableCase.mockResolvedValue(null)
    for (const reference of [ids.other, 'CASE-OTHER']) {
      const result = await call(reference)
      expect(result.status).toBe(404)
      const text = JSON.stringify(result.body)
      expect(text).not.toContain(SECRET_OTHER)
      expect(text).not.toContain('member-2')
      expect(text).not.toContain(ids.other)
      expect(text).not.toContain('CASE-OTHER')
    }
  })

  it('answers a nonexistent, unreadable and foreign-organization case identically, running no detail query', async () => {
    asMember()
    m.findReadableCase.mockResolvedValue(null)
    const spy = vi.spyOn(m.db!, 'execute')
    const unreadable = await call('CASE-OTHER')
    const missing = await call('CASE-NOT-THERE')
    const foreign = await call(ids.foreign)
    expect(unreadable.status).toBe(404)
    expect(missing).toEqual(unreadable)
    expect(foreign).toEqual(unreadable)
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('binds the detail row to the caller organization even if a decision named another organization\'s case', async () => {
    asMember()
    m.findReadableCase.mockResolvedValueOnce({ claimId: ids.foreign, visibility: 'internal' })
    const result = await call(ids.foreign)
    expect(result.status).toBe(404)
    expect(JSON.stringify(result.body)).not.toContain('foreign case')
  })

  it.each([
    ['no role', null],
    ['an unknown role', 'unknown'],
    ['a platform support role', 'support_agent'],
  ])('fails closed with %s before any case query runs', async (_label, role) => {
    signIn('member-1', role)
    const spy = vi.spyOn(m.db!, 'execute')
    const result = await call('CASE-OWN')
    expect(result.status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
    expect(m.findReadableCase).not.toHaveBeenCalled()
    expect(JSON.stringify(result.body)).not.toContain('CASE-OWN')
    spy.mockRestore()
  })

  it('fails closed when the organization context is missing', async () => {
    signIn('member-1', 'member', null)
    const spy = vi.spyOn(m.db!, 'execute')
    expect((await call('CASE-OWN')).status).toBe(403)
    expect(spy).not.toHaveBeenCalled()
    expect(m.findReadableCase).not.toHaveBeenCalled()
    spy.mockRestore()
  })

  it('requires an authenticated user', async () => {
    signIn(null, null)
    expect((await call('CASE-OWN')).status).toBe(401)
    expect(m.findReadableCase).not.toHaveBeenCalled()
  })
})
