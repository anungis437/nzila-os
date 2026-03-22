import { describe, it, expect } from 'vitest'
import {
  canonicalReportSchema,
  CANONICAL_SCHEMA_VERSION,
  SourceApp,
  EntityScope,
  buildCanonicalReport,
  type CanonicalReport,
} from '../src/canonical-reporting-schema'
import { validateCanonicalReport } from '../src/validate-canonical-report'

// ── Fixtures ────────────────────────────────────────────────────────────────

const coraPayload = {
  report_id: 'crpt_test_cora_1',
  org_id: 'org_cora_001',
  source_app: SourceApp.CORA,
  schema_version: CANONICAL_SCHEMA_VERSION,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-03-31T23:59:59.000Z',
  },
  entity_scope: EntityScope.COOPERATIVE,
  report_type: 'cooperative_summary',
  title: 'Cora Q1 Cooperative Summary',
  generated_at: '2025-04-01T10:00:00.000Z',
  metrics: [
    { key: 'compliance_rate', label: 'Compliance Rate', value: 92.5, unit: '%', period: 'Q1-2025' },
  ],
  forecasts: [],
  risk_signals: [],
  supply_chain_events: [],
  provenance_refs: [],
  extensions: { cora: { governance_tier: 'A' } },
}

const agrimoPayload = {
  report_id: 'crpt_test_agrimo_1',
  org_id: 'org_agrimo_001',
  source_app: SourceApp.AGRIMO,
  schema_version: CANONICAL_SCHEMA_VERSION,
  reporting_period: {
    start: '2025-01-01T00:00:00.000Z',
    end: '2025-06-30T23:59:59.000Z',
  },
  entity_scope: EntityScope.FARM,
  report_type: 'farm_summary',
  title: 'Agrimo H1 Farm Summary',
  generated_at: '2025-07-01T10:00:00.000Z',
  metrics: [
    { key: 'yield_kg', label: 'Yield', value: 12000, unit: 'kg', period: 'H1-2025' },
    { key: 'revenue_usd', label: 'Revenue', value: 36000, unit: 'USD', period: 'H1-2025' },
  ],
  forecasts: [
    {
      forecast_type: 'yield',
      target_period: 'H2-2025',
      predicted_value: 14000,
      confidence_level: 'high' as const,
    },
  ],
  risk_signals: [
    {
      risk_type: 'pest_outbreak',
      severity: 'medium' as const,
      description: 'Fall armyworm risk elevated in southern region',
    },
  ],
  supply_chain_events: [],
  provenance_refs: [
    {
      provenance_id: 'prov_ag_001',
      source_type: 'satellite_analysis',
      hash: 'sha256:def456',
      verified: true,
    },
  ],
  extensions: { agrimo: { crop_type: 'maize' } },
}

// ── Cora-sourced reports ────────────────────────────────────────────────────

describe('canonical-reporting — Cora', () => {
  it('parses a valid Cora report', () => {
    const result = canonicalReportSchema.safeParse(coraPayload)
    expect(result.success).toBe(true)
  })

  it('validates a Cora report via validateCanonicalReport', () => {
    const result = validateCanonicalReport(coraPayload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.source_app).toBe('cora')
      expect(result.data.extensions?.cora).toEqual({ governance_tier: 'A' })
    }
  })

  it('preserves Cora metrics through validation', () => {
    const result = validateCanonicalReport(coraPayload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.metrics).toHaveLength(1)
      expect(result.data.metrics[0].key).toBe('compliance_rate')
    }
  })
})

// ── Agrimo-sourced reports ──────────────────────────────────────────────────

