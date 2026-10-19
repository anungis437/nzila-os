import { describe, expect, it } from 'vitest'
import {
  historySnapshotExceedsOperationalDisclosure,
  projectEmploymentHistory,
  projectOperationalHistorySnapshot,
} from '../compensation-disclosure'

describe('operational history disclosure', () => {
  const stored = {
    id: 'h1',
    previousValues: {
      jobTitle: 'Helper',
      job_code: 'H-1',
      hourlyRate: '20.00',
      rateBefore: '20.00',
      newRate: '25.00',
      salary: '40000',
      wages: '1000.50',
      details: { jobTitle: 'Helper', amount: '20.00' },
      jobClassification: { name: 'Helper', baseSalary: '40000' },
      notes: 'raised to 25.00',
    },
    newValues: ['25.00', { hourlyRate: '25.00' }],
  }

  it('keeps operational primitives and drops alternate, nested, and array pay', () => {
    expect(projectOperationalHistorySnapshot(stored.previousValues)).toEqual({
      jobTitle: 'Helper',
      job_code: 'H-1',
    })
    expect(projectOperationalHistorySnapshot(stored.newValues)).toBeNull()
    const projected = projectEmploymentHistory(stored, false)
    expect(JSON.stringify(projected)).not.toContain('20.00')
    expect(JSON.stringify(projected)).not.toContain('25.00')
    expect(JSON.stringify(projected)).not.toContain('40000')
    expect(JSON.stringify(projected)).not.toContain('1000.50')
    expect(projected.previousValues).toEqual({ jobTitle: 'Helper', job_code: 'H-1' })
    expect(projected.newValues).toBeNull()
  })

  it('rejects a non-finance write that leaves the operational allowlist', () => {
    expect(historySnapshotExceedsOperationalDisclosure({ jobTitle: 'Welder' })).toBe(false)
    expect(historySnapshotExceedsOperationalDisclosure({ rateBefore: '20.00' })).toBe(true)
    expect(historySnapshotExceedsOperationalDisclosure({ newRate: '25.00' })).toBe(true)
    expect(historySnapshotExceedsOperationalDisclosure({
      jobTitle: 'Welder',
      pay: { hourlyRate: '25.00' },
    })).toBe(true)
    expect(historySnapshotExceedsOperationalDisclosure({
      jobTitle: { text: 'Welder', salary: '25.00' },
    })).toBe(true)
  })

  it('returns the stored snapshot to a finance grant', () => {
    expect(projectEmploymentHistory(stored, true)).toBe(stored)
  })
})
