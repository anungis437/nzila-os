import { describe, expect, it } from 'vitest'
import {
  buildAggregateIntegrityReport,
  detectAggregateAnomalies,
  verifyAggregateCompleteness,
  verifyAggregateConsistency,
} from './integrity'

// ---------------------------------------------------------------------------
// verifyAggregateCompleteness
// ---------------------------------------------------------------------------

describe('verifyAggregateCompleteness', () => {
  it('passes when actualOrgCount equals expectedOrgCount and no missing windows', () => {
    const result = verifyAggregateCompleteness({
      expectedOrgCount: 3,
      actualOrgCount: 3,
    })
    expect(result.status).toBe('pass')
  })

  it('fails when actualOrgCount is below expectedOrgCount', () => {
    const result = verifyAggregateCompleteness({
      expectedOrgCount: 5,
      actualOrgCount: 3,
    })
    expect(result.status).toBe('fail')
    expect(result.message).toContain('Expected 5 orgs')
  })

  it('warns when missingWindowKeys has entries but org counts match', () => {
    const result = verifyAggregateCompleteness({
      expectedOrgCount: 3,
      actualOrgCount: 3,
      missingWindowKeys: ['2026-W01', '2026-W02'],
    })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('2 window key(s) missing')
  })

  it('passes when missingWindowKeys is empty', () => {
    const result = verifyAggregateCompleteness({
      expectedOrgCount: 2,
      actualOrgCount: 2,
      missingWindowKeys: [],
    })
    expect(result.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// verifyAggregateConsistency
// ---------------------------------------------------------------------------

describe('verifyAggregateConsistency', () => {
  it('passes when output is proportional to input', () => {
    const result = verifyAggregateConsistency({
      inputRecordCount: 100,
      outputAggregateCount: 50,
    })
    expect(result.status).toBe('pass')
  })

  it('fails when output > 0 with zero input', () => {
    const result = verifyAggregateConsistency({
      inputRecordCount: 0,
      outputAggregateCount: 5,
    })
    expect(result.status).toBe('fail')
    expect(result.message).toContain('zero input records')
  })

  it('fails when zero output with non-zero input', () => {
    const result = verifyAggregateConsistency({
      inputRecordCount: 100,
      outputAggregateCount: 0,
    })
    expect(result.status).toBe('fail')
    expect(result.message).toContain('No aggregates produced')
  })

  it('warns when output/input ratio is below minOutputRatio', () => {
    const result = verifyAggregateConsistency({
      inputRecordCount: 100,
      outputAggregateCount: 3,
      minOutputRatio: 0.1,
    })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('below threshold')
  })

  it('passes when ratio exactly meets minOutputRatio', () => {
    const result = verifyAggregateConsistency({
      inputRecordCount: 100,
      outputAggregateCount: 10,
      minOutputRatio: 0.1,
    })
    expect(result.status).toBe('pass')
  })
})

// ---------------------------------------------------------------------------
// detectAggregateAnomalies
// ---------------------------------------------------------------------------

describe('detectAggregateAnomalies', () => {
  it('passes when no suspicious drops exist', () => {
    const result = detectAggregateAnomalies({
      aggregatesByOrg: {
        'org-1': { totalAmount: 1000, recordCount: 10, previousRecordCount: 10 },
        'org-2': { totalAmount: 500, recordCount: 5, previousRecordCount: 4 },
      },
    })
    expect(result.status).toBe('pass')
  })

  it('warns when an org record count drops below threshold vs previous', () => {
    const result = detectAggregateAnomalies({
      aggregatesByOrg: {
        'org-1': { totalAmount: 200, recordCount: 2, previousRecordCount: 20 },
      },
    })
    expect(result.status).toBe('warn')
    expect(result.message).toContain('Suspicious record drop')
  })

  it('passes when previousRecordCount is not provided (no baseline)', () => {
    const result = detectAggregateAnomalies({
      aggregatesByOrg: {
        'org-1': { totalAmount: 500, recordCount: 1 },
      },
    })
    expect(result.status).toBe('pass')
  })

  it('respects a custom dropThreshold', () => {
    // recordCount is 7, previous is 10: ratio = 0.7, threshold 0.8 → should warn
    const result = detectAggregateAnomalies({
      aggregatesByOrg: {
        'org-1': { totalAmount: 700, recordCount: 7, previousRecordCount: 10 },
      },
      dropThreshold: 0.8,
    })
    expect(result.status).toBe('warn')
  })
})

// ---------------------------------------------------------------------------
// buildAggregateIntegrityReport
// ---------------------------------------------------------------------------

describe('buildAggregateIntegrityReport', () => {
  it('returns severity=critical and valid=false when any check fails', () => {
    const report = buildAggregateIntegrityReport([
      { name: 'a', status: 'pass', message: 'ok' },
      { name: 'b', status: 'fail', message: 'bad' },
      { name: 'c', status: 'warn', message: 'meh' },
    ])
    expect(report.severity).toBe('critical')
    expect(report.valid).toBe(false)
  })

  it('returns severity=warning and valid=true when only warns (no fail)', () => {
    const report = buildAggregateIntegrityReport([
      { name: 'a', status: 'pass', message: 'ok' },
      { name: 'b', status: 'warn', message: 'lag' },
    ])
    expect(report.severity).toBe('warning')
    expect(report.valid).toBe(true)
  })

  it('returns severity=healthy and valid=true when all checks pass', () => {
    const report = buildAggregateIntegrityReport([
      { name: 'a', status: 'pass', message: 'ok' },
      { name: 'b', status: 'pass', message: 'ok' },
    ])
    expect(report.severity).toBe('healthy')
    expect(report.valid).toBe(true)
  })

  it('returns severity=healthy for empty checks array', () => {
    const report = buildAggregateIntegrityReport([])
    expect(report.severity).toBe('healthy')
    expect(report.valid).toBe(true)
  })
})
