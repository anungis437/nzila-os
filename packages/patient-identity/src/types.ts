import { z } from 'zod'

export const MatchCandidate = z.object({
  patientId: z.string(),
  mrn: z.string().optional(),
  firstName: z.string(),
  lastName: z.string(),
  dateOfBirth: z.string(),
  organizationId: z.string(),
  siteId: z.string(),
})

export const MatchResult = z.object({
  patientId: z.string(),
  score: z.number().min(0).max(1),
  confidence: z.enum(['high', 'medium', 'low', 'no-match']),
  matchedFields: z.array(z.string()),
})

export const DuplicateGroup = z.object({
  primaryPatientId: z.string(),
  duplicatePatientIds: z.array(z.string()),
  detectedAt: z.string(),
  reviewStatus: z.enum(['pending', 'reviewed', 'resolved']),
})

export type MatchCandidate = z.infer<typeof MatchCandidate>
export type MatchResult = z.infer<typeof MatchResult>
export type DuplicateGroup = z.infer<typeof DuplicateGroup>
