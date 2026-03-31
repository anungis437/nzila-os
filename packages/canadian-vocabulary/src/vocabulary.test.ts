import { describe, it, expect } from 'vitest';
import {
  getAllJurisdictions,
  getVocabulary,
  getCaseTypeIds,
  getPriorityIds,
  getStatusIds,
  getRoleIds,
} from './vocabulary';
import { validateCaseType, validatePriority } from './validator';

describe('canadian-vocabulary', () => {
  it('exports all 14 jurisdictions', () => {
    const jurisdictions = getAllJurisdictions();
    expect(jurisdictions).toHaveLength(14);
    expect(jurisdictions).toContain('federal');
    expect(jurisdictions).toContain('ON');
    expect(jurisdictions).toContain('QC');
    expect(jurisdictions).toContain('BC');
  });

  it('returns vocabulary for each jurisdiction', () => {
    for (const j of getAllJurisdictions()) {
      const vocab = getVocabulary(j as Parameters<typeof getVocabulary>[0]);
      expect(vocab).toBeDefined();
      expect(vocab.jurisdiction).toBe(j);
      expect(vocab.caseTypes.length).toBeGreaterThan(0);
    }
  });

  it('returns case-type IDs for a jurisdiction', () => {
    const ids = getCaseTypeIds('federal');
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toContain('discipline');
  });

  it('returns shared priorities', () => {
    const ids = getPriorityIds();
    expect(ids).toEqual(expect.arrayContaining(['low', 'medium', 'high', 'critical']));
  });

  it('returns shared statuses', () => {
    const ids = getStatusIds();
    expect(ids).toContain('draft');
    expect(ids).toContain('filed');
  });

  it('returns shared roles', () => {
    const ids = getRoleIds();
    expect(ids).toContain('member');
    expect(ids).toContain('steward');
  });

  it('validates a valid case type', () => {
    const result = validateCaseType('federal', 'discipline');
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid case type', () => {
    const result = validateCaseType('federal', 'nonexistent');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('validates a valid priority', () => {
    const result = validatePriority('high');
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid priority', () => {
    const result = validatePriority('extreme');
    expect(result.valid).toBe(false);
  });
});
