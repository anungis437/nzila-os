/**
 * F06 R5 — the union knowledge suite entitlement on knowledge-base reads.
 *
 * An organization's own rows are read without the suite; a parent's shared rows need it. Without it they are withheld from the list (and the
 * answer says so) and refused, with a recorded blocked operation, when opened by id. An entitlement that cannot be determined is not held.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  user: { id: 'u1', organizationId: 'org-child' } as { id: string; organizationId: string } | null,
  parentId: 'org-parent' as string | null,
  entitled: true as boolean | 'throws',
  rows: [] as Array<Record<string, unknown>>,
  itemRow: null as null | Record<string, unknown>,
  audit: vi.fn(),
  conditions: [] as unknown[],
}))

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: (handler: (...a: never[]) => unknown) => handler,
  getCurrentUser: async () => m.user,
  hasMinRole: async () => false,
}))
vi.mock('@/lib/knowledge-transfer/governance/interview-access', () => ({
  resolveInterviewReader: async () => ({}),
  knowledgeBaseSourceCondition: () => 'SOURCE',
}))
vi.mock('@/lib/knowledge-transfer/governance/kb-visibility', () => ({
  knowledgeBaseOrganizationCondition: (orgId: string, parentId?: string) => { const c = { orgId, parentId }; m.conditions.push(c); return c },
}))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  checkModuleEntitlement: async () => { if (m.entitled === 'throws') throw new Error('entitlement store down'); return { allowed: m.entitled } },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: () => unknown) => fn(),
  withRLSContext: async (_ctx: unknown, fn: (tx: unknown) => unknown) => fn({}),
}))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: (...args: unknown[]) => m.audit(...args) }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }))
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
    db: {
      select: () => chain(() => (m.itemRow ? [m.itemRow] : m.rows)),
      execute: async () => [{ parent_id: m.parentId }],
    },
  }
})

const listRoute = () => import('../knowledge-base/route')
const itemRoute = () => import('../knowledge-base/[id]/route')

beforeEach(() => {
  vi.clearAllMocks()
  m.user = { id: 'u1', organizationId: 'org-child' }
  m.parentId = 'org-parent'
  m.entitled = true
  m.rows = [{ id: 'k1', title: 'Own policy' }]
  m.itemRow = null
  m.conditions = []
  m.audit.mockResolvedValue(undefined)
})

const get = (url: string) => new NextRequest(`http://localhost${url}`)
type Handler = (r: NextRequest, c: unknown) => Promise<Response>

describe('knowledge-base list', () => {
  it('serves the parent\'s shared rows to an entitled organization', async () => {
    const { GET } = await listRoute()
    const body = await (await (GET as unknown as Handler)(get('/api/knowledge-base'), {})).json()

    expect(m.conditions.at(-1)).toEqual({ orgId: 'org-child', parentId: 'org-parent' })
    expect(body).not.toHaveProperty('withheld')
  })

  it('withholds the parent\'s shared rows from an organization without the suite, and says so', async () => {
    m.entitled = false
    const { GET } = await listRoute()
    const body = await (await (GET as unknown as Handler)(get('/api/knowledge-base'), {})).json()

    expect(m.conditions.every((c) => (c as { parentId?: string }).parentId === undefined)).toBe(true)
    expect(body.withheld).toEqual({ parentShared: true, reason: 'union_knowledge_suite_required' })
  })

  it('fails closed when the entitlement cannot be determined', async () => {
    m.entitled = 'throws'
    const { GET } = await listRoute()
    const body = await (await (GET as unknown as Handler)(get('/api/knowledge-base'), {})).json()

    expect(m.conditions.every((c) => (c as { parentId?: string }).parentId === undefined)).toBe(true)
    expect(body.withheld).toMatchObject({ parentShared: true })
  })

  it('does not consult the entitlement, or report anything withheld, for an organization with no parent', async () => {
    m.parentId = null
    m.entitled = false
    const { GET } = await listRoute()
    const body = await (await (GET as unknown as Handler)(get('/api/knowledge-base'), {})).json()

    expect(body).not.toHaveProperty('withheld')
  })
})

describe('knowledge-base item', () => {
  const open = async (id = 'k-parent') => {
    const { GET } = await itemRoute()
    return (GET as unknown as Handler)(get(`/api/knowledge-base/${id}`), { params: Promise.resolve({ id }) })
  }
  const parentRow = { id: 'k-parent', organizationId: 'org-parent', title: 'National policy', content: 'full text' }
  const ownRow = { id: 'k-own', organizationId: 'org-child', title: 'Local policy', content: 'local text' }

  it('refuses a parent\'s row to an organization without the suite, records the blocked operation, and returns no content', async () => {
    m.itemRow = parentRow
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
        resourceId: 'k-parent',
        details: expect.objectContaining({ reason: 'union_knowledge_suite_required', policyApprovedBy: null }),
      }),
      'failure',
    )
    expect(m.audit).not.toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read' }))
  })

  it('serves a parent\'s row to an entitled organization and records the read', async () => {
    m.itemRow = parentRow

    const response = await open()

    expect(response.status).toBe(200)
    expect((await response.json()).data.content).toBe('full text')
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read', details: { ownedByReader: false } }))
  })

  it('serves the organization\'s own row without the suite', async () => {
    m.itemRow = ownRow
    m.entitled = false

    const response = await open('k-own')

    expect(response.status).toBe(200)
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'knowledge_base.read', details: { ownedByReader: true } }))
  })

  it('fails closed on a parent\'s row when the entitlement cannot be determined', async () => {
    m.itemRow = parentRow
    m.entitled = 'throws'

    expect((await open()).status).toBe(403)
  })
})
