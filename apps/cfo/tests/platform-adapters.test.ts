/**
 * CFO — Platform Adapters Unit Tests
 *
 * Tests the four platform contract adapter implementations:
 *   - healthAdapter  (HealthContract)
 *   - metricsAdapter (MetricsContract)
 *   - governanceAdapter (GovernanceContract)
 *   - evidenceAdapter (EvidenceContract)
 *
 * All external dependencies (db, platformDb, logger) are mocked.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mocks ───────────────────────────────────────────────────────────────────

vi.mock('@nzila/db', () => ({}))

vi.mock('@nzila/db/platform', () => ({
  platformDb: { execute: vi.fn() },
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}))

import { platformDb } from '@nzila/db/platform'

// ── Import adapters ─────────────────────────────────────────────────────────
import { healthAdapter } from '@/lib/platform-adapters/health-adapter'
import { metricsAdapter } from '@/lib/platform-adapters/metrics-adapter'
import { governanceAdapter } from '@/lib/platform-adapters/governance-adapter'
import { evidenceAdapter } from '@/lib/platform-adapters/evidence-adapter'

beforeEach(() => {
  vi.clearAllMocks()
})

// ═══════════════════════════════════════════════════════════════════════════
// Health Adapter
// ═══════════════════════════════════════════════════════════════════════════

describe('healthAdapter', () => {
  it('implements HealthContract.check()', () => {
    expect(typeof healthAdapter.check).toBe('function')
  })

  it('returns healthy when database responds', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([] as never)

    const result = await healthAdapter.check()

    expect(result.app).toBe('cfo')
    expect(result.status).toBe('healthy')
    expect(typeof result.version).toBe('string')
    expect(typeof result.timestamp).toBe('string')
    expect(typeof result.uptime_seconds).toBe('number')
    expect(result.uptime_seconds).toBeGreaterThanOrEqual(0)
    expect(result.components).toHaveLength(1)
    expect(result.components[0].name).toBe('database')
    expect(result.components[0].status).toBe('healthy')
    expect(result.components[0].latency_ms).toBeGreaterThanOrEqual(0)
  })

  it('returns unhealthy when database fails', async () => {
    vi.mocked(platformDb.execute).mockRejectedValue(new Error('ECONNREFUSED'))

    const result = await healthAdapter.check()

    expect(result.status).toBe('unhealthy')
    expect(result.components[0].status).toBe('unhealthy')
    expect(result.components[0].message).toContain('ECONNREFUSED')
  })

  it('always returns HealthResponse shape', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([] as never)

    const result = await healthAdapter.check()

    // Validate every required field
    expect(result).toMatchObject({
      status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
      app: expect.any(String),
      version: expect.any(String),
      timestamp: expect.any(String),
      uptime_seconds: expect.any(Number),
      components: expect.any(Array),
    })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Metrics Adapter
// ═══════════════════════════════════════════════════════════════════════════

describe('metricsAdapter', () => {
  const ORG = 'org_test_123'

  it('implements MetricsContract.collect()', () => {
    expect(typeof metricsAdapter.collect).toBe('function')
  })

  it('returns MetricsSummary shape with entries', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ status: 'published', cnt: 5 }] as never)   // reports by status
      .mockResolvedValueOnce([{ cnt: 42 }] as never)                        // ledger mutations
      .mockResolvedValueOnce([{ cnt: 7 }] as never)                         // advisory alerts

    const result = await metricsAdapter.collect(ORG)

    expect(result.app).toBe('cfo')
    expect(result.org_id).toBe(ORG)
    expect(typeof result.period_start).toBe('string')
    expect(typeof result.period_end).toBe('string')
    expect(result.entries.length).toBeGreaterThanOrEqual(3)

    // Validate entry shapes
    for (const entry of result.entries) {
      expect(entry).toMatchObject({
        name: expect.any(String),
        type: expect.stringMatching(/^(counter|gauge|histogram)$/),
        value: expect.any(Number),
        labels: expect.any(Object),
        timestamp: expect.any(String),
      })
    }
  })

  it('includes report status metric', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ status: 'draft', cnt: 3 }] as never)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)

    const result = await metricsAdapter.collect(ORG)

    const reportMetric = result.entries.find(
      (e) => e.name === 'cfo.reports.by_status',
    )
    expect(reportMetric).toBeDefined()
    expect(reportMetric!.value).toBe(3)
    expect(reportMetric!.labels).toHaveProperty('status', 'draft')
  })

  it('includes ledger mutation metric', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ cnt: 100 }] as never)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)

    const result = await metricsAdapter.collect(ORG)

    const ledgerMetric = result.entries.find(
      (e) => e.name === 'cfo.ledger.mutations_30d',
    )
    expect(ledgerMetric).toBeDefined()
    expect(ledgerMetric!.value).toBe(100)
  })

  it('includes advisory alert metric', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)
      .mockResolvedValueOnce([{ cnt: 15 }] as never)

    const result = await metricsAdapter.collect(ORG)

    const alertMetric = result.entries.find(
      (e) => e.name === 'cfo.advisory.alerts_30d',
    )
    expect(alertMetric).toBeDefined()
    expect(alertMetric!.value).toBe(15)
  })

  it('returns empty entries on DB error without throwing', async () => {
    vi.mocked(platformDb.execute).mockRejectedValue(new Error('DB down'))

    const result = await metricsAdapter.collect(ORG)

    expect(result.app).toBe('cfo')
    expect(result.org_id).toBe(ORG)
    expect(result.entries).toEqual([])
  })

  it('handles null count gracefully', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([] as never)
      .mockResolvedValueOnce([{ cnt: null }] as never)
      .mockResolvedValueOnce([{ cnt: null }] as never)

    const result = await metricsAdapter.collect(ORG)

    const ledger = result.entries.find((e) => e.name === 'cfo.ledger.mutations_30d')
    expect(ledger?.value).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Governance Adapter
// ═══════════════════════════════════════════════════════════════════════════

describe('governanceAdapter', () => {
  const ORG = 'org_gov_456'

  it('implements GovernanceContract.evaluate()', () => {
    expect(typeof governanceAdapter.evaluate).toBe('function')
  })

  it('returns GovernanceTelemetry shape', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)   // unreviewed reports
      .mockResolvedValueOnce([{ cnt: 10 }] as never)   // financial exports

    const result = await governanceAdapter.evaluate(ORG)

    expect(result.app).toBe('cfo')
    expect(result.org_id).toBe(ORG)
    expect(typeof result.generated_at).toBe('string')
    expect(result.overall_result).toMatch(/^(pass|fail|warn|skip)$/)
    expect(result.checks.length).toBeGreaterThanOrEqual(3)

    for (const check of result.checks) {
      expect(check).toMatchObject({
        check_id: expect.any(String),
        name: expect.any(String),
        result: expect.stringMatching(/^(pass|fail|warn|skip)$/),
        timestamp: expect.any(String),
      })
    }
  })

  it('returns pass overall when all checks pass', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)   // 0 unreviewed → pass
      .mockResolvedValueOnce([{ cnt: 5 }] as never)    // some exports → pass

    const result = await governanceAdapter.evaluate(ORG)

    expect(result.overall_result).toBe('pass')
    expect(result.checks.every((c) => c.result === 'pass')).toBe(true)
  })

  it('returns warn when unreviewed published reports exist', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ cnt: 3 }] as never)   // 3 unreviewed → warn
      .mockResolvedValueOnce([{ cnt: 5 }] as never)

    const result = await governanceAdapter.evaluate(ORG)

    expect(result.overall_result).toBe('warn')
    const unreviewedCheck = result.checks.find(
      (c) => c.name === 'no_unreviewed_published_reports',
    )
    expect(unreviewedCheck?.result).toBe('warn')
  })

  it('includes policy_enforcement_active check', async () => {
    vi.mocked(platformDb.execute)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)
      .mockResolvedValueOnce([{ cnt: 0 }] as never)

    const result = await governanceAdapter.evaluate(ORG)

    const policyCheck = result.checks.find(
      (c) => c.name === 'policy_enforcement_active',
    )
    expect(policyCheck).toBeDefined()
    expect(policyCheck!.result).toBe('pass')
  })

  it('skips checks when DB query fails', async () => {
    vi.mocked(platformDb.execute)
      .mockRejectedValueOnce(new Error('query error'))
      .mockRejectedValueOnce(new Error('query error'))

    const result = await governanceAdapter.evaluate(ORG)

    const skipped = result.checks.filter((c) => c.result === 'skip')
    expect(skipped.length).toBeGreaterThan(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Evidence Adapter
// ═══════════════════════════════════════════════════════════════════════════

describe('evidenceAdapter', () => {
  const ORG = 'org_evidence_789'
  const FROM = '2024-01-01'
  const TO = '2024-12-31'

  it('implements EvidenceContract.export()', () => {
    expect(typeof evidenceAdapter.export).toBe('function')
  })

  it('returns EvidenceExport shape', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([
      { id: '1', action: 'report.generated', created_at: '2024-06-15' },
    ] as never)

    const result = await evidenceAdapter.export(ORG, FROM, TO)

    expect(result.app).toBe('cfo')
    expect(result.org_id).toBe(ORG)
    expect(typeof result.export_id).toBe('string')
    expect(typeof result.chain_hash).toBe('string')
    expect(result.chain_hash).toHaveLength(64) // SHA-256 hex
    expect(typeof result.exported_at).toBe('string')
    expect(result.artifacts.length).toBeGreaterThanOrEqual(1)
  })

  it('creates domain_event_log artifact', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([
      { id: '1', action: 'ledger.entry', created_at: '2024-03-01' },
      { id: '2', action: 'report.generated', created_at: '2024-03-02' },
    ] as never)

    const result = await evidenceAdapter.export(ORG, FROM, TO)

    const eventLog = result.artifacts.find(
      (a) => a.type === 'domain_event_log',
    )
    expect(eventLog).toBeDefined()
    expect(eventLog!.format).toBe('json')
    expect(eventLog!.size_bytes).toBeGreaterThan(0)
    expect(eventLog!.hash).toHaveLength(64)
    expect(typeof eventLog!.artifact_id).toBe('string')
    expect(typeof eventLog!.generated_at).toBe('string')
  })

  it('produces deterministic hash for same data', async () => {
    const events = [{ id: '1', action: 'test', created_at: '2024-01-01' }]
    vi.mocked(platformDb.execute).mockResolvedValue(events as never)

    const r1 = await evidenceAdapter.export(ORG, FROM, TO)

    vi.mocked(platformDb.execute).mockResolvedValue(events as never)

    const r2 = await evidenceAdapter.export(ORG, FROM, TO)

    // Same data → same content hash on artifact
    expect(r1.artifacts[0].hash).toBe(r2.artifacts[0].hash)
  })

  it('handles empty event log', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([] as never)

    const result = await evidenceAdapter.export(ORG, FROM, TO)

    expect(result.artifacts.length).toBeGreaterThanOrEqual(1)
    expect(result.artifacts[0].size_bytes).toBeGreaterThan(0) // '[]' still has bytes
  })

  it('chain_hash covers all artifact hashes', async () => {
    vi.mocked(platformDb.execute).mockResolvedValue([
      { id: '1', action: 'test' },
    ] as never)

    const result = await evidenceAdapter.export(ORG, FROM, TO)

    // chain_hash is SHA-256 of all artifact hashes joined by '|'
    expect(result.chain_hash).toHaveLength(64)
    expect(result.chain_hash).not.toBe(result.artifacts[0].hash) // different from individual
  })
})
