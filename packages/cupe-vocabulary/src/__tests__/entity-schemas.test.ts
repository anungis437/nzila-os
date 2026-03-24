import { describe, it, expect } from 'vitest';
import {
  OrgSchema,
  WorksiteSchema,
  MemberSchema,
  CaseSchema,
  CaseAssignmentSchema,
  CaseNoteSchema,
  generateCaseNumber,
  isValidCaseNumber,
  hasRoleOrHigher,
} from '../entity-schemas';

describe('Union Entity Schemas', () => {
  describe('OrgSchema', () => {
    it('validates correct org', () => {
      const org = {
        id: 'cupe-local-123',
        name: 'CUPE Local 123',
        slug: 'cupe-local-123',
        type: 'union_local' as const,
      };

      const result = OrgSchema.safeParse(org);
      expect(result.success).toBe(true);
    });

    it('rejects org with invalid ID', () => {
      const org = {
        id: 'xy',
        name: 'CUPE Local 123',
        slug: 'cupe-local-123',
        type: 'union_local' as const,
      };

      const result = OrgSchema.safeParse(org);
      expect(result.success).toBe(false);
    });
  });

  describe('MemberSchema', () => {
    it('validates correct member', () => {
      const member = {
        id: 'member-001',
        org_id: 'cupe-local-123',
        worksite_id: 'worksite-001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        role: 'steward' as const,
      };

      const result = MemberSchema.safeParse(member);
      expect(result.success).toBe(true);
    });

    it('enforces valid role enum', () => {
      const member = {
        id: 'member-001',
        org_id: 'cupe-local-123',
        worksite_id: 'worksite-001',
        first_name: 'John',
        last_name: 'Doe',
        email: 'john@example.com',
        role: 'invalid_role',
      };

      const result = MemberSchema.safeParse(member);
      expect(result.success).toBe(false);
    });
  });

  describe('CaseSchema', () => {
    it('validates correct case', () => {
      const caseData = {
        id: 'case-001',
        org_id: 'cupe-local-123',
        number: 'CL-2025-001',
        filed_by: 'member-001',
        case_type: 'discipline' as const,
        priority: 'high' as const,
        severity: 'serious' as const,
        status: 'filed' as const,
        title: 'Unjust discipline',
        description: 'Member received discipline without prior warning',
        filed_at: new Date().toISOString(),
      };

      const result = CaseSchema.safeParse(caseData);
      expect(result.success).toBe(true);
    });

    it('enforces case type enum', () => {
      const caseData = {
        id: 'case-001',
        org_id: 'cupe-local-123',
        number: 'CL-2025-001',
        filed_by: 'member-001',
        case_type: 'invalid_type',
        priority: 'high' as const,
        severity: 'serious' as const,
        status: 'filed' as const,
        title: 'Unjust discipline',
        description: 'Member received discipline without prior warning',
        filed_at: new Date().toISOString(),
      };

      const result = CaseSchema.safeParse(caseData);
      expect(result.success).toBe(false);
    });

    it('validates case number format', () => {
      const caseData = {
        id: 'case-001',
        org_id: 'cupe-local-123',
        number: 'invalid-number',
        filed_by: 'member-001',
        case_type: 'discipline' as const,
        priority: 'high' as const,
        severity: 'serious' as const,
        status: 'filed' as const,
        title: 'Unjust discipline',
        description: 'Member received discipline without prior warning',
        filed_at: new Date().toISOString(),
      };

      const result = CaseSchema.safeParse(caseData);
      expect(result.success).toBe(false);
    });
  });

  describe('createCaseNumber', () => {
    it('generates correct case number format', () => {
      const number = generateCaseNumber(2025, 42);
      expect(number).toBe('CL-2025-042');
    });

    it('pads sequence with zeros', () => {
      const number = generateCaseNumber(2025, 1);
      expect(number).toBe('CL-2025-001');
    });
  });

  describe('isValidCaseNumber', () => {
    it('validates correct case numbers', () => {
      expect(isValidCaseNumber('CL-2025-001')).toBe(true);
      expect(isValidCaseNumber('CUPE-2024-999')).toBe(true);
      expect(isValidCaseNumber('UE-2025-123')).toBe(true);
    });

    it('rejects invalid case numbers', () => {
      expect(isValidCaseNumber('invalid')).toBe(false);
      expect(isValidCaseNumber('CL2025001')).toBe(false);
      expect(isValidCaseNumber('CL-abc-001')).toBe(false);
      expect(isValidCaseNumber('A-9999-9')).toBe(false); // Too few digits (needs 3+)
    });
  });

  describe('hasRoleOrHigher', () => {
    it('allows admin to perform any action', () => {
      expect(hasRoleOrHigher('admin', 'member')).toBe(true);
      expect(hasRoleOrHigher('admin', 'officer')).toBe(true);
      expect(hasRoleOrHigher('admin', 'admin')).toBe(true);
    });

    it('allows officer to escalate', () => {
      expect(hasRoleOrHigher('officer', 'chief_steward')).toBe(true);
      expect(hasRoleOrHigher('officer', 'steward')).toBe(true);
    });

    it('prevents member from escalating', () => {
      expect(hasRoleOrHigher('member', 'steward')).toBe(false);
      expect(hasRoleOrHigher('member', 'member')).toBe(true);
    });

    it('allows chief_steward and business_agent at same level', () => {
      expect(hasRoleOrHigher('chief_steward', 'business_agent')).toBe(true);
      expect(hasRoleOrHigher('business_agent', 'chief_steward')).toBe(true);
    });
  });
});
