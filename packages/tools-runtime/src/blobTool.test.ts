/**
 * Unit tests for blob tool path builders.
 * These are pure functions — no I/O needed.
 */
import { describe, it, expect } from 'vitest'
import { buildExportPath, buildEvidencePath, buildAttestationPath } from './blobTool'

describe('buildExportPath', () => {
  it('constructs the correct path', () => {
    const path = buildExportPath({
      entityId: 'acme-123',
      domain: 'stripe',
      year: '2026',
      month: '02',
      subPath: 'revenue_summary/report.json',
    })
    expect(path).toBe('exports/acme-123/stripe/2026/02/revenue_summary/report.json')
  })
})

describe('buildEvidencePath', () => {
  it('constructs the correct path', () => {
    const path = buildEvidencePath({
      entityId: 'acme-123',
      periodLabel: '2026-02',
      subPath: 'payments/stripe/manifest.json',
    })
    expect(path).toBe('evidence/acme-123/month/2026-02/payments/stripe/manifest.json')
  })
})

describe('buildAttestationPath', () => {
  it('constructs the correct path with dotted actionType', () => {
    const path = buildAttestationPath({
      entityId: 'acme-123',
      year: '2026',
      month: '02',
      actionType: 'finance.generate_stripe_monthly_reports',
      runId: 'run-abc',
    })
    expect(path).toBe(
      'exports/acme-123/attestations/2026/02/finance/generate_stripe_monthly_reports/run-abc/attestation.json',
    )
  })

  it('handles actionType without dots', () => {
    const path = buildAttestationPath({
      entityId: 'acme-123',
      year: '2026',
      month: '01',
      actionType: 'simple_action',
      runId: 'run-xyz',
    })
    expect(path).toBe(
      'exports/acme-123/attestations/2026/01/simple_action/run-xyz/attestation.json',
    )
  })
})
