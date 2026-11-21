import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getTableName, type SQL } from 'drizzle-orm'
import { PgDialect } from 'drizzle-orm/pg-core'

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  headers: vi.fn(),
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  rows: {} as Record<string, unknown[][]>,
  updates: [] as unknown[],
  queries: [] as Array<{ table: string; filter?: SQL }>,
  writes: [] as Array<{
    operation: string
    table: string
    value: Record<string, unknown>
    filter?: SQL
  }>,
  sequence: 0,
}))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth, currentUser: m.currentUser }))
vi.mock('next/headers', () => ({ headers: m.headers }))
vi.mock('@nzila/db', () => ({
  createScopedDb: vi.fn(),
  createAuditedScopedDb: vi.fn(),
  withAudit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({ platformDb: { select: m.select } }))
vi.mock('@/lib/db', () => ({ db: { select: m.select, insert: m.insert, update: m.update } }))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
  createRequestContext: vi.fn(),
  runWithContext: vi.fn(),
}))

const org = '11111111-1111-4111-8111-111111111111'
const surveyId = '22222222-2222-4222-8222-222222222222'
const userId = 'canonical-non-uuid-operator'
const token = 'owned_synthetic_survey_token_123'
const date = new Date('2026-11-17T00:00:00Z')
const survey = {
  id: surveyId,
  orgId: org,
  status: 'active',
  title: 'Synthetic survey',
  localName: 'Synthetic local',
  unitName: 'Synthetic unit',
  championLabel: 'Synthetic champion',
  internalNotes: 'Private operator note',
  shareToken: token,
}
const dialect = new PgDialect()
const request = (body?: object, method = 'POST') =>
  new Request('https://console.test/api', {
    method: body ? method : 'GET',
    headers: { 'x-forwarded-for': `owned-fixture-${m.sequence}` },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('AI_SERVICE_KEY', '')
  m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'ops' } } })
  m.currentUser.mockResolvedValue(null)
  m.headers.mockResolvedValue(new Headers())
  m.rows = {}
  m.updates = []
  m.queries = []
  m.writes = []
  m.sequence++
  m.select.mockImplementation(() => ({
    from: (table: Parameters<typeof getTableName>[0]) => {
      const name = getTableName(table),
        rows = m.rows[name]?.shift() ?? []
      const observation: (typeof m.queries)[number] = { table: name }
      m.queries.push(observation)
      const chain = {
        where: (filter: SQL) => {
          observation.filter = filter
          return chain
        },
        limit: () => chain,
        orderBy: () => chain,
        then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
      }
      return chain
    },
  }))
  m.insert.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    values: (value: Record<string, unknown>) => {
      m.writes.push({ operation: 'insert', table: getTableName(table), value })
      return {
        returning: async () => [{ id: surveyId }],
        then: (resolve: (value: undefined) => unknown) => Promise.resolve(undefined).then(resolve),
      }
    },
  }))
  m.update.mockImplementation((table: Parameters<typeof getTableName>[0]) => ({
    set: (value: Record<string, unknown>) => ({
      where: (filter: SQL) => {
        m.writes.push({ operation: 'update', table: getTableName(table), value, filter })
        return { returning: async () => m.updates }
      },
    }),
  }))
})
afterEach(() => vi.unstubAllEnvs())

