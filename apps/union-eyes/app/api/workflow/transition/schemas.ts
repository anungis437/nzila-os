import { z } from 'zod'

export const transitionTargetStatuses = [
  'submitted',
  'under_review',
  'assigned',
  'investigation',
  'pending_documentation',
  'resolved',
  'rejected',
  'closed',
] as const

export const transitionSchema = z.object({
  claimNumber: z.string().min(1).max(100),
  targetStatus: z.enum(transitionTargetStatuses),
  notes: z.string().max(5000).optional(),
})
