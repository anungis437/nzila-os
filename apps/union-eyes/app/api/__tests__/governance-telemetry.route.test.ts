import { beforeEach, describe, expect, it, vi } from 'vitest'

// Issue #1118: governance telemetry derives no organization's activity across tenants. Policy denials are not counted from
// policy_evaluations, for a platform administrator or anyone else; only the platform's own governance_events log is counted, and only
// for a platform administrator.
const m = vi.hoisted(() => ({
  authenticateUser: vi.fn(),
  isSystemAdmin: vi.fn(),
  tablesRead: [] as string[],
  count: 5,
}))

vi.mock('@/lib/api-guards', () => ({
  authenticateUser: m.authenticateUser,
  withRequestContext: (_req: Request, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/api-auth-guard', () => ({ isSystemAdmin: m.isSystemAdmin }))
vi.mock('@nzila/os-core/telemetry', () => ({ withSpan: (_n: string, _a: unknown, fn: () => unknown) => fn() }))
vi.mock('@/db/schema', () => ({ governanceEvents: { __table: 'governance_events' } }))
vi.mock('@/db/schema/policy-engine-schema', () => ({ policyEvaluations: { __table: 'policy_evaluations' } }))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: (fn: (tx: unknown) => unknown) => fn({}) }))
vi.mock('@/db/db', () => ({
  db: {
    select: () => ({
      from: (table: { __table: string }) => {
        m.tablesRead.push(table.__table)
        const rows = Promise.resolve([{ count: m.count }])
        return { where: () => rows, then: rows.then.bind(rows) }
      },
    }),
  },
}))

import { GET } from '../governance/telemetry/route'

const call = async () => {
  const res = (await GET(new Request('http://localhost/api/governance/telemetry'))) as Response
  return { status: res.status, body: await res.json() }
}

describe('GET /api/governance/telemetry', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    m.tablesRead.length = 0
    m.authenticateUser.mockResolvedValue({ ok: true, userId: 'u1' })
  })

  it('reads no table for a signed-in caller who is not a platform administrator, and reports unmeasured figures as null', async () => {
    m.isSystemAdmin.mockResolvedValue(false)
    const { status, body } = await call()
    expect(status).toBe(200)
    expect(m.tablesRead).toEqual([])
    expect(body.policy_denied_count).toBeNull()
    expect(body.audit_event_volume).toBeNull()
    // Nothing records these: they are not measured here, never a constant zero (#1118).
    expect(body.workflow_transition_error_count).toBeNull()
    expect(body.evidence_export_count).toBeNull()
    expect(body.auth_anomaly_count).toBeNull()
  })

  it('counts only the platform governance log for a platform administrator, never organizations\' policy evaluations', async () => {
    m.isSystemAdmin.mockResolvedValue(true)
    const { status, body } = await call()
    expect(status).toBe(200)
    expect(m.tablesRead).toEqual(['governance_events'])
    expect(m.tablesRead).not.toContain('policy_evaluations')
    expect(body.audit_event_volume).toBe(5)
    expect(body.policy_denied_count).toBeNull()
  })

  it('answers the authentication failure unchanged for an anonymous caller', async () => {
    m.authenticateUser.mockResolvedValue({ ok: false, response: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }) })
    const { status } = await call()
    expect(status).toBe(401)
    expect(m.isSystemAdmin).not.toHaveBeenCalled()
    expect(m.tablesRead).toEqual([])
  })
})
