import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canonicalReportSchema, SourceApp } from '../src/canonical-reporting-schema'
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

describe('CoraGov Ingestion — Agrimo full sections', () => {
  const fixture = loadFixture('agrimo-valid-full.json')

  it('full Agrimo fixture passes canonical schema', () => {
    expect(canonicalReportSchema.safeParse(fixture).success).toBe(true)
  })

  it('transforms to dataset with all 5 sections populated', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    expect(dataset.source_app).toBe('agrimo')
    expect(dataset.metrics.length).toBeGreaterThan(0)
    expect(dataset.forecasts.length).toBeGreaterThan(0)
    expect(dataset.risk_signals.length).toBeGreaterThan(0)
    expect(dataset.supply_chain_events.length).toBeGreaterThan(0)
    expect(dataset.provenance_refs.length).toBeGreaterThan(0)
    expect(coraGovDatasetSchema.safeParse(dataset).success).toBe(true)
  })

  it('buildCoraGovPayload returns all validated sections for full Agrimo', () => {
    const report = canonicalReportSchema.parse(fixture)
    const result = buildCoraGovPayload(SourceApp.AGRIMO, [report])

    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(1)
      for (const section of CANONICAL_SECTIONS) {
        expect(result.validated_sections).toContain(section)
      }
    }
  })

  it('harness accepts full Agrimo payload and reports validated sections', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    const payload = {
      batch_id: 'cgov_agrimo_full_test',
      submitted_at: '2025-07-01T09:00:00.000Z',
      source_app: 'agrimo',
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

  it('Agrimo supply chain events preserve quantity and location', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    const harvest = dataset.supply_chain_events.find((e) => e.step_type === 'harvest')
    expect(harvest).toBeDefined()
    expect(harvest!.quantity_kg).toBe(8000)
    expect(harvest!.location).toBe('Central Province')
  })

  it('Agrimo forecasts preserve confidence levels', () => {
    const report = canonicalReportSchema.parse(fixture)
    const dataset = canonicalToCoraGovDataset(report)

    const yieldForecast = dataset.forecasts.find((f) => f.forecast_type === 'yield')
    expect(yieldForecast).toBeDefined()
    expect(yieldForecast!.confidence_level).toBe('medium')
    expect(yieldForecast!.predicted_value).toBe(21000)
  })

  it('multi-report batch combines validated sections', () => {
    const report1 = canonicalReportSchema.parse(fixture)
    const report2 = canonicalReportSchema.parse(loadFixture('agrimo-valid.json'))

    const result = buildCoraGovPayload(SourceApp.AGRIMO, [report1, report2])
    expect(result.accepted).toBe(true)
    if (result.accepted) {
      expect(result.dataset_count).toBe(2)
    }
  })
})
