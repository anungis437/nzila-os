import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canonicalReportSchema,
  CANONICAL_SCHEMA_VERSION,
  SourceApp,
  EntityScope,
  buildCanonicalReport,
} from '../src/canonical-reporting-schema'
import {
  canonicalToCoraGovRows,
  canonicalToCoraGovDataset,
  buildCoraGovPayload,
  coraGovRowSchema,
  coraGovDatasetSchema,
  coraGovPayloadSchema,
  CANONICAL_SECTIONS,
} from '../src/coragov-ingestion-contract'
import { simulateCoraGovIngestion } from '../src/coragov-ingestion-harness'

// ── Fixture helpers ─────────────────────────────────────────────────────────

const fixtureDir = resolve(__dirname, '../../../fixtures/agri/coragov')

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'))
}

// ── Row transformation (legacy) ─────────────────────────────────────────────

describe('canonicalToCoraGovRows', () => {
  it('transforms a canonical report into CoraGov rows', () => {
    const report = buildCanonicalReport({
      org_id: 'org_t1',
      source_app: SourceApp.CORA,
      report_type: 'cooperative_summary',
      title: 'T1',
      entity_scope: EntityScope.COOPERATIVE,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-03-31T23:59:59.000Z',
      },
      metrics: [
        { key: 'yield', label: 'Yield', value: 5000, unit: 'kg', period: 'Q1' },
        { key: 'revenue', label: 'Revenue', value: 15000, unit: 'USD', period: 'Q1' },
      ],
    })

    const rows = canonicalToCoraGovRows(report)
    expect(rows).toHaveLength(2)
    expect(rows[0].org_id).toBe('org_t1')
    expect(rows[0].source_app).toBe('cora')
    expect(rows[0].metric_key).toBe('yield')
    expect(rows[1].metric_key).toBe('revenue')

    // Each row should validate against the row schema
    for (const row of rows) {
      expect(coraGovRowSchema.safeParse(row).success).toBe(true)
    }
  })

  it('produces zero rows for a report with no metrics', () => {
    const report = buildCanonicalReport({
      org_id: 'org_empty',
      source_app: SourceApp.AGRIMO,
      report_type: 'farm_summary',
      title: 'Empty',
      entity_scope: EntityScope.FARM,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-12-31T23:59:59.000Z',
      },
    })
    expect(canonicalToCoraGovRows(report)).toHaveLength(0)
  })
})

// ── Dataset transformation (full) ───────────────────────────────────────────

describe('canonicalToCoraGovDataset', () => {
  it('transforms a full canonical report into a CoraGov dataset', () => {
    const report = buildCanonicalReport({
      org_id: 'org_ds1',
      source_app: SourceApp.AGRIMO,
      report_type: 'farm_summary',
      title: 'DS1',
      entity_scope: EntityScope.FARM,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-06-30T23:59:59.000Z',
      },
      metrics: [
        { key: 'yield', label: 'Yield', value: 12000, unit: 'kg', period: 'H1' },
      ],
      forecasts: [
        { forecast_type: 'yield', target_period: 'H2-2025', predicted_value: 14000, confidence_level: 'medium' },
      ],
      risk_signals: [
        { risk_type: 'drought', severity: 'high', description: 'Low rainfall' },
      ],
      supply_chain_events: [
        { chain_id: 'sc_1', step_type: 'harvest', status: 'completed', timestamp: '2025-06-15T06:00:00.000Z' },
      ],
      provenance_refs: [
        { provenance_id: 'prov_1', source_type: 'satellite', hash: 'sha256:abc', verified: true },
      ],
    })

    const dataset = canonicalToCoraGovDataset(report)
    expect(dataset.org_id).toBe('org_ds1')
    expect(dataset.source_app).toBe('agrimo')
    expect(dataset.metrics).toHaveLength(1)
    expect(dataset.forecasts).toHaveLength(1)
    expect(dataset.risk_signals).toHaveLength(1)
    expect(dataset.supply_chain_events).toHaveLength(1)
    expect(dataset.provenance_refs).toHaveLength(1)
    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)
  })

  it('produces empty arrays for missing optional sections', () => {
    const report = buildCanonicalReport({
      org_id: 'org_ds2',
      source_app: SourceApp.CORA,
      report_type: 'risk_assessment',
      title: 'DS2',
      entity_scope: EntityScope.NATIONAL,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-12-31T23:59:59.000Z',
      },
    })
    const dataset = canonicalToCoraGovDataset(report)
    expect(dataset.metrics).toHaveLength(0)
    expect(dataset.forecasts).toHaveLength(0)
    expect(dataset.risk_signals).toHaveLength(0)
    expect(dataset.supply_chain_events).toHaveLength(0)
    expect(dataset.provenance_refs).toHaveLength(0)
  })
})

// ── buildCoraGovPayload ─────────────────────────────────────────────────────

