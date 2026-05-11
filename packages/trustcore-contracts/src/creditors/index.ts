import { z } from 'zod'

export const CreditorClassificationSchema = z.enum([
  'secured',
  'unsecured',
  'priority',
  'subordinated',
  'equity',
])
export type CreditorClassification = z.infer<typeof CreditorClassificationSchema>

export const CreditorContactSchema = z
  .object({
    email: z.string().email().optional(),
    phone: z.string().max(64).optional(),
    address: z.string().max(1024).optional(),
    representativeName: z.string().max(255).optional(),
  })
  .partial()

export const TrustOpsCreditorInputSchema = z.object({
  orgId: z.string().uuid(),
  mandateId: z.string().uuid(),
  name: z.string().min(1).max(500),
  classification: CreditorClassificationSchema,
  contact: CreditorContactSchema.optional(),
  claimAmount: z.number().nonnegative().optional(),
  approvedAmount: z.number().nonnegative().optional(),
  currency: z.string().length(3).default('CAD'),
})
export type TrustOpsCreditorInput = z.infer<typeof TrustOpsCreditorInputSchema>

export const TrustOpsCreditorRecordSchema = TrustOpsCreditorInputSchema.extend({
  id: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TrustOpsCreditorRecord = z.infer<typeof TrustOpsCreditorRecordSchema>
