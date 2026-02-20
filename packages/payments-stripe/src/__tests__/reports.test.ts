import { describe, it, expect, vi } from 'vitest'

// Mock DB and Blob to avoid requiring DATABASE_URL at import time
vi.mock('@nzila/db', () => ({ db: {} }))
vi.mock('@nzila/db/schema', () => ({}))
vi.mock('@nzila/blob', () => ({ uploadBuffer: vi.fn() }))
vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  and: vi.fn(),
  gte: vi.fn(),
  lte: vi.fn(),
  sql: vi.fn(),
}))

import { buildReportBlobPath } from '../reports'

describe('buildReportBlobPath', () => {
  it('builds correct path with year/month extracted from startDate', () => {
    const result = buildReportBlobPath(
      'entity-uuid-123',
      'revenue_summary',
      '2025-03-01',
      'artifact-uuid-456',
    )
    expect(result).toBe(
      'exports/entity-uuid-123/stripe/2025/03/revenue_summary/artifact-uuid-456/report.json',
    )
  })

  it('handles different report types', () => {
    expect(
      buildReportBlobPath('e1', 'payout_recon', '2024-12-01', 'a1'),
    ).toBe('exports/e1/stripe/2024/12/payout_recon/a1/report.json')

    expect(
      buildReportBlobPath('e1', 'refunds_summary', '2025-01-15', 'a2'),
    ).toBe('exports/e1/stripe/2025/01/refunds_summary/a2/report.json')

    expect(
      buildReportBlobPath('e1', 'disputes_summary', '2025-06-01', 'a3'),
    ).toBe('exports/e1/stripe/2025/06/disputes_summary/a3/report.json')
  })

  it('handles single-digit months with leading zero in input', () => {
    const result = buildReportBlobPath('ent', 'revenue_summary', '2025-01-05', 'art')
    expect(result).toContain('/2025/01/')
  })
})
