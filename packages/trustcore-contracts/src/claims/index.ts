import { z } from 'zod'

export const ProofOfClaimStatusSchema = z.enum([
  'submitted',
  'under_review',
  'classified',
  'admitted',
  'partially_admitted',
  'rejected',
  'withdrawn',
])
export type ProofOfClaimStatus = z.infer<typeof ProofOfClaimStatusSchema>

export const ProofOfClaimInputSchema = z.object({
  orgId: z.string().uuid(),
  mandateId: z.string().uuid(),
  creditorId: z.string().uuid(),
  submittedAt: z.string().datetime().optional(),
  /** FK → @nzila/audit evidence event id. */
  evidenceEventId: z.string().uuid().optional(),
  /** FK → @nzila/platform-decision-engine decision id. */
  classificationDecisionId: z.string().uuid().optional(),
  status: ProofOfClaimStatusSchema.default('submitted'),
  amountClaimed: z.number().nonnegative().optional(),
  amountAdmitted: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('CAD'),
  notes: z.string().max(4000).optional(),
})
export type ProofOfClaimInput = z.infer<typeof ProofOfClaimInputSchema>

export const ProofOfClaimRecordSchema = ProofOfClaimInputSchema.extend({
  id: z.string().uuid(),
  submittedAt: z.string().datetime(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type ProofOfClaimRecord = z.infer<typeof ProofOfClaimRecordSchema>
