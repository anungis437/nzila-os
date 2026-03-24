/**
 * Case Intake Schema
 * 
 * Server-side Zod validation for case intake submissions.
 * Maps between the CUPE vocabulary and the claims database schema.
 * 
 * PR-020: Intake Hardening + Validation + Audit Completion
 */

import { z } from 'zod';
import { getAllCaseTypeIds, getAllPriorityIds, getAllSeverityIds } from './vocabulary';

/**
 * Server-side intake request schema.
 * This validates the incoming request body from the case creation form.
 */
export const CaseIntakeRequestSchema = z.object({
  memberId: z.string().min(1, 'Member is required'),

  caseType: z.enum(
    getAllCaseTypeIds() as [string, ...string[]],
    { errorMap: () => ({ message: `Case type must be one of: ${getAllCaseTypeIds().join(', ')}` }) },
  ),

  priority: z.enum(
    getAllPriorityIds() as [string, ...string[]],
    { errorMap: () => ({ message: `Priority must be one of: ${getAllPriorityIds().join(', ')}` }) },
  ),

  severity: z.enum(
    getAllSeverityIds() as [string, ...string[]],
    { errorMap: () => ({ message: `Severity must be one of: ${getAllSeverityIds().join(', ')}` }) },
  ).optional(),

  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(300, 'Title must be at most 300 characters'),

  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must be at most 5,000 characters'),

  incidentDate: z.string()
    .refine((val) => !isNaN(Date.parse(val)), 'Incident date must be a valid date')
    .refine((val) => new Date(val) <= new Date(), 'Incident date cannot be in the future'),

  location: z.string()
    .min(1, 'Location is required')
    .max(500, 'Location must be at most 500 characters'),

  witnesses: z.string().max(2000).optional(),

  desiredOutcome: z.string().max(2000).optional(),

  isAnonymous: z.boolean().optional().default(false),
});

export type CaseIntakeRequest = z.infer<typeof CaseIntakeRequestSchema>;

/**
 * Validate a case intake request and return structured errors.
 */
export function validateIntakeRequest(data: unknown): {
  success: boolean;
  data?: CaseIntakeRequest;
  errors?: Array<{ field: string; message: string }>;
} {
  const result = CaseIntakeRequestSchema.safeParse(data);

  if (result.success) {
    return { success: true, data: result.data };
  }

  const errors = result.error.issues.map((issue) => ({
    field: issue.path.join('.') || 'unknown',
    message: issue.message,
  }));

  return { success: false, errors };
}
