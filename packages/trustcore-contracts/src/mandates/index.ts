import { z } from 'zod'
import { TrustOpsMandateStageSchema } from '../fsm/index'

export const TrustOpsMandateTypeSchema = z.enum([
  'restructuring',
  'liquidation',
  'receivership',
  'monitoring',
  'other',
])
export type TrustOpsMandateType = z.infer<typeof TrustOpsMandateTypeSchema>

export const TrustOpsDebtorSchema = z.object({
  legalName: z.string().min(1).max(500),
  tradeName: z.string().max(500).optional(),
  taxId: z.string().max(64).optional(),
  jurisdiction: z.string().max(64).optional(),
  industry: z.string().max(128).optional(),
  contact: z
    .object({
      email: z.string().email().optional(),
      phone: z.string().max(64).optional(),
      address: z.string().max(1024).optional(),
    })
    .partial()
    .optional(),
})
export type TrustOpsDebtor = z.infer<typeof TrustOpsDebtorSchema>

export const TrustOpsMandateInputSchema = z.object({
  orgId: z.string().uuid(),
  mandateNumber: z.string().min(1).max(64),
  mandateType: TrustOpsMandateTypeSchema,
  debtor: TrustOpsDebtorSchema,
  trusteeUserId: z.string().min(1),
  openedAt: z.string().datetime().optional(),
})
export type TrustOpsMandateInput = z.infer<typeof TrustOpsMandateInputSchema>

export const TrustOpsMandateRecordSchema = TrustOpsMandateInputSchema.extend({
  id: z.string().uuid(),
  status: TrustOpsMandateStageSchema,
  openedAt: z.string().datetime(),
  closedAt: z.string().datetime().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})
export type TrustOpsMandateRecord = z.infer<typeof TrustOpsMandateRecordSchema>
