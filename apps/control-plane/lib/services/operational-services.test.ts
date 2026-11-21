import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  select: vi.fn(),
  insert: vi.fn(),
  values: vi.fn(),
  conflicts: vi.fn(),
  aggregate: vi.fn(),
  anonymize: vi.fn(),
  benchmark: vi.fn(),
  score: vi.fn(),
  improvements: vi.fn(),
  drift: vi.fn(),
  freshness: vi.fn(),
  sla: vi.fn(),
  where: vi.fn(),
  limit: vi.fn(),
}))
vi.mock('@nzila/db/platform', () => ({ platformDb: { select: m.select, insert: m.insert } }))
vi.mock('@nzila/db/schema', () => ({
  auditRecords: { organizationId: 'org', decisionType: 'decision', createdAt: 'created' },
  decisionAggregates: { table: 'aggregate' },
  decisionPipelineCheckpoints: { pipelineName: 'pipeline' },
  decisionPipelineRuns: { pipelineName: 'pipeline', startedAt: 'started' },
  pipelineAlerts: { id: 'id', severity: 'severity', createdAt: 'created', resolvedAt: 'resolved' },
}))
vi.mock('drizzle-orm', () => ({
  eq: (column: unknown, value: unknown) => ({ eq: [column, value] }),
  gte: (column: unknown, value: unknown) => ({ gte: [column, value] }),
  lte: (column: unknown, value: unknown) => ({ lte: [column, value] }),
  and: (...conditions: unknown[]) => ({ and: conditions }),
  asc: (column: unknown) => column,
  desc: (column: unknown) => column,
  isNull: (column: unknown) => ({ isNull: column }),
}))
vi.mock('@nzila/decision-intelligence', () => ({
  aggregateDecisionRecords: m.aggregate,
  anonymizeAggregates: m.anonymize,
  getBenchmark: m.benchmark,
  computeFreshnessLag: m.freshness,
  evaluateFreshnessSla: m.sla,
}))
vi.mock('@nzila/policy-intelligence', () => ({
  scorePolicy: m.score,
  suggestPolicyImprovements: m.improvements,
  detectPolicyDrift: m.drift,
}))

