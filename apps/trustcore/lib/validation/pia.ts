/**
 * TrustCore — PIA Validation Schema
 * Zod schema for POST /api/pia request bodies.
 */
import { z } from 'zod'

export const createPiaSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  triggerType: z.enum([
    'new_system',
    'sensitive_data',
    'cross_border',
    'ai_or_automated_decision',
    'vendor_change',
    'major_change',
    'other',
  ]),
  description: z.string().max(5000).optional(),
  riskScore: z.number().int().min(0).max(100).optional(),
  mitigationPlan: z.string().max(5000).optional(),
  reviewerName: z.string().max(255).optional(),
})

export type CreatePiaInput = z.infer<typeof createPiaSchema>
