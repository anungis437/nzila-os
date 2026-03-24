/**
 * Contract Test: CUPE Vocabulary Validation
 * PR-010
 * 
 * Ensures that vocabulary validation is enforced on all case intake operations.
 * Validates that invalid case types, priorities, and statuses are rejected.
 */

import { describe, it, expect } from 'vitest';
import {
  validateCaseType,
  validatePriority,
  validateStatus,
  validateCaseIntake,
  getAllCaseTypeIds,
  getAllPriorityIds,
  getAllStatusIds,
} from '@nzila/cupe-vocabulary';

describe('Contract: CUPE Vocabulary Validation', () => {
  describe('Case Type Validation', () => {
    it('accepts valid case types', () => {
      const validTypes = getAllCaseTypeIds();
      expect(validTypes.length).toBeGreaterThan(0);

      for (const typeId of validTypes) {
        const result = validateCaseType(typeId);
        expect(result.valid).toBe(true);
        expect(result.error).toBeUndefined();
      }
    });

    it('rejects invalid case types', () => {
      const result = validateCaseType('invalid_case_type');
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error?.field).toBe('caseType');
    });

    it('requires case type to be a string', () => {
      const result = validateCaseType(123);
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('is case-sensitive', () => {
      // Vocabulary uses lowercase IDs
      const result = validateCaseType('Discipline');
      expect(result.valid).toBe(false);
    });
  });

  describe('Priority Validation', () => {
    it('accepts valid priorities', () => {
      const validPriorities = getAllPriorityIds();
      expect(validPriorities.length).toBe(4); // low, medium, high, critical

      for (const priorityId of validPriorities) {
        const result = validatePriority(priorityId);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects invalid priorities', () => {
      const result = validatePriority('urgent');
      expect(result.valid).toBe(false);
      expect(result.error?.field).toBe('priority');
    });
  });

  describe('Status Validation', () => {
    it('accepts valid statuses', () => {
      const validStatuses = getAllStatusIds();
      expect(validStatuses.length).toBeGreaterThan(0);

      for (const statusId of validStatuses) {
        const result = validateStatus(statusId);
        expect(result.valid).toBe(true);
      }
    });

    it('rejects invalid statuses', () => {
      const result = validateStatus('pending_review');
      expect(result.valid).toBe(false);
      expect(result.error?.field).toBe('status');
    });
  });

  describe('Case Intake Validation', () => {
    it('accepts valid case intake data', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
        priority: 'high',
        status: 'filed',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('enforces case type validation', () => {
      const result = validateCaseIntake({
        caseType: 'invalid_type',
        priority: 'high',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'caseType')).toBe(true);
    });

    it('enforces priority validation', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
        priority: 'mega_high',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'priority')).toBe(true);
    });

    it('enforces status validation', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
        status: 'pending',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.field === 'status')).toBe(true);
    });

    it('collects multiple errors', () => {
      const result = validateCaseIntake({
        caseType: 'bad_type',
        priority: 'bad_priority',
        status: 'bad_status',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBe(3);
    });

    it('ignores missing optional fields', () => {
      const result = validateCaseIntake({
        caseType: 'discipline',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Vocabulary Completeness', () => {
    it('ensures all case types are unique', () => {
      const ids = getAllCaseTypeIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('ensures all priorities are unique', () => {
      const ids = getAllPriorityIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('ensures all statuses are unique', () => {
      const ids = getAllStatusIds();
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    it('has at least one case type', () => {
      expect(getAllCaseTypeIds().length).toBeGreaterThanOrEqual(5);
    });

    it('has all four priority levels', () => {
      const priorities = getAllPriorityIds();
      expect(priorities).toContain('low');
      expect(priorities).toContain('medium');
      expect(priorities).toContain('high');
      expect(priorities).toContain('critical');
    });
  });
});
