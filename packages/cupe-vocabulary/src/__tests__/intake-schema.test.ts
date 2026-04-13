/**
 * Intake Schema Tests
 *
 * PR-020: Validates the server-side intake request schema
 * against CUPE vocabulary constraints.
 */

import { describe, it, expect } from 'vitest';
import { validateIntakeRequest, CaseIntakeRequestSchema } from '../intake-schema';
import { getAllCaseTypeIds, getAllPriorityIds, getAllSeverityIds } from '../vocabulary';

describe('CaseIntakeRequestSchema', () => {
  const validIntake = {
    memberId: 'mem-001',
    caseType: 'discipline',
    priority: 'high',
    severity: 'serious',
    title: 'Unjust suspension',
    description: 'Employee was suspended without proper process or documentation.',
    incidentDate: '2025-03-15',
    location: 'Main Office',
  };

  it('accepts a valid intake request', () => {
    const result = validateIntakeRequest(validIntake);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.caseType).toBe('discipline');
  });

  it('rejects missing required fields', () => {
    const result = validateIntakeRequest({});
    expect(result.success).toBe(false);
    expect(result.errors!.length).toBeGreaterThan(0);
    const fields = result.errors!.map((e) => e.field);
    expect(fields).toContain('memberId');
    expect(fields).toContain('title');
    expect(fields).toContain('description');
  });

  it('rejects invalid case type', () => {
    const result = validateIntakeRequest({ ...validIntake, caseType: 'invalid_type' });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('caseType');
    expect(result.errors![0].message).toContain('Case type must be one of');
  });

  it('rejects invalid priority', () => {
    const result = validateIntakeRequest({ ...validIntake, priority: 'super_urgent' });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('priority');
  });

  it('rejects invalid severity', () => {
    const result = validateIntakeRequest({ ...validIntake, severity: 'ultra' });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('severity');
  });

  it('accepts all valid case type IDs', () => {
    for (const id of getAllCaseTypeIds()) {
      const result = validateIntakeRequest({ ...validIntake, caseType: id });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid priority IDs', () => {
    for (const id of getAllPriorityIds()) {
      const result = validateIntakeRequest({ ...validIntake, priority: id });
      expect(result.success).toBe(true);
    }
  });

  it('accepts all valid severity IDs', () => {
    for (const id of getAllSeverityIds()) {
      const result = validateIntakeRequest({ ...validIntake, severity: id });
      expect(result.success).toBe(true);
    }
  });

  it('severity is optional — defaults to undefined', () => {
    const { severity, ...withoutSeverity } = validIntake;
    const result = validateIntakeRequest(withoutSeverity);
    expect(result.success).toBe(true);
    expect(result.data!.severity).toBeUndefined();
  });

  it('rejects title shorter than 5 chars', () => {
    const result = validateIntakeRequest({ ...validIntake, title: 'Hi' });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('title');
    expect(result.errors![0].message).toContain('5 characters');
  });

  it('rejects description shorter than 10 chars', () => {
    const result = validateIntakeRequest({ ...validIntake, description: 'Short' });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('description');
    expect(result.errors![0].message).toContain('10 characters');
  });

  it('rejects future incident dates', () => {
    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + 1);
    const result = validateIntakeRequest({
      ...validIntake,
      incidentDate: futureDate.toISOString().slice(0, 10),
    });
    expect(result.success).toBe(false);
    expect(result.errors![0].field).toBe('incidentDate');
    expect(result.errors![0].message).toContain('future');
  });

  it('accepts optional fields as undefined', () => {
    const result = validateIntakeRequest(validIntake);
    expect(result.success).toBe(true);
    expect(result.data!.witnesses).toBeUndefined();
    expect(result.data!.desiredOutcome).toBeUndefined();
  });

  it('defaults isAnonymous to false', () => {
    const result = validateIntakeRequest(validIntake);
    expect(result.success).toBe(true);
    expect(result.data!.isAnonymous).toBe(false);
  });

  it('maps field to "unknown" when error path is empty', () => {
    const result = validateIntakeRequest(null);
    expect(result.success).toBe(false);
    expect(result.errors!.some((e) => e.field === 'unknown')).toBe(true);
  });

  it('accepts isAnonymous = true', () => {
    const result = validateIntakeRequest({ ...validIntake, isAnonymous: true });
    expect(result.success).toBe(true);
    expect(result.data!.isAnonymous).toBe(true);
  });
});
