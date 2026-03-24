/**
 * Union Entity Model Schema & Validators
 * 
 * Validates CUPE case, member, assignment, and organization models
 * against pilot requirements using Zod.
 */

import { z } from 'zod';

/**
 * Organization Schema
 */
export const OrgSchema = z.object({
  id: z.string().min(3).max(50).describe('Unique org ID (e.g., cupe-local-123)'),
  name: z.string().min(3).max(200).describe('Organization name'),
  slug: z.string().min(3).max(50).describe('URL-safe slug'),
  type: z.enum(['union_local', 'union_regional', 'union_national']),
  jurisdiction: z.string().optional(),
  contact_email: z.string().email().optional(),
  phone: z.string().optional(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type Org = z.infer<typeof OrgSchema>;

/**
 * Worksite Schema
 */
export const WorksiteSchema = z.object({
  id: z.string().min(3).max(50),
  org_id: z.string().min(3).max(50),
  name: z.string().min(3).max(200),
  address: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  member_count: z.number().int().min(0).optional(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type Worksite = z.infer<typeof WorksiteSchema>;

/**
 * Member Schema
 */
export const MemberSchema = z.object({
  id: z.string().min(3).max(50),
  org_id: z.string().min(3).max(50),
  worksite_id: z.string().min(3).max(50),
  first_name: z.string().min(1).max(100),
  last_name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(['member', 'steward', 'chief_steward', 'business_agent', 'officer', 'admin']),
  member_number: z.string().optional(),
  hire_date: z.string().date().optional(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type Member = z.infer<typeof MemberSchema>;

/**
 * Case Schema
 */
export const CaseSchema = z.object({
  id: z.string().min(3).max(50),
  org_id: z.string().min(3).max(50),
  number: z.string().regex(/^[A-Z]+-\d{4}-\d{3,}$/).describe('Case number format: CUSPE-2025-001'),
  filed_by: z.string().min(3).max(50).describe('Member ID who filed'),
  assigned_to: z.string().min(3).max(50).optional().describe('Member ID assigned to handle'),
  case_type: z.enum([
    'discipline', 'harassment', 'discrimination', 'wage_dispute', 'benefits_denial',
    'recall_rehire', 'safety', 'contracting', 'dues', 'other'
  ]),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  severity: z.enum(['minor', 'moderate', 'serious', 'critical']),
  status: z.enum([
    'draft', 'filed', 'acknowledged', 'investigating', 'response_due', 
    'escalated', 'mediation', 'arbitration', 'settled', 'denied', 'withdrawn', 'closed'
  ]),
  title: z.string().min(5).max(300),
  description: z.string().min(10).max(5000),
  filed_at: z.string().datetime(),
  settlement_date: z.string().datetime().optional(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type Case = z.infer<typeof CaseSchema>;

/**
 * Case Assignment Schema
 */
export const CaseAssignmentSchema = z.object({
  id: z.string().min(3).max(50),
  case_id: z.string().min(3).max(50),
  assigned_to: z.string().min(3).max(50),
  assigned_by: z.string().min(3).max(50),
  reason: z.string().optional(),
  assigned_at: z.string().datetime(),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type CaseAssignment = z.infer<typeof CaseAssignmentSchema>;

/**
 * Case Note Schema
 */
export const CaseNoteSchema = z.object({
  id: z.string().min(3).max(50),
  case_id: z.string().min(3).max(50),
  author_id: z.string().min(3).max(50),
  content: z.string().min(1).max(10000),
  is_internal: z.boolean().default(false),
  created_at: z.string().datetime().default(() => new Date().toISOString()),
});

export type CaseNote = z.infer<typeof CaseNoteSchema>;

/**
 * Validate complete case intake
 */
export const ValidateCaseIntakeSchema = CaseSchema.pick({
  filed_by: true,
  case_type: true,
  priority: true,
  severity: true,
  status: true,
  title: true,
  description: true,
});

/**
 * Validate complete member profile
 */
export const ValidateMemberProfileSchema = MemberSchema.pick({
  first_name: true,
  last_name: true,
  email: true,
  role: true,
});

/**
 * Helper: Generate case number
 * Format: CUPE-LOCAL-YYYY-NNN (e.g., CUPE-LOCAL-2025-001)
 */
export function generateCaseNumber(year: number, sequence: number): string {
  return `CL-${year}-${String(sequence).padStart(3, '0')}`;
}

/**
 * Helper: Validate case number format
 */
export function isValidCaseNumber(caseNumber: string): boolean {
  return /^[A-Z]+-\d{4}-\d{3,}$/.test(caseNumber);
}

/**
 * Helper: Validate member role hierarchy
 * Returns true if targetRole has equal or greater permissions than minRole
 */
export function hasRoleOrHigher(
  targetRole: string,
  minRole: 'member' | 'steward' | 'chief_steward' | 'business_agent' | 'officer' | 'admin'
): boolean {
  const roleHierarchy: Record<string, number> = {
    member: 0,
    steward: 1,
    chief_steward: 2,
    business_agent: 2,
    officer: 3,
    admin: 4,
  };

  return (roleHierarchy[targetRole] ?? -1) >= (roleHierarchy[minRole] ?? -1);
}
