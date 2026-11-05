/**
 * Member Employment Validation Schemas
 * 
 * Phase 1.2: Member Profile v2 - Employment Attributes
 * 
 * Zod schemas for validating member employment data including:
 * - Employment status and dates
 * - Seniority tracking
 * - Job classification
 * - Compensation (critical for dues calculation)
 * - Work schedule
 */

import { z } from "zod";
import { partialWithoutDefaults } from './partial-without-defaults';

// =============================================================================
// ENUM SCHEMAS
// =============================================================================

export const employmentStatusSchema = z.enum([
  "active",
  "on_leave",
  "layoff",
  "suspended",
  "terminated",
  "retired",
  "deceased"
]);

export const employmentTypeSchema = z.enum([
  "full_time",
  "part_time",
  "casual",
  "seasonal",
  "temporary",
  "contract",
  "probationary"
]);

export const payFrequencySchema = z.enum([
  "hourly",
  "weekly",
  "bi_weekly",
  "semi_monthly",
  "monthly",
  "annual",
  "per_diem"
]);

export const shiftTypeSchema = z.enum([
  "day",
  "evening",
  "night",
  "rotating",
  "split",
  "on_call"
]);

export const leaveTypeSchema = z.enum([
  "vacation",
  "sick",
  "maternity",
  "paternity",
  "parental",
  "bereavement",
  "medical",
  "disability",
  "union_business",
  "unpaid",
  "lwop",
  "other"
]);

// =============================================================================
// MEMBER EMPLOYMENT SCHEMA
// =============================================================================

export const createMemberEmploymentSchema = z.object({
  // Required fields
  organizationId: z.guid(),
  memberId: z.guid(),
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be valid date (YYYY-MM-DD)"),
  seniorityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be valid date (YYYY-MM-DD)"),
  jobTitle: z.string().min(1, "Job title is required").max(255),
  
  // Employment context
  employerId: z.guid().optional(),
  worksiteId: z.guid().optional(),
  bargainingUnitId: z.guid().optional(),
  
  // Status & Type
  employmentStatus: employmentStatusSchema.default("active"),
  employmentType: employmentTypeSchema.default("full_time"),
  
  // Dates
  terminationDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Seniority
  seniorityYears: z.number().min(0).max(99.99).optional(),
  adjustedSeniorityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  seniorityAdjustmentReason: z.string().max(1000).optional(),
  
  // Job Classification
  jobCode: z.string().max(100).optional(),
  jobClassification: z.string().max(255).optional(),
  jobLevel: z.number().int().min(1).max(20).optional(),
  department: z.string().max(255).optional(),
  division: z.string().max(255).optional(),
  
  // Compensation - Critical for dues calculation
  payFrequency: payFrequencySchema.default("hourly"),
  hourlyRate: z.number().min(0).max(9999.99).optional(),
  baseSalary: z.number().min(0).max(9999999.99).optional(),
  grossWages: z.number().min(0).max(9999999.99).optional(),
  
  // Work Schedule
  regularHoursPerWeek: z.number().min(0).max(168).default(40),
  regularHoursPerPeriod: z.number().min(0).max(999).optional(),
  shiftType: shiftTypeSchema.optional(),
  shiftStartTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM format").optional(),
  shiftEndTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Must be HH:MM format").optional(),
  operatesWeekends: z.boolean().default(false),
  operates24Hours: z.boolean().default(false),
  
  // Supervisor
  supervisorName: z.string().max(255).optional(),
  supervisorId: z.guid().optional(),
  
  // Probation
  isProbationary: z.boolean().default(false),
  probationEndDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  // Union-specific
  checkoffAuthorized: z.boolean().default(true),
  checkoffDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  randExempt: z.boolean().default(false),
  
  // Custom fields
  customFields: z.record(z.string(), z.unknown()).optional(),
  
  // Notes
  notes: z.string().optional(),
  createdBy: z.string().max(255).optional(),
  updatedBy: z.string().max(255).optional(),
});

export const updateMemberEmploymentSchema = partialWithoutDefaults(createMemberEmploymentSchema).extend({
  id: z.guid(),
});

// =============================================================================
// EMPLOYMENT HISTORY SCHEMA
// =============================================================================

