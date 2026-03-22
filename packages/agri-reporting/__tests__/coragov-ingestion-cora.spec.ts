import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canonicalReportSchema, SourceApp, buildCanonicalReport, EntityScope } from '../src/canonical-reporting-schema'
import {
  canonicalToCoraGovDataset,
  buildCoraGovPayload,
  coraGovDatasetSchema,
  CANONICAL_SECTIONS,
} from '../src/coragov-ingestion-contract'
import { simulateCoraGovIngestion } from '../src/coragov-ingestion-harness'

const fixtureDir = resolve(__dirname, '../../../fixtures/agri/coragov')
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'))
}

describe('CoraGov Ingestion — Cora full sections', () => {
  const fixture = loadFixture('cora-valid-full.json')

  it('full Cora fixture passes canonical schema', () => {
    expect(canonicalReportSchema.safeParse(fixture).success).toBe(true)
  })

  it('transforms to dataset with all 5 sections populated', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    expect(dataset.source_app).toBe('cora')
    expect(dataset.metrics.length).toBeGreaterThan(0)
    expect(dataset.forecasts.length).toBeGreaterThan(0)
    expect(dataset.risk_signals.length).toBeGreaterThan(0)
    expect(dataset.supply_chain_events.length).toBeGreaterThan(0)
    expect(dataset.provenance_refs.length).toBeGreaterThan(0)
    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)
  })

  it('buildCoraGovPayload returns all validated sections for full Cora', () => {
    const report = canonicalReportSchema.parse(fixture)
    const result = buildCoraGovPayload(SourceApp.CORA, [report])

    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      for (const section of CANONICAL_SECTIONS) {
        expect(result.validated_sections).toContain(section)
      }
    }
  })

  it('harness accepts full Cora payload and reports validated sections', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    const payload = {
      batch_id: 'cgov_cora_full_test',
      submitted_at: '2025-07-01T12:00:00.000Z',
      source_app: 'cora',
      datasets: [dataset],
    }

    const result = simulateCoraGovIngestion(payload)
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      expect(result.validated_sections).toContain('metrics')
      expect(result.validated_sections).toContain('forecasts')
      expect(result.validated_sections).toContain('risk_signals')
      expect(result.validated_sections).toContain('supply_chain_events')
      expect(result.validated_sections).toContain('provenance_refs')
    }
  })

  it('Cora cooperative report preserves metric values through dataset transform', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    const complianceMetric = dataset.metrics.find((m) => m.key === 'compliance_rate')
    expect(complianceMetric).toBeDefined()
    expect(complianceMetric!.value).toBe(94.2)
    expect(complianceMetric!.unit).toBe('%')
  })

  it('Cora provenance refs maintain verified status', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    for (const ref of dataset.provenance_refs) {
      expect(ref.verified).toBe(true)
    }
  })
})
