import { describe, it, expect } from 'vitest'
import {
  getQuebecVocabulary,
  getAllCaseTypeIds,
  getAllStatusIds,
  getAllPriorityIds,
  getAllRoleIds,
  getCaseTypeById,
  getStatusById,
  getTribunal,
  getLegalReference,
} from './vocabulary'
import { validateCaseType, validateStatus, validateGriefIntake } from './validator'

describe('quebec-vocabulary', () => {
  it('exports case types', () => {
    const ids = getAllCaseTypeIds()
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain('anciennete')
    expect(ids).toContain('conge_abusif')
  })

  it('exports statuses', () => {
    const ids = getAllStatusIds()
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain('brouillon')
    expect(ids).toContain('depose')
  })

  it('exports priorities', () => {
    const ids = getAllPriorityIds()
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain('critical')
  })

  it('exports roles', () => {
    const ids = getAllRoleIds()
    expect(ids.length).toBeGreaterThan(0)
    expect(ids).toContain('delegue')
  })

  it('looks up a case type by id', () => {
    const ct = getCaseTypeById('anciennete')
    expect(ct).toBeDefined()
    expect(ct!.label).toBe('Ancienneté')
  })

  it('looks up a status by id', () => {
    const s = getStatusById('brouillon')
    expect(s).toBeDefined()
    expect(s!.labelEn).toBe('Draft')
  })

  it('getQuebecVocabulary returns full vocabulary', () => {
    const v = getQuebecVocabulary()
    expect(v.caseTypes.length).toBeGreaterThan(0)
    expect(v.statuses.length).toBeGreaterThan(0)
    expect(v.jurisdiction).toBe('quebec')
  })

  it('getTribunal returns TAT info', () => {
    const tat = getTribunal('tat')
    expect(tat).toBeDefined()
    expect(tat!.abbreviation).toBe('TAT')
  })

  it('getLegalReference returns LNT', () => {
    const lnt = getLegalReference('loiNormesTravail')
    expect(lnt).toBeDefined()
    expect(lnt!.shortName).toBe('LNT')
  })

  it('validates a known case type', () => {
    const result = validateCaseType('anciennete')
    expect(result.valid).toBe(true)
  })

  it('rejects unknown case type', () => {
    const result = validateCaseType('nonexistent')
    expect(result.valid).toBe(false)
  })

  it('validates a known status', () => {
    const result = validateStatus('brouillon')
    expect(result.valid).toBe(true)
  })

  it('rejects unknown status', () => {
    const result = validateStatus('nonexistent')
    expect(result.valid).toBe(false)
  })

  it('validates grief intake with valid data', () => {
    const result = validateGriefIntake({
      caseType: 'anciennete',
      status: 'brouillon',
      priority: 'high',
    })
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects grief intake with invalid fields', () => {
    const result = validateGriefIntake({
      caseType: 'bad_type',
      priority: 'invalid',
    })
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(0)
  })
})
