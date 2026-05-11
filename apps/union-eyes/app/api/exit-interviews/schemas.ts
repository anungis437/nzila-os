import { z } from '@/lib/api/framework'

export const createExitInterviewSchema = z.object({
  retiringEmployeeName: z.string().min(2).max(255),
  roleInUnion: z.enum(['member', 'steward', 'chief_steward', 'officer', 'admin']),
  yearsOfService: z.number().int().min(0).max(80),
  retirementReason: z.enum(['retirement', 'career_change', 'health', 'relocation', 'other']).optional(),
  title: z.string().min(5).max(500),
  summary: z.string().max(4000).optional(),
  keyLessons: z.string().min(10),
  bestPractices: z.string().optional(),
  bargainingAdvice: z.string().optional(),
  mediationAdvice: z.string().optional(),
  incomingOfficerAdvice: z.string().optional(),
  topics: z.array(z.string()).optional(),
  keyCases: z.array(z.object({ id: z.string().optional(), label: z.string(), notes: z.string().optional() })).optional(),
  containsPii: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
})

export const listQuerySchema = z.object({
  status: z.string().optional(),
  mine: z.enum(['true', 'false']).optional(),
})