describe('canonical-reporting — Agrimo', () => {
  it('parses a valid Agrimo report', () => {
    const result = canonicalReportSchema.safeParse(agrimoPayload)
    expect(result.success).toBe(true)
  })

  it('validates an Agrimo report with forecasts and risk signals', () => {
    const result = validateCanonicalReport(agrimoPayload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.source_app).toBe('agrimo')
      expect(result.data.forecasts).toHaveLength(1)
      expect(result.data.risk_signals).toHaveLength(1)
      expect(result.data.provenance_refs).toHaveLength(1)
    }
  })

  it('preserves Agrimo extensions', () => {
    const result = validateCanonicalReport(agrimoPayload)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.extensions?.agrimo).toEqual({ crop_type: 'maize' })
    }
  })
})

// ── Cross-app compatibility ─────────────────────────────────────────────────

describe('canonical-reporting — cross-app compat', () => {
  it('both Cora and Agrimo share the same schema version', () => {
    const cora = canonicalReportSchema.parse(coraPayload)
    const agrimo = canonicalReportSchema.parse(agrimoPayload)
    expect(cora.schema_version).toBe(agrimo.schema_version)
    expect(cora.schema_version).toBe(CANONICAL_SCHEMA_VERSION)
  })

  it('rejects unknown source_app', () => {
    const bad = { ...coraPayload, source_app: 'pondu' }
    const result = validateCanonicalReport(bad)
    expect(result.ok).toBe(false)
  })

  it('rejects wrong schema_version', () => {
    const bad = { ...coraPayload, schema_version: '99.0.0' }
    const result = validateCanonicalReport(bad)
    expect(result.ok).toBe(false)
  })

  it('rejects unknown extension namespace', () => {
    const bad = { ...coraPayload, extensions: { cora: {}, unknown_app: {} } }
    const result = validateCanonicalReport(bad)
    expect(result.ok).toBe(false)
  })

  it('accepts report with no optional sections', () => {
    const minimal = {
      report_id: 'crpt_minimal',
      org_id: 'org_min',
      source_app: SourceApp.CORA,
      schema_version: CANONICAL_SCHEMA_VERSION,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-12-31T23:59:59.000Z',
      },
      entity_scope: EntityScope.NATIONAL,
      report_type: 'annual_summary',
      title: 'Annual Summary',
      generated_at: '2026-01-01T00:00:00.000Z',
    }
    const result = validateCanonicalReport(minimal)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.metrics).toEqual([])
      expect(result.data.forecasts).toEqual([])
    }
  })

  it('returns structured errors on invalid payload', () => {
    const result = validateCanonicalReport({ report_id: 123 })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toHaveProperty('path')
      expect(result.errors[0]).toHaveProperty('message')
    }
  })
})

// ── Builder helper ──────────────────────────────────────────────────────────

describe('buildCanonicalReport', () => {
  it('builds a valid canonical report', () => {
    const report = buildCanonicalReport({
      org_id: 'org_test',
      source_app: SourceApp.CORA,
      report_type: 'risk_assessment',
      title: 'Risk Assessment Q2',
      entity_scope: EntityScope.REGION,
      reporting_period: {
        start: '2025-04-01T00:00:00.000Z',
        end: '2025-06-30T23:59:59.000Z',
      },
      metrics: [
        { key: 'risk_score', label: 'Risk Score', value: 7.2, unit: 'index', period: 'Q2-2025' },
      ],
    })
    expect(report.report_id).toMatch(/^crpt_/)
    expect(report.schema_version).toBe(CANONICAL_SCHEMA_VERSION)
    const result = canonicalReportSchema.safeParse(report)
    expect(result.success).toBe(true)
  })

  it('round-trips through validation', () => {
    const report = buildCanonicalReport({
      org_id: 'org_rt',
      source_app: SourceApp.AGRIMO,
      report_type: 'farm_summary',
      title: 'RT Test',
      entity_scope: EntityScope.FARM,
      reporting_period: {
        start: '2025-01-01T00:00:00.000Z',
        end: '2025-12-31T23:59:59.000Z',
      },
    })
    const result = validateCanonicalReport(report)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.org_id).toBe('org_rt')
    }
  })
})
