import { describe, it, expect } from 'vitest'
import {
  getQuebecVocabulary,
  getAllCaseTypeIds,
  getAllStatusIds,
  getAllPriorityIds,
  getAllSeverityIds,
  getAllRoleIds,
  getCaseTypeById,
  getPriorityById,
  getStatusById,
  getRoleById,
  getTribunal,
  getLegalReference,
  getArticle,
  getLocalizedLabel,
} from './vocabulary'
import { validateCaseType, validatePriority, validateStatus, validateGriefIntake } from './validator'
import * as vocabularyIndex from './index'

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

  it('exports severities', () => {
    const ids = getAllSeverityIds()
    expect(ids).toEqual(expect.arrayContaining(['minor', 'critical']))
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

  it('looks up priority and role by id', () => {
    const priority = getPriorityById('high')
    const role = getRoleById('delegue')

    expect(priority?.escalationRequired).toBe(true)
    expect(role?.labelEn).toBe('Shop Steward')
  })

  it('returns undefined for unknown lookups', () => {
    expect(getCaseTypeById('missing')).toBeUndefined()
    expect(getPriorityById('missing' as unknown)).toBeUndefined()
    expect(getStatusById('missing')).toBeUndefined()
    expect(getRoleById('missing')).toBeUndefined()
    expect(getTribunal('missing')).toBeUndefined()
    expect(getLegalReference('missing')).toBeUndefined()
    expect(getArticle('missing-law', 'missing-article')).toBeUndefined()
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

  it('getArticle returns legal article values', () => {
    expect(getArticle('codeDuTravail', 'certification')).toBe('art. 21–46')
  })

  it('getLocalizedLabel returns expected locale variant', () => {
    const item = { label: 'Fr label', labelEn: 'En label' }
    expect(getLocalizedLabel(item, 'fr')).toBe('Fr label')
    expect(getLocalizedLabel(item, 'en')).toBe('En label')
  })

  it('validates a known case type', () => {
    const result = validateCaseType('anciennete')
    expect(result.valid).toBe(true)
  })

  it('rejects unknown case type', () => {
    const result = validateCaseType('nonexistent')
    expect(result.valid).toBe(false)
    expect(result.error?.field).toBe('caseType')
  })

  it('validates and rejects priorities', () => {
    expect(validatePriority('high').valid).toBe(true)
    const bad = validatePriority('invalid-priority')
    expect(bad.valid).toBe(false)
    expect(bad.error?.field).toBe('priority')
  })

  it('validates a known status', () => {
    const result = validateStatus('brouillon')
    expect(result.valid).toBe(true)
  })

  it('rejects unknown status', () => {
    const result = validateStatus('nonexistent')
    expect(result.valid).toBe(false)
    expect(result.error?.field).toBe('status')
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

  it('treats missing intake fields as valid (optional validation)', () => {
    const result = validateGriefIntake({})
    expect(result.valid).toBe(true)
    expect(result.errors).toEqual([])
  })

  it('exports vocabulary APIs from barrel index', () => {
    expect(typeof vocabularyIndex.getQuebecVocabulary).toBe('function')
    expect(typeof vocabularyIndex.validateGriefIntake).toBe('function')
    expect(vocabularyIndex.getAllCaseTypeIds()).toContain('anciennete')
  })
})