function reads(...results: unknown[][]) {
  const queue = [...results]
  m.select.mockImplementation(() => {
    const rows = queue.shift() ?? []
    const chain = {
      from: () => chain,
      where: (filter: unknown) => {
        m.where(filter)
        return chain
      },
      orderBy: () => chain,
      limit: (limit: number) => {
        m.limit(limit)
        return Promise.resolve(rows)
      },
      then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
    }
    return chain
  })
}
const aggregate = {
  organizationId: 'org',
  domain: 'commerce',
  decisionType: 'quote',
  policy: { version: '1', effectivenessScore: 0.9 },
  timeWindow: { start: '2026-01-01T00:00:00Z', end: '2026-01-02T00:00:00Z' },
  metrics: {
    total: 10,
    approvalRate: 0.6,
    rejectionRate: 0.2,
    escalationRate: 0.1,
    avgDecisionTimeMs: 20,
  },
  behavior: { overrideRate: 0.1, humanInterventionRate: 0.2 },
}
beforeEach(() => {
  vi.resetAllMocks()
  reads([])
  m.aggregate.mockReturnValue([])
  m.insert.mockReturnValue({ values: m.values })
  m.values.mockReturnValue({ onConflictDoNothing: m.conflicts })
  m.conflicts.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())

describe('actual intelligence and operational service coordination', () => {
  it('keeps org/time filters, source window, bounded count and persisted aggregate mapping', async () => {
    const row = {
      organizationId: 'org',
      decisionType: 'quote',
      policyVersion: '1',
      createdAt: new Date('2026-01-01T00:00:00Z'),
      payload: { id: 'proof' },
    }
    reads([row])
    m.aggregate.mockReturnValue([aggregate])
    const { collectDecisionMetrics } = await import('./intelligence-service')
    const response = await collectDecisionMetrics({
      orgId: 'org',
      from: '2026-01-01T00:00:00Z',
      to: null,
      tier: 'pro',
    })
    expect(m.where).toHaveBeenCalledWith({
      and: [{ eq: ['org', 'org'] }, { gte: ['created', new Date('2026-01-01T00:00:00Z')] }],
    })
    expect(m.limit).toHaveBeenCalledWith(5000)
    expect(m.aggregate).toHaveBeenCalledWith(
      [{ ...row, createdAt: row.createdAt.toISOString() }],
      expect.objectContaining({ windowStart: '2026-01-01T00:00:00Z' }),
    )
    expect(m.values).toHaveBeenCalledWith([
      expect.objectContaining({
        organizationId: 'org',
        total: 10,
        approvals: 6,
        rejections: 2,
        escalations: 1,
        pending: 1,
        overrideRate: '0.1',
        humanInterventionRate: '0.2',
        source: 'audit_records',
        meta: { tier: 'pro', generatedFrom: 'audit_records' },
      }),
    ])
    expect(m.conflicts).toHaveBeenCalledTimes(1)
    expect(response.data.aggregates).toEqual([aggregate])
  })
  it('does not create empty aggregate rows and propagates failed persistence', async () => {
    const { collectDecisionMetrics } = await import('./intelligence-service')
    const input = { orgId: 'org', from: null, to: null, tier: 'basic' }
    await collectDecisionMetrics(input)
    expect(m.insert).not.toHaveBeenCalled()
    m.aggregate.mockReturnValue([aggregate])
    m.conflicts.mockRejectedValueOnce(new Error('ledger unavailable'))
    await expect(collectDecisionMetrics(input)).rejects.toThrow('ledger unavailable')
  })
  it('keeps the authorized cross-org benchmark query and exposes only anonymized samples', async () => {
    reads([])
    m.aggregate.mockReturnValue([aggregate, { ...aggregate, organizationId: 'foreign' }])
    m.anonymize.mockReturnValue([{ anonymous: true }])
    m.benchmark.mockReturnValue({ topQuartile: 0.5, bottomQuartile: 0.2 })
    const { collectDecisionBenchmarks } = await import('./intelligence-service')
    const response = await collectDecisionBenchmarks({
      orgId: 'org',
      decisionType: 'quote',
      domain: 'commerce',
      from: null,
      to: null,
      tier: 'enterprise',
    })
    expect(m.where).toHaveBeenCalledWith({ and: [{ eq: ['decision', 'quote'] }] })
    expect(m.limit).toHaveBeenCalledWith(10000)
    expect(m.anonymize).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ organizationId: 'foreign' })]),
    )
    expect(response.data).toMatchObject({
      anonymizedSample: [{ anonymous: true }],
      percentileHint: 'top_quartile',
    })
    expect(JSON.stringify(response)).not.toContain('foreign')
  })
  it('keeps explicit policy version drift inputs and source organization filter', async () => {
    m.aggregate.mockReturnValue([aggregate])
    m.score.mockReturnValue({ scored: true })
    m.improvements.mockReturnValue([])
    m.drift.mockReturnValue({ changed: false })
    const { collectPolicyInsights } = await import('./intelligence-service')
    await collectPolicyInsights({
      orgId: 'org',
      decisionType: 'quote',
      oldVersion: '1',
      newVersion: '2',
      from: null,
      to: null,
      tier: 'pro',
    })
    expect(m.where).toHaveBeenCalledWith({
      and: [{ eq: ['org', 'org'] }, { eq: ['decision', 'quote'] }],
    })
    expect(m.score).toHaveBeenCalledWith({
      decisionType: 'quote',
      policyVersion: '2',
      aggregates: [aggregate],
    })
    expect(m.drift).toHaveBeenCalledWith({
      decisionType: 'quote',
      oldVersion: '1',
      newVersion: '2',
      aggregates: [aggregate],
    })
  })
  it.each(['healthy', 'warning', 'breached'])(
    'retains actual pipeline freshness status %s',
    async (status) => {
      reads(
        [
          {
            lastRunStatus: 'success',
            lastSuccessfulAuditCreatedAt: new Date('2026-01-01T00:00:00Z'),
            lastRunCompletedAt: new Date('2026-01-01T00:00:01Z'),
          },
        ],
        [],
      )
      m.freshness.mockReturnValue({ lagMs: 1000 })
      m.sla.mockReturnValue({ status })
      const { readIntelligencePipelineHealth } = await import('./intelligence-service')
      const response = await readIntelligencePipelineHealth()
      expect(response.data.healthy).toBe(status !== 'breached')
      expect(response.data.freshness).toEqual({ lagMs: 1000, status })
    },
  )
  it.each([
    { alerts: [], status: 'ok', count: 0 },
    { alerts: [{ severity: 'info' }, { severity: 'warning' }], status: 'warning', count: 1 },
    { alerts: [{ severity: 'warning' }, { severity: 'critical' }], status: 'critical', count: 1 },
  ])(
    'retains 24h alert query and severity projection $status',
    async ({ alerts, status, count }) => {
      reads(alerts)
      const { readPipelineHealth } = await import('./pipeline-health-service')
      const response = await readPipelineHealth()
      expect(response.status).toBe(status)
      expect(response.alerts).toHaveLength(count)
      expect(response.lookbackHours).toBe(24)
      expect(m.where).toHaveBeenCalledWith({
        and: [{ gte: ['created', expect.any(Date)] }, { isNull: 'resolved' }],
      })
    },
  )
})
