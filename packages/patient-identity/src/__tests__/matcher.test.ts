import { describe, it, expect } from 'vitest'
import { scoreMatch, detectDuplicates } from '../matcher.js'
import type { MatchCandidate } from '../types.js'

const baseCandidate: MatchCandidate = {
  patientId: 'p-001',
  mrn: 'MRN-001',
  firstName: 'Jane',
  lastName: 'Demo',
  dateOfBirth: '1980-05-15',
  organizationId: 'org-001',
  siteId: 'site-001',
}

describe('scoreMatch', () => {
  it('exact MRN + name + DOB match gives high confidence', () => {
    const b: MatchCandidate = { ...baseCandidate, patientId: 'p-002' }
    const result = scoreMatch(baseCandidate, b)
    expect(result.confidence).toBe('high')
    expect(result.matchedFields).toContain('mrn')
  })

  it('name + DOB match (no MRN) gives medium confidence', () => {
    const a: MatchCandidate = { ...baseCandidate, mrn: undefined }
    const b: MatchCandidate = {
      patientId: 'p-002',
      mrn: undefined,
      firstName: 'Jane',
      lastName: 'Demo',
      dateOfBirth: '1980-05-15',
      organizationId: 'org-001',
      siteId: 'site-001',
    }
    const result = scoreMatch(a, b)
    expect(['medium', 'high']).toContain(result.confidence)
    expect(result.matchedFields).toContain('firstName')
    expect(result.matchedFields).toContain('dateOfBirth')
  })

  it('MRN-only match gives low confidence', () => {
    const b: MatchCandidate = {
      patientId: 'p-002',
      mrn: 'MRN-001',
      firstName: 'Different',
      lastName: 'Person',
      dateOfBirth: '1990-01-01',
      organizationId: 'org-001',
      siteId: 'site-001',
    }
    const result = scoreMatch(baseCandidate, b)
    expect(result.confidence).toBe('low')
    expect(result.matchedFields).toContain('mrn')
  })

  it('completely different records give no-match', () => {
    const b: MatchCandidate = {
      patientId: 'p-999',
      mrn: 'MRN-999',
      firstName: 'John',
      lastName: 'Other',
      dateOfBirth: '1990-01-01',
      organizationId: 'org-001',
      siteId: 'site-001',
    }
    const result = scoreMatch(baseCandidate, b)
    expect(result.confidence).toBe('no-match')
    expect(result.score).toBe(0)
  })

  it('name match is case-insensitive', () => {
    const b: MatchCandidate = {
      ...baseCandidate,
      patientId: 'p-002',
      mrn: undefined,
      firstName: 'JANE',
      lastName: 'demo',
    }
    const result = scoreMatch({ ...baseCandidate, mrn: undefined }, b)
    expect(result.matchedFields).toContain('firstName')
  })
})

describe('detectDuplicates', () => {
  it('detects duplicate pairs with score >= 0.6', () => {
    const candidates: MatchCandidate[] = [
      baseCandidate,
      { ...baseCandidate, patientId: 'p-002' },
    ]
    const groups = detectDuplicates(candidates)
    expect(groups.length).toBeGreaterThan(0)
    expect(groups[0].primaryPatientId).toBe('p-001')
    expect(groups[0].duplicatePatientIds).toContain('p-002')
    expect(groups[0].reviewStatus).toBe('pending')
  })

  it('returns empty array when no duplicates found', () => {
    const candidates: MatchCandidate[] = [
      baseCandidate,
      {
        patientId: 'p-999',
        mrn: 'UNIQ-999',
        firstName: 'Totally',
        lastName: 'Different',
        dateOfBirth: '1940-01-01',
        organizationId: 'org-001',
        siteId: 'site-001',
      },
    ]
    const groups = detectDuplicates(candidates)
    expect(groups.length).toBe(0)
  })
})
