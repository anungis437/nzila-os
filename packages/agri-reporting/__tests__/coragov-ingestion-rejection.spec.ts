import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { canonicalReportSchema, SourceApp } from '../src/canonical-reporting-schema'
import { buildCoraGovPayload } from '../src/coragov-ingestion-contract'
import { simulateCoraGovIngestion } from '../src/coragov-ingestion-harness'

const fixtureDir = resolve(__dirname, '../../../fixtures/agri/coragov')
function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(resolve(fixtureDir, name), 'utf-8'))
}

describe('CoraGov Ingestion — rejection scenarios', () => {
  it('rejects invalid source_app fixture', () => {
    const fixture = loadFixture('invalid-source.json')
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })

  it('rejects malformed payload fixture', () => {
    const fixture = loadFixture('malformed-payload.json')
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
  })

  it('rejects fixture with invalid provenance (empty provenance_id)', () => {
    const fixture = loadFixture('invalid-missing-provenance.json')
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
    if (!result.success) {
      const provenancePaths = result.error.issues
        .map((i) => i.path.join('.'))
        .filter((p) => p.includes('provenance'))
      expect(provenancePaths.length).toBeGreaterThan(0)
    }
  })

  it('rejects fixture with schema drift (wrong version, bad enums)', () => {
    const fixture = loadFixture('invalid-schema-drift.json')
    const result = canonicalReportSchema.safeParse(fixture)
    expect(result.success).toBe(false)
    if (!result.success) {
      // Should have errors for schema_version, forecast confidence, risk severity, supply chain timestamp, provenance verified
      expect(result.error.issues.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('buildCoraGovPayload rejects empty reports array', () => {
    const result = buildCoraGovPayload(SourceApp.CORA, [])
    expect(result.accepted).toBe(false)
    if (!result.accepted) {
      expect(result.reason).toContain('No reports')
    }
  })

  it('buildCoraGovPayload rejects reports failing canonical validation', () => {
    const badReport = { report_id: '', metrics: [] } as unknown
    const result = buildCoraGovPayload(SourceApp.CORA, [badReport as any])
    expect(result.accepted).toBe(false)
    if (!result.accepted) {
      expect(result.errors).toBeDefined()
      expect(result.errors!.length).toBeGreaterThan(0)
    }
  })

  it('harness rejects payload with missing datasets array', () => {
    const result = simulateCoraGovIngestion({
      batch_id: 'cgov_bad_1',
      submitted_at: '2025-01-01T00:00:00.000Z',
      source_app: 'cora',
    })
    expect(result.accepted).toBe(false)
    if (!result.accepted) {
      expect(result.reason).toBe('Payload validation failed')
    }
  })

  it('harness rejects payload with empty datasets', () => {
    const result = simulateCoraGovIngestion({
      batch_id: 'cgov_empty',
      submitted_at: '2025-01-01T00:00:00.000Z',
      source_app: 'cora',
      datasets: [],
    })
    expect(result.accepted).toBe(false)
  })

  it('harness rejects null input', () => {
    const result = simulateCoraGovIngestion(null)
    expect(result.accepted).toBe(false)
  })

  it('harness rejects undefined input', () => {
    const result = simulateCoraGovIngestion(undefined)
    expect(result.accepted).toBe(false)
  })
})
