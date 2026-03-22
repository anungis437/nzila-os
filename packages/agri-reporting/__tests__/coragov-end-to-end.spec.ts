import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  canonicalReportSchema,
  SourceApp,
  EntityScope,
  buildCanonicalReport,
} from '../src/canonical-reporting-schema'
import {
  canonicalToCoraGovDataset,
  buildCoraGovPayload,
  coraGovDatasetSchema,
  coraGovPayloadSchema,
  CANONICAL_SECTIONS,
} from '../src/coragov-ingestion-contract'
import { simulateCoraGovIngestion, serializeForIngestion } from '../src/coragov-ingestion-harness'

const fixtureDir = resolve(__dirname, '../../../fixtures/agri/coragov')
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'))
}

describe('CoraGov End-to-End — full pipeline', () => {
  it('Cora: canonical → dataset → payload → harness round-trip', () => {
    const report = canonicalReportSchema.parse(loadFixture('cora-valid-full.json'))
    const dataset = canonicalToCoraGovDataset(report)

    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)

    const payload = {
      batch_id: 'cgov_e2e_cora',
      submitted_at: new Date().toISOString(),
      source_app: 'cora' as const,
      datasets: [dataset],
    }

    expect(coraGovPayloadSchema.safeParse(payload).success).toBe(true)

    const result = simulateCoraGovIngestion(serializeForIngestion(payload))
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      expect(result.validated_sections).toContain('metrics')
      expect(result.validated_sections).toContain('forecasts')
    }
  })

  it('Agrimo: canonical → dataset → payload → harness round-trip', () => {
    const report = canonicalReportSchema.parse(loadFixture('agrimo-valid-full.json'))
    const dataset = canonicalToCoraGovDataset(report)

    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)

    const payload = {
      batch_id: 'cgov_e2e_agrimo',
      submitted_at: new Date().toISOString(),
      source_app: 'agrimo' as const,
      datasets: [dataset],
    }

    expect(coraGovPayloadSchema.safeParse(payload).success).toBe(true)

    const result = simulateCoraGovIngestion(serializeForIngestion(payload))
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      for (const section of CANONICAL_SECTIONS) {
        expect(result.validated_sections).toContain(section)
      }
    }
  })

  it('multi-app batch: Cora + Agrimo reports in single buildCoraGovPayload', () => {
    const coraReport = buildCanonicalReport({
      org_id: 'org_multi_cora',
      source_app: SourceApp.CORA,
      report_type: 'cooperative_summary',
      title: 'Multi-app Cora',
      entity_scope: EntityScope.COOPERATIVE,
      reporting_period: { start: '2025-01-01T00:00:00.000Z', end: '2025-06-30T23:59:59.000Z' },
      metrics: [{ key: 'score', label: 'Score', value: 88, unit: 'index', period: 'H1' }],
      provenance_refs: [{ provenance_id: 'prov_mc', source_type: 'audit', hash: 'sha256:mc1', verified: true }],
    })

    const agrimoReport = buildCanonicalReport({
      org_id: 'org_multi_agrimo',
      source_app: SourceApp.AGRIMO,
      report_type: 'farm_summary',
      title: 'Multi-app Agrimo',
      entity_scope: EntityScope.FARM,
      reporting_period: { start: '2025-01-01T00:00:00.000Z', end: '2025-06-30T23:59:59.000Z' },
      metrics: [{ key: 'yield', label: 'Yield', value: 9000, unit: 'kg', period: 'H1' }],
      forecasts: [{ forecast_type: 'yield', target_period: 'H2-2025', predicted_value: 11000, confidence_level: 'high' }],
    })

    // Note: both have source_app set individually in canonical — the top-level sourceApp is the submitter
    const result = buildCoraGovPayload(SourceApp.CORA, [coraReport, agrimoReport])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(2)
      expect(result.validated_sections).toContain('metrics')
      expect(result.validated_sections).toContain('provenance_refs')
      expect(result.validated_sections).toContain('forecasts')
    }
  })

  it('serializeForIngestion round-trips payload correctly', () => {
    const report = canonicalReportSchema.parse(loadFixture('agrimo-valid-full.json'))
    const dataset = canonicalToCoraGovDataset(report)

    const payload = {
      batch_id: 'cgov_serial_test',
      submitted_at: '2025-07-01T12:00:00.000Z',
      source_app: 'agrimo' as const,
      datasets: [dataset],
    }

    const serialized = serializeForIngestion(payload)
    const result = simulateCoraGovIngestion(serialized)
    expect(result.accepted).toBe(true)
  })

  it('all 6 fixtures load and can be classified as valid or invalid', () => {
    const validFixtures = ['cora-valid.json', 'agrimo-valid.json', 'cora-valid-full.json', 'agrimo-valid-full.json']
    const invalidFixtures = ['invalid-source.json', 'malformed-payload.json', 'invalid-missing-provenance.json', 'invalid-schema-drift.json']

    for (const name of validFixtures) {
      const fixture = loadFixture(name)
      expect(canonicalReportSchema.safeParse(fixture).success).toBe(true)
    }

    for (const name of invalidFixtures) {
      const fixture = loadFixture(name)
      expect(canonicalReportSchema.safeParse(fixture).success).toBe(false)
    }
  })

  it('validated_sections is empty for report with no section data', () => {
    const emptyReport = buildCanonicalReport({
      org_id: 'org_e2e_empty',
      source_app: SourceApp.CORA,
      report_type: 'placeholder',
      title: 'Empty sections',
      entity_scope: EntityScope.NATIONAL,
      reporting_period: { start: '2025-01-01T00:00:00.000Z', end: '2025-12-31T23:59:59.000Z' },
    })

    const result = buildCoraGovPayload(SourceApp.CORA, [emptyReport])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.validated_sections).toHaveLength(0)
    }
  })
})
