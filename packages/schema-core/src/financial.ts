import { z } from 'zod'

/**
 * Canonical financial record schema — cross-app financial contracts.
 */

export const FINANCIAL_STATUS_VALUES = ['pending', 'completed', 'failed', 'reversed', 'held'] as const
export type FinancialStatus = (typeof FINANCIAL_STATUS_VALUES)[number]

export const financialRecordSchema = z.object({
  id: z.string().uuid(),
  transactionType: z.string().min(1),
  amountMinor: z.number().int(),
  currency: z.string().length(3),
  orgId: z.string().min(1),
  sourceModule: z.string().min(1),
  entityId: z.string().uuid().optional(),
  entityType: z.string().optional(),
  counterpartyId: z.string().optional(),
  provider: z.string().optional(),
  externalReference: z.string().optional(),
  status: z.enum(FINANCIAL_STATUS_VALUES),
  timestamp: z.string().datetime(),
  fiscalPeriod: z.string().optional(),
  evidenceGrade: z.boolean().default(true),
  correlationId: z.string().optional(),
  schemaVersion: z.string().default('1.0.0'),
})
export type FinancialRecord = z.infer<typeof financialRecordSchema>
