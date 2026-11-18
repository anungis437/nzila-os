import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'
import { ACTION_TYPES } from '../../../../packages/ai-core/src/schemas'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  audit: vi.fn(),
  policy: vi.fn(),
  execute: vi.fn(),
  review: vi.fn(),
  members: [] as unknown[],
  rows: {} as Record<string, unknown[][]>,
  queries: [] as Array<{ table: string; filter?: SQL; limit?: number }>,
  values: [] as Array<{ table: string; value: Record<string, unknown> }>,
  changes: [] as Array<{ table: string; value: Record<string, unknown>; filter?: SQL }>,
  order: [] as string[],
  insertError: false,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }))
vi.mock('next/headers', () => ({ headers: m.headers }))
vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({
  platformDb: { select: m.select, insert: m.insert, update: m.update },
}))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
}))
vi.mock('@nzila/ai-sdk', () => ({ recordAiReviewDecision: m.review }))
vi.mock('@nzila/ai-core', async () => ({
  ...(await import('../../../../packages/ai-core/src/schemas')),
  appendAiAuditEvent: m.audit,
  checkActionPolicy: m.policy,
  executeAction: m.execute,
  listPromptVersions: vi.fn(async () => []),
  activatePromptVersion: vi.fn(),
}))

const org = '11111111-1111-4111-8111-111111111111'
const foreign = '22222222-2222-4222-8222-222222222222'
const userId = 'canonical-non-uuid-operator'
const knowledge = {
  orgId: org,
  appKey: 'console',
  profileKey: 'knowledge-default',
  source: { sourceType: 'manual_text', title: 'Synthetic source', text: 'Owned test fixture' },
  retention: { dataClass: 'internal' },
}
const monthly = {
  orgId: org,
  appKey: 'console',
  profileKey: 'finance-default',
  period: { startDate: '2026-01-01', endDate: '2026-01-31', periodLabel: '2026-01' },
}
const proposal = {
  orgId: org,
  appKey: 'console',
  profileKey: 'knowledge-default',
  actionType: ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE,
  proposalJson: knowledge,
}
const query = `?orgId=${org}&startDate=2026-01-01&endDate=2026-01-31`
const dialect = new PgDialect()
const request = (suffix: string, body?: object) =>
  new NextRequest('https://console.test/api' + suffix, {
    method: body ? 'POST' : 'GET',
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const routes = [
  {
    name: 'prompt list',
    url: '?appKey=console',
    body: undefined,
    invoke: async (r: NextRequest) => (await import('../../app/api/ai/prompts/route')).GET(r),
  },
  {
    name: 'prompt version creation',
    url: '',
    body: { promptId: foreign, template: 'Synthetic template' },
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ai/prompts/versions/route')).POST(r),
  },
  {
    name: 'typed action proposal',
    url: '',
    body: proposal,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ai/actions/propose/route')).POST(r),
  },
  {
    name: 'knowledge action',
    url: '',
    body: knowledge,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ai/actions/knowledge/ingest/route')).POST(r),
  },
  {
    name: 'existing monthly report action',
    url: '',
    body: monthly,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ai/actions/finance/stripe-monthly-reports/route')).POST(r),
  },
  {
    name: 'models',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) => (await import('../../app/api/ml/models/route')).GET(r),
  },
  {
    name: 'active models',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) => (await import('../../app/api/ml/models/active/route')).GET(r),
  },
  {
    name: 'training runs',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) => (await import('../../app/api/ml/runs/training/route')).GET(r),
  },
  {
    name: 'inference runs',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ml/runs/inference/route')).GET(r),
  },
  {
    name: 'daily scores',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ml/scores/stripe/daily/route')).GET(r),
  },
  {
    name: 'transaction scores',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ml/scores/stripe/transactions/route')).GET(r),
  },
  {
    name: 'case priority scores',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ml/scores/ue/cases/priority/route')).GET(r),
  },
  {
    name: 'case SLA scores',
    url: query,
    body: undefined,
    invoke: async (r: NextRequest) =>
      (await import('../../app/api/ml/scores/ue/cases/sla-risk/route')).GET(r),
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AI_SERVICE_KEY', '')
  m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
  m.currentUser.mockResolvedValue(null)
  m.headers.mockResolvedValue(new Headers())
  m.members = [{ id: 'membership', orgId: org, userId, role: 'org_admin', status: 'active' }]
  m.rows = {}
  m.queries = []
  m.values = []
  m.changes = []
  m.order = []
  m.insertError = false
  m.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table)
      const rows = name === 'org_members' ? m.members : (m.rows[name]?.shift() ?? [])
      const observation: (typeof m.queries)[number] = { table: name }
      m.queries.push(observation)
      const chain = {
        innerJoin: () => chain,
        where: (filter: SQL) => {
          observation.filter = filter
          return chain
        },
        orderBy: () => chain,
        limit: (limit: number) => {
          observation.limit = limit
          return chain
        },
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      }
      return chain
    },
  }))
  m.insert.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    values: (value: Record<string, unknown>) => {
      m.values.push({ table: getTableName(table), value })
      m.order.push('insert')
      return {
        returning: async () => {
          if (m.insertError) throw new Error('owned fixture store unavailable')
          return [{ id: 'action-or-prompt' }]
        },
      }
    },
  }))
  m.update.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    set: (value: Record<string, unknown>) => ({
      where: async (filter: SQL) => {
        m.changes.push({ table: getTableName(table), value, filter })
        m.order.push('update')
      },
    }),
  }))
  m.audit.mockImplementation(async () => {
    m.order.push('audit')
  })
  m.policy.mockImplementation(async () => {
    m.order.push('policy')
    return { allowed: false, autoApproved: false, riskTier: 'high', approvalsRequired: [] }
  })
  m.execute.mockResolvedValue({ status: 'success' })
})
afterEach(() => vi.unstubAllEnvs())

