import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ inserted: [] as unknown[], rows: [] as unknown[] }))

vi.mock('@/lib/api-auth-guard', () => ({
  withRoleAuth: (_role: string, handler: (request: NextRequest, context: unknown) => unknown) => handler,
}))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }))
vi.mock('@/db/schema', () => ({ pilotFeedback: { id: 'id', organizationId: 'organizationId' }, pilotEvents: {} }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(), sql: Object.assign(vi.fn(() => 'sql'), {}) }))
vi.mock('@/db', () => ({
  db: {
    execute: vi.fn(async () => [{ total_responses: 1 }]),
    select: () => ({ from: () => ({ where: () => ({ orderBy: () => ({ limit: async () => m.rows }) }) }) }),
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => {
    const work = args[args.length - 1] as (tx: unknown) => Promise<unknown>
    const tx = {
      insert: () => ({
        values: (value: unknown) => {
          m.inserted.push(value)
          const pending: Promise<unknown> & { returning?: () => Promise<unknown[]> } = Promise.resolve(undefined)
          pending.returning = async () => [{ id: 'f1' }]
          return pending
        },
      }),
    }
    return work(tx)
  },
}))

const ctx = { userId: 'user-1', organizationId: 'org-1' }
const post = async (body: unknown) => {
  const { POST } = await import('../pilot/feedback/route')
  return (POST as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(
    new NextRequest('http://localhost/api/pilot/feedback', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) }),
    ctx,
  )
}

// DEF-0B10-PIL-PILOT-FEEDBACK-COMMENT-IS-UNVALIDATED-AND-UNBOUNDED-AND-IS-RETURNED-RAW-WITH-THE-USER-ID
describe('pilot/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.inserted = []
    m.rows = []
  })

  it('stores a valid comment trimmed', async () => {
    const response = await post({ easeRating: 4, trigger: 'first_case', comment: '  clear  ' })
    expect(response.status).toBe(200)
    expect(m.inserted[0]).toMatchObject({ comment: 'clear', userId: 'user-1', organizationId: 'org-1' })
  })

  it.each([{ comment: 'x'.repeat(2001) }, { comment: { nested: true } }, { comment: 42 }])('refuses %j before storing anything', async (extra) => {
    const response = await post({ easeRating: 4, trigger: 'first_case', ...extra })
    expect(response.status).toBe(400)
    expect(m.inserted).toHaveLength(0)
  })

  it('refuses a body that is not a JSON object', async () => {
    expect((await post('not json')).status).toBe(400)
    expect((await post([1])).status).toBe(400)
  })

  it('does not return the author of recent feedback to the administrator', async () => {
    m.rows = [{ id: 'f1', userId: 'user-9', easeRating: 2, comment: 'slow', category: 'slow' }]
    const { GET } = await import('../pilot/feedback/route')
    const response = await (GET as unknown as (r: NextRequest, c: unknown) => Promise<Response>)(new NextRequest('http://localhost/api/pilot/feedback'), ctx)
    const body = await response.json()
    expect(body.recent).toEqual([{ id: 'f1', easeRating: 2, comment: 'slow', category: 'slow' }])
    expect(JSON.stringify(body)).not.toContain('user-9')
  })
})
