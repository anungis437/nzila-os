import { describe, it, expect } from 'vitest';
import {
  getAllJurisdictions,
  getVocabulary,
  getJurisdictionName,
  getCaseTypes,
  getCaseTypeIds,
  getPriorities,
  getPriorityIds,
  getStatuses,
  getStatusIds,
  getRoles,
  getRoleIds,
} from './vocabulary';
import { validateCaseType, validatePriority, validateStatus, validateGrievanceIntake } from './validator';
import * as packageExports from './index';

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

  it('returns jurisdiction name and case types for a jurisdiction', () => {
    expect(getJurisdictionName('ON')).toBe('Ontario');
    const caseTypes = getCaseTypes('ON');
    expect(caseTypes.length).toBeGreaterThan(0);
    expect(caseTypes[0]).toHaveProperty('id');
  });

  it('returns shared priorities', () => {
    const priorities = getPriorities();
    expect(priorities.length).toBeGreaterThan(0);
    const ids = getPriorityIds();
    expect(ids).toEqual(expect.arrayContaining(['low', 'medium', 'high', 'critical']));
  });

  it('returns shared statuses', () => {
    const statuses = getStatuses();
    expect(statuses.length).toBeGreaterThan(0);
    const ids = getStatusIds();
    expect(ids).toContain('draft');
    expect(ids).toContain('filed');
  });

  it('returns shared roles', () => {
    const roles = getRoles();
    expect(roles.length).toBeGreaterThan(0);
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

  it('validates a valid status', () => {
    const result = validateStatus('draft');
    expect(result.valid).toBe(true);
  });

  it('rejects an invalid status', () => {
    const result = validateStatus('archived_forever');
    expect(result.valid).toBe(false);
    expect(result.error?.field).toBe('status');
  });

  it('validates grievance intake with no provided optional fields', () => {
    const result = validateGrievanceIntake('federal', {});
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('aggregates grievance intake validation errors for each invalid field', () => {
    const result = validateGrievanceIntake('federal', {
      caseType: 'bad_case_type',
      priority: 'bad_priority',
      status: 'bad_status',
    });

    expect(result.valid).toBe(false);
    expect(result.errors).toHaveLength(3);
    expect(result.errors.map((e) => e.field).sort()).toEqual(['caseType', 'priority', 'status']);
  });

  it('exports runtime APIs from package index', () => {
    expect(packageExports.getVocabulary).toBeTypeOf('function');
    expect(packageExports.validateCaseType).toBeTypeOf('function');
  });
});
