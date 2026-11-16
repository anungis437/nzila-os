import { z } from 'zod'

export const ASSIGNMENT_SPECIALIZATIONS = [
  'general', 'safety', 'discipline', 'scheduling', 'pay', 'benefits', 'leave',
  'harassment', 'discrimination', 'contract', 'termination', 'retaliation', 'seniority', 'policy', 'other',
] as const

export const AssignmentProfileInput = z.object({
  userId: z.guid(),
  specialization: z.enum(ASSIGNMENT_SPECIALIZATIONS),
  maxCaseload: z.number().int().min(1).max(1000),
  active: z.boolean(),
}).strict()