export const createEmploymentHistorySchema = z.object({
  organizationId: z.guid(),
  memberId: z.guid(),
  memberEmploymentId: z.guid().optional(),
  
  changeType: z.enum([
    "hire",
    "promotion",
    "transfer",
    "demotion",
    "leave",
    "return_from_leave",
    "termination",
    "resignation",
    "retirement",
    "wage_change",
    "status_change",
    "worksite_change",
    "job_classification_change",
    "other"
  ]),
  
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  
  previousValues: z.record(z.string(), z.unknown()).optional(),
  newValues: z.record(z.string(), z.unknown()).optional(),
  
  reason: z.string().optional(),
  notes: z.string().optional(),
  createdBy: z.string().max(255).optional(),
});

// =============================================================================
// MEMBER LEAVES SCHEMA
// =============================================================================

export const createMemberLeaveSchema = z.object({
  organizationId: z.guid(),
  memberId: z.guid(),
  memberEmploymentId: z.guid().optional(),
  
  leaveType: leaveTypeSchema,
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expectedReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  actualReturnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  
  isApproved: z.boolean().default(false),
  approvedBy: z.string().max(255).optional(),
  
  affectsSeniority: z.boolean().default(false),
  seniorityAdjustmentDays: z.number().int().min(0).optional(),
  
  affectsDues: z.boolean().default(true),
  duesWaiverApproved: z.boolean().default(false),
  
  reason: z.string().optional(),
  notes: z.string().optional(),
  documents: z.array(z.record(z.string(), z.unknown())).optional(),
  createdBy: z.string().max(255).optional(),
});

export const updateMemberLeaveSchema = partialWithoutDefaults(createMemberLeaveSchema).extend({
  id: z.guid(),
});

// =============================================================================
// JOB CLASSIFICATIONS SCHEMA
// =============================================================================

export const createJobClassificationSchema = z.object({
  organizationId: z.guid(),
  bargainingUnitId: z.guid().optional(),
  
  jobCode: z.string().min(1).max(100),
  jobTitle: z.string().min(1).max(255),
  jobFamily: z.string().max(255).optional(),
  jobLevel: z.number().int().min(1).max(50).optional(),
  
  // Wage rates for dues calculation
  minimumRate: z.number().min(0).max(9999.99).optional(),
  maximumRate: z.number().min(0).max(9999.99).optional(),
  standardRate: z.number().min(0).max(9999.99).optional(),
  
  description: z.string().optional(),
  requirements: z.record(z.string(), z.unknown()).optional(),
  
  isActive: z.boolean().default(true),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  createdBy: z.string().max(255).optional(),
});

export const updateJobClassificationSchema = partialWithoutDefaults(createJobClassificationSchema).extend({
  id: z.guid(),
});

// =============================================================================
// SPECIALIZED VALIDATION SCHEMAS
// =============================================================================

/**
 * Schema for validating compensation data required by dues calculation engine
 * See: lib/dues-calculation-engine.ts
 */
export const duesCalculationDataSchema = z.object({
  grossWages: z.number().min(0).optional(),
  baseSalary: z.number().min(0).optional(),
  hourlyRate: z.number().min(0).optional(),
  hoursWorked: z.number().min(0).max(744).optional(), // Max hours in a month (31 days * 24 hours)
  employmentStatus: employmentStatusSchema,
  payFrequency: payFrequencySchema,
});

/**
 * Schema for bulk employment import
 */
export const bulkEmploymentImportSchema = z.object({
  organizationId: z.guid(),
  employees: z.array(createMemberEmploymentSchema),
  validateOnly: z.boolean().default(false),
  skipDuplicates: z.boolean().default(true),
});

/**
 * Schema for seniority calculation
 */
export const seniorityCalculationSchema = z.object({
  hireDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  seniorityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adjustedSeniorityDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  leaves: z.array(z.object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    affectsSeniority: z.boolean(),
    adjustmentDays: z.number().int().min(0),
  })).optional(),
});

// =============================================================================
// TYPE EXPORTS
// =============================================================================

export type CreateMemberEmployment = z.infer<typeof createMemberEmploymentSchema>;
export type UpdateMemberEmployment = z.infer<typeof updateMemberEmploymentSchema>;

export type CreateEmploymentHistory = z.infer<typeof createEmploymentHistorySchema>;

export type CreateMemberLeave = z.infer<typeof createMemberLeaveSchema>;
export type UpdateMemberLeave = z.infer<typeof updateMemberLeaveSchema>;

export type CreateJobClassification = z.infer<typeof createJobClassificationSchema>;
export type UpdateJobClassification = z.infer<typeof updateJobClassificationSchema>;

export type DuesCalculationData = z.infer<typeof duesCalculationDataSchema>;
export type BulkEmploymentImport = z.infer<typeof bulkEmploymentImportSchema>;
export type SeniorityCalculation = z.infer<typeof seniorityCalculationSchema>;
