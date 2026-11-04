/**
 * F06 R5 — the union knowledge suite entitlement on knowledge-base reads.
 *
 * An organization's own rows are read without the suite; a parent's shared rows need it. Without it they are withheld from the list (and the
 * answer says so) and refused, with a recorded blocked operation, when opened by id. An entitlement that cannot be determined is not held.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const PARENT_ROW_ID = '11111111-1111-4111-8111-111111111111'
const OWN_ROW_ID = '22222222-2222-4222-8222-222222222222'

const m = vi.hoisted(() => ({
  parentId: 'org-parent' as string | null,
  entitled: true as boolean | 'throws',
  // What the caller's own tenant transaction shows (the caller's organization's rows only) and what the system role reads of the parent's shared rows.
  ownRows: [] as Array<Record<string, unknown>>,
  sharedRows: [] as Array<Record<string, unknown>>,
  ownItem: null as null | Record<string, unknown>,
  sharedItem: null as null | Record<string, unknown>,
  systemReads: 0,
  viewCountBumps: [] as unknown[],
  audit: vi.fn(),
  conditions: [] as unknown[],
  sharedConditions: [] as unknown[],
  entitlementChecks: vi.fn(),
}))

vi.mock('@/lib/api/framework', async () => (await import('./support/with-api-stub')).frameworkModule)
vi.mock('@/lib/api-auth-guard', () => ({
  hasMinRole: async () => false,
}))
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({
  resolveInterviewReader: async () => ({}),
  knowledgeBaseSourceCondition: () => 'SOURCE',
}))
vi.mock('@/lib/knowledge-transfer/governance/kb-visibility', () => ({
  knowledgeBaseOrganizationCondition: (orgId: string, parentId?: string) => { const c = { orgId, parentId }; m.conditions.push(c); return c },
  knowledgeBaseParentSharedCondition: (orgId: string, parentId: string) => { const c = { orgId, parentId }; m.sharedConditions.push(c); return c },
}))
// The hierarchy's own record names the parent (never a caller's claim); the lookup has its own coverage.
vi.mock('@/lib/organizations/read-authority', () => ({
  verifiedParentOf: async () => m.parentId ?? undefined,
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  checkModuleEntitlement: async (...args: unknown[]) => {
    m.entitlementChecks(...args)
    if (m.entitled === 'throws') throw new Error('entitlement store down')
    return { allowed: m.entitled }
  },
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...args: unknown[]) => m.audit(...args) }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn((...a: unknown[]) => ['eq', ...a]),
  and: vi.fn((...a: unknown[]) => ['and', ...a]),
  or: vi.fn((...a: unknown[]) => ['or', ...a]),
  ilike: vi.fn((...a: unknown[]) => ['ilike', ...a]),
  sql: Object.assign((strings: TemplateStringsArray) => strings.join('?'), { raw: (s: string) => s }),
}))
vi.mock('@/db/schema', () => ({ knowledgeBase: new Proxy({}, { get: (_t, p) => String(p) }) }))
vi.mock('@/db/db', () => {
  const chain = (result: () => unknown) => {
    const c: Record<string, unknown> = {}
    for (const k of ['from', 'where', 'orderBy', 'groupBy']) c[k] = () => c
    c.limit = async () => result()
    c.then = (resolve: (v: unknown) => unknown) => resolve(result())
    return c
  }
  return {
    // The caller's own tenant transaction.
    db: {
      select: () => chain(() => (m.ownItem ? [m.ownItem] : m.ownRows)),
      update: () => ({ set: (values: unknown) => ({ where: async () => { m.viewCountBumps.push(values) } }) }),
    },
    // The system role's reads, for the rows a parent organization shared.
    systemTx: { select: () => chain(() => (m.sharedItem ? [m.sharedItem] : m.sharedRows)) },
  }
})
vi.mock('@/lib/db/with-rls-context', async () => {
  const { systemTx } = await import('@/db/db') as unknown as { systemTx: unknown }
  return {
    withSystemContext: async (run: (tx: unknown) => unknown) => { m.systemReads += 1; return run(systemTx) },
    withRLSContext: async (_ctx: unknown, run: (tx: unknown) => unknown) => run({}),
  }
})

const { caller, declared, resetCaller } = await import('./support/with-api-stub')

const listRoute = () => import('../knowledge-base/route')
const itemRoute = () => import('../knowledge-base/[id]/route')

beforeEach(() => {
  vi.clearAllMocks()
  resetCaller()
  caller.userId = 'u1'
  caller.organizationId = 'org-child'
  caller.role = 'member'
  m.parentId = 'org-parent'
  m.entitled = true
  m.ownRows = [{ id: 'k1', title: 'Own policy' }]
  m.sharedRows = [{ id: 'k-shared', title: 'National policy' }]
  m.ownItem = null
  m.sharedItem = null
  m.systemReads = 0
  m.viewCountBumps = []
  m.conditions = []
  m.sharedConditions = []
  m.audit.mockResolvedValue(undefined)
})

const get = (url: string) => new NextRequest(`http://localhost${url}`)

describe('knowledge-base list', () => {
  it('declares what it asks of the wrapper: a signed-in member of an organization, reading in its tenant transaction', async () => {
    await listRoute()
    const config = declared.find((entry) => entry.openapi?.summary === 'List the active knowledge base records visible to the organization')

    expect(config?.auth).toEqual({ required: true })
    expect(config?.rlsOrgContext).toBe(true)
    expect(config?.requireOrg).toBeUndefined()
  })

  it('serves the parent\'s shared rows to an entitled organization', async () => {
    const { GET } = await listRoute()
    const body = await (await GET(get('/api/knowledge-base'))).json()

    expect(m.conditions.at(-1)).toEqual({ orgId: 'org-child', parentId: 'org-parent' })
    // The shared rows are read as the system role, by a condition that names the parent and this organization.
    expect(m.systemReads).toBe(1)
    expect(m.sharedConditions).toEqual([{ orgId: 'org-child', parentId: 'org-parent' }])
    expect(body.data.map((row: { id: string }) => row.id).sort()).toEqual(['k-shared', 'k1'])
    expect(body).not.toHaveProperty('withheld')
  })

  it('withholds the parent\'s shared rows from an organization without the suite, and says so', async () => {
    m.entitled = false
    const { GET } = await listRoute()
    const body = await (await GET(get('/api/knowledge-base'))).json()

    expect(m.conditions.every((c) => (c as { parentId?: string }).parentId === undefined)).toBe(true)
    // Nothing of the parent is read at all, not read and then filtered.
    expect(m.systemReads).toBe(0)
    expect(m.sharedConditions).toEqual([])
    expect(body.data.map((row: { id: string }) => row.id)).toEqual(['k1'])
    expect(body.withheld).toEqual({ parentShared: true, reason: 'union_knowledge_suite_required' })
  })

  it('fails closed when the entitlement cannot be determined', async () => {
    m.entitled = 'throws'
    const { GET } = await listRoute()
    const body = await (await GET(get('/api/knowledge-base'))).json()

    expect(m.conditions.every((c) => (c as { parentId?: string }).parentId === undefined)).toBe(true)
    expect(m.systemReads).toBe(0)
    expect(body.data.map((row: { id: string }) => row.id)).toEqual(['k1'])
    expect(body.withheld).toMatchObject({ parentShared: true })
  })

  it('does not consult the entitlement, or report anything withheld, for an organization with no parent', async () => {
    m.parentId = null
    m.entitled = false
    const { GET } = await listRoute()
    const body = await (await GET(get('/api/knowledge-base'))).json()

    expect(m.entitlementChecks).not.toHaveBeenCalled()
    expect(m.systemReads).toBe(0)
    expect(body).not.toHaveProperty('withheld')
  })

  it('is refused for a caller with no active organization, before anything is read', async () => {
    caller.organizationId = null
    const { GET } = await listRoute()

    expect((await GET(get('/api/knowledge-base'))).status).toBe(403)
    expect(m.systemReads).toBe(0)
    expect(m.entitlementChecks).not.toHaveBeenCalled()
  })
})

describe('knowledge-base item', () => {
  const open = async (id = PARENT_ROW_ID) => {
    const { GET } = await itemRoute()
    return GET(get(`/api/knowledge-base/${id}`), { params: Promise.resolve({ id }) })
  }
  const parentRow = { id: PARENT_ROW_ID, organizationId: 'org-parent', title: 'National policy', content: 'full text' }
  const ownRow = { id: OWN_ROW_ID, organizationId: 'org-child', title: 'Local policy', content: 'local text' }

  beforeEach(() => {
    // A record is read by id: the list rows of the tests above are not what the lookup finds.
    m.ownRows = []
    m.sharedRows = []
  })
  it('declares what it asks of the wrapper: a signed-in member of an organization, reading in its tenant transaction', async () => {
    await itemRoute()
    const config = declared.find((entry) => entry.openapi?.summary === 'Read one knowledge base record with its full content')

    expect(config?.auth).toEqual({ required: true })
    expect(config?.rlsOrgContext).toBe(true)
    expect(config?.requireOrg).toBeUndefined()
  })

  it('answers 400 for an id that is not a valid id, before anything is read', async () => {
    const response = await open('k-parent')

    expect(response.status).toBe(400)
    expect(m.systemReads).toBe(0)
    expect(m.audit).not.toHaveBeenCalled()
  })

  it('refuses a parent\'s row to an organization without the suite, records the blocked operation, and returns no content', async () => {
    m.sharedItem = parentRow
    m.entitled = false

    const response = await open()

    expect(response.status).toBe(403)
    expect(JSON.stringify(await response.json())).not.toContain('full text')
    expect(m.audit).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'knowledge_base.read_denied',
        organizationId: 'org-child',
        userId: 'u1',
        resourceId: PARENT_ROW_ID,
        details: expect.objectContaining({ reason: 'union_knowledge_suite_required', policyApprovedBy: null }),
      }),
      'failure',
    )
    expect(m.audit).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read' }))
    expect(m.viewCountBumps).toEqual([])
  })

  it('serves a parent\'s row to an entitled organization and records the read, without counting a view on the parent\'s row', async () => {
    m.sharedItem = parentRow

    const response = await open()

    expect(response.status).toBe(200)
    expect((await response.json()).data.content).toBe('full text')
    expect(m.sharedConditions).toEqual([{ orgId: 'org-child', parentId: 'org-parent' }])
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read', details: { ownedByReader: false } }))
    expect(m.viewCountBumps).toEqual([])
  })

  it('serves the organization\'s own row without the suite, and counts the view', async () => {
    m.ownItem = ownRow
    m.entitled = false

    const response = await open(OWN_ROW_ID)

    expect(response.status).toBe(200)
    expect(m.systemReads).toBe(0)
    expect(m.entitlementChecks).not.toHaveBeenCalled()
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read', details: { ownedByReader: true } }))
    expect(m.viewCountBumps).toHaveLength(1)
  })

  it('fails closed on a parent\'s row when the entitlement cannot be determined', async () => {
    m.sharedItem = parentRow
    m.entitled = 'throws'

    expect((await open()).status).toBe(403)
  })
})