describe('Console AI/ML extraction through real operator and org guards', () => {
  it.each(routes)(
    '$name rejects missing session before any database or action operation',
    async (route) => {
      m.auth.mockResolvedValue({ userId: null })
      expect((await route.invoke(request(route.url, route.body))).status).toBe(401)
      expect(m.queries).toEqual([])
      expect(m.values).toEqual([])
      expect(m.audit).not.toHaveBeenCalled()
      expect(m.policy).not.toHaveBeenCalled()
      expect(m.execute).not.toHaveBeenCalled()
    },
  )
  it('retains actual operator-role denial even when an org membership fixture exists', async () => {
    m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'viewer' } } })
    expect((await routes[5].invoke(request(query))).status).toBe(403)
    expect(m.queries).toEqual([])
  })
  it.each(routes.slice(5))(
    '$name retains the actual fresh membership and business org filters',
    async (route) => {
      expect((await route.invoke(request(route.url))).status).toBe(200)
      expect(m.queries[0].table).toBe('org_members')
      expect(dialect.sqlToQuery(m.queries[0].filter!).params).toEqual([org, userId, 'active'])
      for (const q of m.queries.slice(1))
        expect(dialect.sqlToQuery(q.filter!).params).toContain(org)
    },
  )
  it('denies missing foreign membership and private features before any model-data query', async () => {
    m.members = []
    expect((await routes[5].invoke(request(query.replace(org, foreign)))).status).toBe(403)
    expect(m.queries).toHaveLength(1)
    expect(dialect.sqlToQuery(m.queries[0].filter!).params).toEqual([foreign, userId, 'active'])
    m.members = [{ id: 'membership', orgId: org, userId, role: 'org_viewer', status: 'active' }]
    m.queries = []
    expect((await routes[11].invoke(request(query + '&includeFeatures=true'))).status).toBe(403)
    expect(m.queries.map((q) => q.table)).toEqual(['org_members'])
  })
  it('keeps real proposal validation and policy-denial persistence before any execution', async () => {
    const response = await routes[2].invoke(request('', proposal))
    expect(response.status).toBe(201)
    expect(await response.json()).toMatchObject({ status: 'rejected' })
    expect(m.order).toEqual(['insert', 'audit', 'policy', 'update'])
    expect(m.values[0].value).toMatchObject({ orgId: org, requestedBy: userId, status: 'proposed' })
    expect(m.changes[0].value).toMatchObject({
      status: 'rejected',
      approvedBy: null,
      approvedAt: null,
    })
    expect(m.execute).not.toHaveBeenCalled()
    expect(m.review).not.toHaveBeenCalled()
  })
  it.each([routes[3], routes[4]])(
    '$name preserves policy refusal and never calls an execution provider',
    async (route) => {
      expect((await route.invoke(request('', route.body))).status).toBe(403)
      expect(m.order).toEqual(['insert', 'audit', 'policy', 'update'])
      expect(m.execute).not.toHaveBeenCalled()
    },
  )
  it('keeps action persistence failure before audit, policy and execution', async () => {
    m.insertError = true
    expect((await routes[3].invoke(request('', knowledge))).status).toBe(500)
    expect(m.audit).not.toHaveBeenCalled()
    expect(m.policy).not.toHaveBeenCalled()
    expect(m.execute).not.toHaveBeenCalled()
  })
  it('retains knowledge auto-approval and execution order and truthful awaiting-approval response', async () => {
    m.policy.mockResolvedValueOnce({ allowed: true, autoApproved: true, riskTier: 'low' })
    expect((await routes[3].invoke(request('', knowledge))).status).toBe(201)
    expect(m.execute).toHaveBeenCalledExactlyOnceWith('action-or-prompt', userId)
    expect(m.changes[0].value).toMatchObject({ status: 'approved', approvedBy: 'system' })
    expect(m.audit.mock.invocationCallOrder[0]).toBeLessThan(m.execute.mock.invocationCallOrder[0])
    m.policy.mockResolvedValueOnce({
      allowed: true,
      autoApproved: false,
      riskTier: 'medium',
      approvalsRequired: ['operator-review'],
    })
    expect((await routes[3].invoke(request('', knowledge))).status).toBe(202)
    expect(m.execute).toHaveBeenCalledTimes(1)
    expect(m.changes.at(-1)!.value).toMatchObject({
      status: 'awaiting_approval',
      approvalsRequiredJson: ['operator-review'],
    })
  })
  it('retains prompt version allocation/defaults and the exact canonical creator identity', async () => {
    m.rows.ai_prompt_versions = [[{ version: 2 }]]
    expect((await routes[1].invoke(request('', routes[1].body))).status).toBe(201)
    expect(m.values[0]).toMatchObject({
      table: 'ai_prompt_versions',
      value: {
        promptId: foreign,
        version: 3,
        createdBy: userId,
        allowedFeatures: [],
        defaultParams: {},
      },
    })
  })
  it('retains composite case pagination, source sorting and omission of private features', async () => {
    const occurredAt = new Date('2026-01-03T00:00:00Z')
    const row = {
      id: 'case-score-b',
      caseId: 'logical-case',
      occurredAt,
      createdAt: occurredAt,
      featuresJson: { private: 'must not leak' },
    }
    m.rows.ml_scores_ue_cases_priority = [[row, { ...row, id: 'case-score-a' }]]
    const response = await routes[11].invoke(request(query + '&limit=1'))
    const body = await response.json()
    expect(body.items).toHaveLength(1)
    expect(Buffer.from(body.nextCursor, 'base64').toString()).toBe(
      occurredAt.toISOString() + '|case-score-b',
    )
    expect(JSON.stringify(body)).not.toContain('must not leak')
    const businessQuery = m.queries.find((q) => q.table === 'ml_scores_ue_cases_priority')!
    expect(businessQuery.limit).toBe(2)
    const invalid = await routes[12].invoke(request(query + '&cursor=malformed'))
    expect(invalid.status).toBe(400)
  })
})