describe('healthcare survey service preserves the actual operator/token boundaries', () => {
  it('status GET refuses anonymous and ordinary principals before any ID lookup or disclosure', async () => {
    const { GET } = await import('../../app/api/healthcare/surveys/[surveyId]/status/route')
    m.auth.mockResolvedValueOnce({ userId: null })
    expect((await GET(request(), { params: Promise.resolve({ surveyId }) })).status).toBe(401)
    m.auth.mockResolvedValue({ userId, sessionClaims: { publicMetadata: { nzilaRole: 'viewer' } } })
    expect((await GET(request(), { params: Promise.resolve({ surveyId }) })).status).toBe(403)
    expect(m.queries).toEqual([])
    expect(m.writes).toEqual([])
  })
  it('status GET retains admitted operator read and exact requested survey filter', async () => {
    const { GET } = await import('../../app/api/healthcare/surveys/[surveyId]/status/route')
    m.rows.healthcare_surveys = [[survey]]
    const response = await GET(request(), { params: Promise.resolve({ surveyId }) })
    expect(response.status).toBe(200)
    expect((await response.json()).survey.id).toBe(surveyId)
    expect(dialect.sqlToQuery(m.queries[0].filter!).params).toEqual([surveyId])
  })
  it('retains the existing real operator guard before survey creation', async () => {
    const { POST } = await import('../../app/api/healthcare/surveys/route')
    m.auth.mockResolvedValue({
      userId: 'ordinary-user',
      sessionClaims: { publicMetadata: { nzilaRole: 'viewer' } },
    })
    await expect(POST(request({ title: 'Synthetic' }))).rejects.toThrow('Forbidden')
    expect(m.queries).toEqual([])
    expect(m.writes).toEqual([])
  })
  it('creates the existing draft with canonical actor, private notice and audit on the same original store', async () => {
    const { POST } = await import('../../app/api/healthcare/surveys/route')
    const response = await POST(
      request({
        title: 'Synthetic',
        localName: 'Local',
        unitName: 'Unit',
        championLabel: 'Champion',
        purposeStatement: 'Owned fixture',
        targetOrgId: org,
      }),
    )
    expect(response.status).toBe(200)
    expect(m.writes[0]).toMatchObject({
      table: 'healthcare_surveys',
      value: {
        orgId: org,
        createdBy: userId,
        status: 'draft',
        anonymous: true,
        allowFreeText: true,
        shareToken: expect.stringMatching(/^[A-Za-z0-9_-]{20,}$/),
      },
    })
    expect(m.writes[1]).toMatchObject({
      table: 'audit_log',
      value: { actorId: userId, orgId: org },
    })
  })
  it('preserves anonymous exact-token lookup and refuses invalid, absent or inactive surveys before insertion', async () => {
    const { POST } = await import('../../app/api/healthcare/surveys/responses/route')
    m.auth.mockResolvedValue({ userId: null })
    expect((await POST(request({ token: 'invalid', answers: {} }))).status).toBe(400)
    expect(m.queries).toEqual([])
    expect((await POST(request({ token, answers: {} }))).status).toBe(404)
    m.rows.healthcare_surveys = [[{ ...survey, status: 'draft' }]]
    expect((await POST(request({ token, answers: {} }))).status).toBe(400)
    for (const q of m.queries) expect(dialect.sqlToQuery(q.filter!).params).toEqual([token])
    expect(m.writes).toEqual([])
  })
  it('retains legitimate anonymous submission and free-text review metadata without exposing private survey fields', async () => {
    const { POST } = await import('../../app/api/healthcare/surveys/responses/route')
    m.auth.mockResolvedValue({ userId: null })
    m.rows.healthcare_surveys = [[survey]]
    const response = await POST(
      request({ token, answers: { q16: 'Unreviewed private free text' } }),
    )
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ ok: true, responseId: surveyId })
    expect(JSON.stringify(body)).not.toContain('Private operator note')
    expect(m.writes[0]).toMatchObject({
      table: 'healthcare_survey_responses',
      value: { surveyId, containsFreeText: true, reviewStatus: 'unreviewed' },
    })
    expect(m.writes[1]).toMatchObject({
      table: 'audit_log',
      value: { actorId: 'respondent:anonymous', orgId: org },
    })
    expect(m.auth).not.toHaveBeenCalled()
  })
  it('retains the actual anonymous rate limiter before database access', async () => {
    const { POST } = await import('../../app/api/healthcare/surveys/responses/route')
    for (let i = 0; i < 20; i++)
      expect((await POST(request({ token: 'invalid', answers: {} }))).status).toBe(400)
    expect((await POST(request({ token, answers: {} }))).status).toBe(429)
    expect(m.queries).toEqual([])
    expect(m.writes).toEqual([])
  })
  it('summary export runs actual review-safe projection and audit without leaking unreviewed free text', async () => {
    const { GET } = await import('../../app/api/healthcare/surveys/[surveyId]/export-summary/route')
    m.rows.healthcare_surveys = [[survey]]
    m.rows.healthcare_survey_responses = [
      [
        {
          id: 'response',
          surveyId,
          anonymousResponseId: 'anonymous',
          submittedAt: date,
          createdAt: date,
          answers: { q16: 'MUST_NOT_LEAK_RAW_UNREVIEWED_TEXT' },
          workflowScores: {},
          topPriority: null,
          concernTags: [],
          containsFreeText: true,
          reviewStatus: 'unreviewed',
          redactionNote: null,
        },
      ],
    ]
    const response = await GET(request(), { params: Promise.resolve({ surveyId }) })
    expect(response.status).toBe(200)
    expect(response.headers.get('content-disposition')).toContain(surveyId + '.json')
    expect(await response.text()).not.toContain('MUST_NOT_LEAK_RAW_UNREVIEWED_TEXT')
    expect(m.writes.at(-1)).toMatchObject({
      table: 'audit_log',
      value: { actorId: userId, orgId: org },
    })
  })
})