describe('buildCoraGovPayload', () => {
  it('builds an accepted payload from Cora reports', () => {
    const report = buildCanonicalReport({
      org_id: 'org_bp1',
      source_app: SourceApp.CORA,
      report_type: 'cooperative_summary',
      title: 'BP1',
      entity_scope: EntityScope.COOPERATIVE,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-03-31T23:59:59.000Z',
      },
      metrics: [
        { key: 'score', label: 'Score', value: 85, unit: 'index', period: 'Q1' },
      ],
    })

    const result = buildCoraGovPayload(SourceApp.CORA, [report])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.batch_id).toMatch(/^cgov_/)
      expect(result.dataset_count).toBe(1)
      expect(result.validated_sections).toContain('metrics')
    }
  })

  it('builds an accepted payload from Agrimo reports', () => {
    const report = buildCanonicalReport({
      org_id: 'org_bp2',
      source_app: SourceApp.AGRIMO,
      report_type: 'farm_summary',
      title: 'BP2',
      entity_scope: EntityScope.FARM,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-06-30T23:59:59.000Z',
      },
      metrics: [
        { key: 'yield', label: 'Yield', value: 12000, unit: 'kg', period: 'H1' },
        { key: 'cost', label: 'Cost', value: 3200, unit: 'USD', period: 'H1' },
      ],
    })

    const result = buildCoraGovPayload(SourceApp.AGRIMO, [report])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
    }
  })

  it('rejects empty reports array', () => {
    const result = buildCoraGovPayload(SourceApp.CORA, [])
    expect(result.accepted).toBe(false)
  })

  it('accepts reports with no metrics but valid schema (empty dataset)', () => {
    const report = buildCanonicalReport({
      org_id: 'org_none',
      source_app: SourceApp.CORA,
      report_type: 'risk_assessment',
      title: 'No metrics',
      entity_scope: EntityScope.NATIONAL,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-12-31T23:59:59.000Z',
      },
    })
    const result = buildCoraGovPayload(SourceApp.CORA, [report])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.validated_sections).toHaveLength(0)
    }
  })
})

// ── Harness simulation ──────────────────────────────────────────────────────

describe('simulateCoraGovIngestion', () => {
  it('accepts a valid CoraGov dataset payload', () => {
    const payload = {
      batch_id: 'cgov_test_1',
      submitted_at: '2025-04-01T12:00:00.000Z',
      source_app: 'cora',
      datasets: [
        {
          org_id: 'org_h1',
          source_app: 'cora',
          report_id: 'crpt_h1',
          report_type: 'cooperative_summary',
          period_start: '2025-01-01T00:00:00.000Z',
          period_end: '2025-03-31T23:59:59.000Z',
          entity_scope: 'cooperative',
          generated_at: '2025-04-01T10:00:00.000Z',
          schema_version: '1.0.0',
          metrics: [
            { key: 'compliance', label: 'Compliance Rate', value: 95.0, unit: '%', period: 'Q1-2025' },
          ],
          forecasts: [],
          risk_signals: [],
          supply_chain_events: [],
          provenance_refs: [],
        },
      ],
    }
    const result = simulateCoraGovIngestion(payload)
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      expect(result.validated_sections).toContain('metrics')
    }
  })

  it('rejects a payload with missing datasets', () => {
    const result = simulateCoraGovIngestion({ batch_id: 'cgov_bad' })
    expect(result.accepted).toBe(false)
  })

  it('rejects null', () => {
    const result = simulateCoraGovIngestion(null)
    expect(result.accepted).toBe(false)
  })
})

// ── Fixture-based tests ─────────────────────────────────────────────────────

describe('coragov-ingestion — fixture: Cora valid', () => {
  const fixture = loadFixture('cora-valid.json')

  it('fixture passes canonical schema validation', () => {
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('transforms to CoraGov rows (legacy)', () => {
    const report = canonicalReportSchema.parse(fixture)
    const rows = canonicalToCoraGovRows(report)
    expect(rows.length).toBeGreaterThan(0)
    expect(rows[0].source_app).toBe('cora')
  })

  it('transforms to CoraGov dataset (full)', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)
    expect(dataset.source_app).toBe('cora')
    expect(dataset.metrics).toHaveLength(2)
    expect(dataset.risk_signals).toHaveLength(1)
    expect(dataset.provenance_refs).toHaveLength(1)
    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)
  })
})

describe('coragov-ingestion — fixture: Agrimo valid', () => {
  const fixture = loadFixture('agrimo-valid.json')

  it('fixture passes canonical schema validation', () => {
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(true)
  })

  it('transforms to CoraGov rows with correct metrics (legacy)', () => {
    const report = canonicalReportSchema.parse(fixture)
    const rows = canonicalToCoraGovRows(report)
    expect(rows).toHaveLength(3) // yield_kg, revenue_usd, cost_per_ha
    expect(rows[0].source_app).toBe('agrimo')
  })

  it('transforms to CoraGov dataset preserving all sections', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)
    expect(dataset.source_app).toBe('agrimo')
    expect(dataset.metrics).toHaveLength(3)
    expect(dataset.forecasts).toHaveLength(1)
    expect(dataset.risk_signals).toHaveLength(1)
    expect(dataset.supply_chain_events).toHaveLength(1)
    expect(dataset.provenance_refs).toHaveLength(1)
    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)
  })
})

describe('coragov-ingestion — fixture: invalid source', () => {
  const fixture = loadFixture('invalid-source.json')

  it('fixture is rejected by canonical schema', () => {
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })
})

describe('coragov-ingestion — fixture: malformed payload', () => {
  const fixture = loadFixture('malformed-payload.json')

  it('fixture is rejected by canonical schema', () => {
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })

  it('harness rejects malformed data', () => {
    const result = simulateCoraGovIngestion({
      batch_id: 'cgov_malformed',
      submitted_at: 'not-a-date',
      source_app: 'cora',
      datasets: [fixture],
    })
    expect(result.accepted).toBe(false)
  })
})
