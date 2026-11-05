import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  calls: [] as Array<{ table: string; predicate: unknown }>,
  options: null as Record<string, unknown> | null,
  surveyExists: true,
}))

vi.mock('@/lib/api/framework', () => ({
  withApi: (options: Record<string, unknown>, handler: unknown) => {
    state.options = options
    return handler
  },
  zUUID: {
    safeParse: (value: unknown) => ({
      success: typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,28}$/i.test(value),
      data: value,
    }),
  },
}))

vi.mock('@/db/schema', () => ({
  surveys: { id: 'surveys.id', organizationId: 'surveys.organization_id', tableName: 'surveys' },
  surveyResponses: { surveyId: 'responses.survey_id', organizationId: 'responses.organization_id', tableName: 'responses' },
  surveyQuestions: { id: 'questions.id', surveyId: 'questions.survey_id', organizationId: 'questions.organization_id', tableName: 'questions' },
}))

vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ column, value }),
  and: (...predicates: unknown[]) => ({ predicates }),
  count: () => 'COUNT',
}))

vi.mock('@/db/db', () => ({
  db: {
    select: (_selection?: unknown) => {
      let table = ''
      const query = {
        from: (source: { tableName: string }) => { table = source.tableName; return query },
        where: (predicate: unknown) => { state.calls.push({ table, predicate }); return query },
        limit: async (_limit: number) => state.surveyExists ? [{ id: 'survey' }] : [],
        then: (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => {
          const rows = table === 'responses' ? [{ count: 4 }] : [{ id: 'question' }]
          return Promise.resolve(rows).then(resolve, reject)
        },
      }
      return query
    },
  },
}))

import { GET } from './route'

const handler = GET as unknown as (ctx: { params: Record<string, string>; organizationId: string | null }) => Promise<unknown>
const surveyId = '11111111-1111-4111-8111-111111111111'
const organizationId = '22222222-2222-4222-8222-222222222222'

describe('survey results tenant boundary', () => {
  beforeEach(() => { state.calls.length = 0; state.surveyExists = true })

  it('reads only survey-owned aggregates, never unscoped answer contents', async () => {
    const result = await handler({ params: { surveyId }, organizationId })
    expect(result).toEqual({ surveyId, totalResponses: 4, questionCount: 1 })
    expect(state.options).toMatchObject({ requireOrg: true, rlsOrgContext: true })
    expect(state.calls.map((call) => call.table)).toEqual(['surveys', 'responses', 'questions'])
    for (const { predicate } of state.calls) {
      expect(JSON.stringify(predicate)).toContain(organizationId)
    }
  })

  it('does not read response rows for a survey unavailable to the tenant', async () => {
    state.surveyExists = false
    const response = await handler({ params: { surveyId }, organizationId }) as Response
    expect(response.status).toBe(404)
    expect(state.calls.map((call) => call.table)).toEqual(['surveys'])
  })

  it('rejects missing organization context without performing a database read', async () => {
    const response = await handler({ params: { surveyId }, organizationId: null }) as Response
    expect(response.status).toBe(403)
    expect(state.calls).toEqual([])
  })
})
