import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { computeEntryHash } from '@nzila/os-core/hash'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  audit: vi.fn(),
  executiveOrg: vi.fn(),
  members: [] as unknown[],
  rows: {} as Record<string, unknown[][]>,
  queries: [] as Array<{ table: string; filter?: SQL; joins: SQL[]; limit?: number }>,
  values: [] as Array<{ table: string; value: Record<string, unknown> }>,
  failure: '' as string,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }))
vi.mock('next/headers', () => ({ headers: m.headers }))
vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({ platformDb: { select: m.select, insert: m.insert } }))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createRequestContext: () => ({ requestId: 'owned-unit-request' }),
  runWithContext: (_ctx: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@nzila/os-core/telemetry', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  withSpan: (_name: string, _attributes: unknown, fn: () => Promise<unknown>) => fn(),
}))
vi.mock('@/lib/audit-db', () => ({
  recordAuditEvent: m.audit,
  AUDIT_ACTIONS: { MEMBER_ADD: 'member.add' },
}))
// The executive-org lookup is a data dependency; the real role/membership guards remain in use.
vi.mock('@/lib/executive-os', () => ({ getExecutiveOrgId: m.executiveOrg }))

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const userId = 'canonical-non-uuid-operator'
const dialect = new PgDialect()
const request = (suffix = '', body?: object) =>
  new NextRequest('https://console.test/api' + suffix, {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const routes = [
  {
    name: 'org list',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (_r: NextRequest) => (await import('../../app/api/orgs/route')).GET(),
  },
  {
    name: 'org members',
    suffix: '',
    body: { userId: 'new-canonical-member', role: 'org_viewer' },
    denied: 401,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/orgs/[orgId]/people/route')).POST(r, {
        params: Promise.resolve({ orgId: org }),
      }),
  },
  {
    name: 'portfolio analytics',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (_r: NextRequest) => (await import('../../app/api/analytics/route')).GET(),
  },
  {
    name: 'approvals',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (_r: NextRequest) => (await import('../../app/api/approvals/route')).GET(),
  },
  {
    name: 'assurance',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (r: NextRequest) => (await import('../../app/api/assurance/route')).GET(r),
  },
  {
    name: 'evidence packs',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (r: NextRequest) => (await import('../../app/api/evidence-packs/route')).GET(r),
  },
  {
    name: 'cost rollup',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (r: NextRequest) => (await import('../../app/api/cost/rollup/route')).GET(r),
  },
  {
    name: 'tamper status',
    suffix: '',
    body: undefined,
    denied: 401,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/audit/tamper-status/route')).GET(r),
  },
  {
    name: 'chain verification',
    suffix: '',
    body: { orgId: org, chainType: 'audit' },
    denied: 401,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/audit/verify-chain/route')).POST(r),
  },
  {
    name: 'audit export',
    suffix: `?orgId=${org}`,
    body: undefined,
    denied: 401,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/audit-insights/export/route')).GET(r),
  },
  {
    name: 'sales signals',
    suffix: '',
    body: undefined,
    denied: 403,
    invoke: async (_r: NextRequest) => (await import('../../app/api/sales/signals/route')).GET(),
  },
  {
    name: 'ITSM clients',
    suffix: '',
    body: { companyName: 'Synthetic client' },
    denied: 401,
    invoke: async (r: NextRequest) => (await import('../../app/api/itsm/clients/route')).POST(r),
  },
  {
    name: 'governance vote',
    suffix: '',
    body: {
      orgId: org,
      motionId: foreign,
      motionType: 'payout',
      vote: 'for',
      quorumPercent: 100,
      isInitiatorVoting: false,
    },
    denied: 401,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/governance/votes/route')).POST(r),
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AI_SERVICE_KEY', '')
  m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
  m.currentUser.mockResolvedValue(null)
  m.headers.mockResolvedValue(new Headers())
  m.executiveOrg.mockResolvedValue(org)
  m.audit.mockResolvedValue(undefined)
  m.members = [{ id: 'membership', orgId: org, userId, role: 'org_admin', status: 'active' }]
  m.rows = {}
  m.queries = []
  m.values = []
  m.failure = ''
  m.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table),
        rows = name === 'org_members' ? m.members : (m.rows[name]?.shift() ?? [])
      const observation: (typeof m.queries)[number] = { table: name, joins: [] }
      m.queries.push(observation)
      const chain = {
        innerJoin: (_table: unknown, filter: SQL) => {
          observation.joins.push(filter)
          return chain
        },
        leftJoin: (_table: unknown, filter: SQL) => {
          observation.joins.push(filter)
          return chain
        },
        where: (filter: SQL) => {
          observation.filter = filter
          return chain
        },
        orderBy: () => chain,
        groupBy: () => chain,
        limit: (limit: number) => {
          observation.limit = limit
          return chain
        },
        then: (resolve: (value: unknown[]) => unknown, reject: (error: Error) => unknown) =>
          (m.failure === name
            ? Promise.reject(new Error('owned fixture query failure'))
            : Promise.resolve(rows)
          ).then(resolve, reject),
      }
      return chain
    },
  }))
  m.insert.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    values: (value: Record<string, unknown>) => {
      const name = getTableName(table)
      m.values.push({ table: name, value })
      const rows = [{ id: 'created-row', status: 'active' }]
      return {
        returning: () => Promise.resolve(rows),
        then: (resolve: (value: undefined) => unknown) => Promise.resolve(undefined).then(resolve),
      }
    },
  }))
})
afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('Console portfolio extraction retains real role and organization boundaries', () => {
  it.each(routes)(
    '$name rejects missing session before reads, mutations or executive-org lookup',
    async (route) => {
      m.auth.mockResolvedValue({ userId: null })
      expect((await route.invoke(request(route.suffix, route.body))).status).toBe(route.denied)
      expect(m.queries).toEqual([])
      expect(m.values).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
      expect(m.executiveOrg).not.toHaveBeenCalled()
    },
  )
  it.each(['viewer', 'analyst'])(
    'ITSM rejects actual nonoperator %s before executive lookup or storage',
    async (role) => {
      m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: role } } })
      expect((await routes[11].invoke(request('', routes[11].body))).status).toBe(403)
      expect(m.executiveOrg).not.toHaveBeenCalled()
      expect(m.queries).toEqual([])
      expect(m.values).toEqual([])
    },
  )
  it('ITSM retains admitted platform operator creation, canonical owner identity and input normalization', async () => {
    const response = await routes[11].invoke(
      request('', { companyName: ' Synthetic client ', contactName: ' Operator ', notes: ' ' }),
    )
    expect(response.status).toBe(201)
    expect(m.executiveOrg).toHaveBeenCalledTimes(1)
    expect(m.values).toEqual([
      {
        table: 'ops_clients',
        value: expect.objectContaining({
          orgId: org,
          companyName: 'Synthetic client',
          contactName: 'Operator',
          notes: null,
          product: 'other',
          onboardingStage: 'prospect',
          accountOwnerId: userId,
        }),
      },
    ])
  })
  it('org list and approvals retain active membership joins for the current canonical principal', async () => {
    expect((await routes[0].invoke(request())).status).toBe(200)
    expect((await routes[3].invoke(request())).status).toBe(200)
    for (const q of m.queries) {
      const params = q.joins.flatMap((join) => dialect.sqlToQuery(join).params)
      expect(params).toContain(userId)
      expect(params).toContain('active')
      expect(params).not.toContain(foreign)
    }
  })
  it('portfolio aggregates retain source membership and every child-org query restriction', async () => {
    m.rows.orgs = [
      [{ id: org, legalName: 'Synthetic organization', jurisdiction: 'CA', status: 'active' }],
    ]
    const response = await routes[2].invoke(request())
    expect(response.status).toBe(200)
    expect((await response.json()).orgs).toBe(1)
    const source = m.queries[0]
    expect(source.table).toBe('orgs')
    expect(source.joins.flatMap((join) => dialect.sqlToQuery(join).params)).toEqual([
      userId,
      'active',
    ])
    for (const q of m.queries.slice(1)) expect(dialect.sqlToQuery(q.filter!).params).toEqual([org])
  })
  it('cost rollups use only fresh active memberships and keep the existing bounded source window', async () => {
    expect((await routes[6].invoke(request())).status).toBe(200)
    const [memberships, rollups] = m.queries
    expect(dialect.sqlToQuery(memberships.filter!).params).toEqual([userId, 'active'])
    expect(dialect.sqlToQuery(rollups.filter!).params).toEqual([
      org,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    ])
    m.members = []
    m.queries = []
    expect(await (await routes[6].invoke(request())).json()).toEqual({ rollups: [] })
    expect(m.queries).toHaveLength(1)
  })
  it('member mutation retains org-admin enforcement, exact inserted target and audit actor', async () => {
    m.members = [{ id: 'membership', orgId: org, userId, role: 'org_viewer', status: 'active' }]
    expect((await routes[1].invoke(request('', routes[1].body))).status).toBe(403)
    expect(m.values).toEqual([])
    m.members = [{ id: 'membership', orgId: org, userId, role: 'org_admin', status: 'active' }]
    expect((await routes[1].invoke(request('', routes[1].body))).status).toBe(201)
    expect(m.values[0].value).toEqual({
      orgId: org,
      userId: 'new-canonical-member',
      role: 'org_viewer',
    })
    expect(m.audit).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: org,
        actorClerkUserId: userId,
        actorRole: 'org_admin',
        targetId: 'created-row',
      }),
    )
  })
  it('global assurance and evidence require the existing actual administrator roles', async () => {
    for (const route of [routes[4], routes[5]])
      expect((await route.invoke(request())).status).toBe(403)
    expect(m.queries).toEqual([])
    m.auth.mockResolvedValue({
      userId,
      sessionClaims: { publicMetadata: { nzilaRole: 'platform_admin' } },
    })
    m.rows.evidence_packs = [
      [{ status: 'verified', chainIntegrity: 'VERIFIED', eventType: 'fixture' }],
    ]
    m.rows.platform_isolation_audits = [[{ isolationScore: 50 }]]
    m.rows.close_periods = [[{ status: 'closed' }]]
    const response = await routes[4].invoke(request('?download=true'))
    expect(response.headers.get('content-disposition')).toContain('assurance-dashboard-')
    expect((await response.json()).kpis).toMatchObject({
      compliance: { value: 100 },
      security: { value: 75 },
      operations: { value: 100 },
    })
  })
  it('audit CSV retains exact org restriction and escaped representation after authorization', async () => {
    m.rows.audit_events = [
      [{ targetType: 'fixture', action: 'read', orgId: org, entityName: 'An "org"', total: 2 }],
    ]
    const response = await routes[9].invoke(request(`?orgId=${org}`))
    expect(response.headers.get('content-type')).toBe('text/csv')
    expect(await response.text()).toBe(
      `target_type,action,org_id,entity_name,total\nfixture,read,${org},"An ""org""",2`,
    )
    const q = m.queries.find((q) => q.table === 'audit_events')!
    expect(dialect.sqlToQuery(q.filter!).params).toEqual([org])
    expect(q.limit).toBe(10000)
    m.members = []
    m.queries = []
    expect((await routes[9].invoke(request(`?orgId=${foreign}`))).status).toBe(403)
    expect(m.queries.map((q) => q.table)).toEqual(['org_members'])
  })
  it('chain verification uses the real hashing function and rejects altered payload without storage mutation', async () => {
    const payload = {
      orgId: org,
      actorClerkUserId: userId,
      actorRole: 'ops',
      action: 'fixture',
      targetType: 'matter',
      targetId: 'resource',
      beforeJson: null,
      afterJson: { text: 'É\n"🧭"' },
    }
    const row = { ...payload, previousHash: null, hash: computeEntryHash(payload, null) }
    m.rows.audit_events = [[row], [{ ...row, afterJson: { text: 'altered' } }]]
    expect((await (await routes[8].invoke(request('', routes[8].body))).json()).valid).toBe(true)
    expect((await (await routes[8].invoke(request('', routes[8].body))).json()).valid).toBe(false)
    expect(m.values).toEqual([])
    for (const q of m.queries.filter((q) => q.table === 'audit_events'))
      expect(dialect.sqlToQuery(q.filter!).params).toEqual([org])
  })
  it('sales signals retain global operator authorization and original dependency-failure status', async () => {
    m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'viewer' } } })
    expect((await routes[10].invoke(request())).status).toBe(403)
    expect(m.queries).toEqual([])
    m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
    m.failure = 'pilot_definitions'
    expect((await routes[10].invoke(request())).status).toBe(503)
  })
  it.each([0, 100])(
    'unqualified voting returns501 for caller quorum%s before SQL, external policy or mutation',
    async (quorumPercent) => {
      const externalCall = vi.fn()
      vi.stubGlobal('fetch', externalCall)
      const response = await routes[12].invoke(request('', { ...routes[12].body, quorumPercent }))
      expect(response.status).toBe(501)
      expect(await response.json()).toMatchObject({ code: 'VERIFIED_VOTING_SOURCE_UNAVAILABLE' })
      expect(m.queries).toEqual([])
      expect(m.values).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
      expect(externalCall).not.toHaveBeenCalled()
    },
  )
})
