import { describe, it, expect } from 'vitest';
import {
  getCUPEVocabulary,
  getCaseTypeById,
  getPriorityById,
  getStatusById,
  getAllCaseTypeIds,
  getAllPriorityIds,
  getAllStatusIds,
  getStatusesByCategory,
} from '../vocabulary';
import { validateCaseType, validatePriority, validateStatus, validateCaseIntake } from '../validator';

describe('CUPE Vocabulary', () => {
  describe('getCUPEVocabulary', () => {
    it('returns complete vocabulary with all categories', () => {
      const vocab = getCUPEVocabulary();

      expect(vocab.caseTypes.length).toBeGreaterThan(0);
      expect(vocab.priorities.length).toBe(4); // low, medium, high, critical
      expect(vocab.severities.length).toBe(4); // minor, moderate, serious, critical
      expect(vocab.roles.length).toBeGreaterThan(0);
      expect(vocab.statuses.length).toBeGreaterThan(0);
      expect(vocab.version).toBe('0.1.0');
    });

    it('includes all CUPE case types', () => {
      const vocab = getCUPEVocabulary();
      const caseTypeIds = vocab.caseTypes.map((ct) => ct.id);

      expect(caseTypeIds).toContain('discipline');
      expect(caseTypeIds).toContain('harassment');
      expect(caseTypeIds).toContain('discrimination');
      expect(caseTypeIds).toContain('wage_dispute');
      expect(caseTypeIds).toContain('safety');
    });
  });

  describe('getCaseTypeById', () => {
    it('returns case type by ID', () => {
      const caseType = getCaseTypeById('discipline');
      expect(caseType).toBeDefined();
      expect(caseType?.label).toBe('Discipline');
      expect(caseType?.defaultPriority).toBe('high');
    });

    it('returns undefined for invalid case type ID', () => {
      const caseType = getCaseTypeById('invalid_type');
      expect(caseType).toBeUndefined();
    });
  });

  describe('getPriorityById', () => {
    it('returns priority by ID', () => {
      const priority = getPriorityById('critical');
      expect(priority).toBeDefined();
      expect(priority?.label).toBe('Critical');
      expect(priority?.slaHours).toBe(24);
      expect(priority?.escalationRequired).toBe(true);
    });
  });

  describe('getStatusById', () => {
    it('returns status by ID', () => {
      const status = getStatusById('filed');
      expect(status).toBeDefined();
      expect(status?.label).toBe('Filed');
      expect(status?.category).toBe('open');
    });

    it('returns status with allowed transitions', () => {
      const status = getStatusById('acknowledged');
      expect(status?.allowTransitionsTo).toContain('investigating');
      expect(status?.allowTransitionsTo).toContain('escalated');
    });
  });

  describe('getAllCaseTypeIds', () => {
    it('returns all case type IDs', () => {
      const ids = getAllCaseTypeIds();
      expect(ids.length).toBeGreaterThan(0);
      expect(ids).toContain('discipline');
      expect(ids).toContain('safety');
    });
  });

  describe('getStatusesByCategory', () => {
    it('returns all open statuses', () => {
      const statuses = getStatusesByCategory('open');
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses.every((s) => s.category === 'open')).toBe(true);
      expect(statuses.map((s) => s.id)).toContain('filed');
    });

    it('returns all closed statuses', () => {
      const statuses = getStatusesByCategory('closed');
      expect(statuses.length).toBeGreaterThan(0);
      expect(statuses.map((s) => s.id)).toContain('closed');
    });
  });
});

describe('Vocabulary Validation', () => {
  describe('validateCaseType', () => {
    it('validates correct case type', () => {
      const result = validateCaseType('discipline');
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('rejects invalid case type', () => {
      const result = validateCaseType('invalid_case');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('Invalid case type');
    });
  });

  describe('validatePriority', () => {
    it('validates correct priority', () => {
      const result = validatePriority('critical');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid priority', () => {
      const result = validatePriority('urgent');
      expect(result.valid).toBe(false);
      expect(result.error?.message).toContain('Invalid priority');
    });
  });

  describe('validateStatus', () => {
    it('validates correct status', () => {
      const result = validateStatus('filed');
      expect(result.valid).toBe(true);
    });

    it('rejects invalid status', () => {
      const result = validateStatus('unknown_status');
      expect(result.valid).toBe(false);
    });
  });

  describe('validateCaseIntake', () => {
    it('accepts valid case intake data', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
        priority: 'high',
        status: 'filed',
      });
      expect(result.valid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('collects multiple validation errors', () => {
      const result = validateCaseIntake({
        caseType: 'invalid',
        priority: 'urgent',
        status: 'unknown',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('validates individual fields', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
        priority: 'invalid',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'priority')).toBe(true);
    });
  });
});
