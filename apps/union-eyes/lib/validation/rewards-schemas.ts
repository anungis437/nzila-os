/**
 * Recognition & Rewards - Zod Validation Schemas
 * Input validation for API routes and server actions
 */

import { z } from 'zod';
import { partialWithoutDefaults } from './partial-without-defaults';

// =====================================================
// Program Schemas
// =====================================================

export const createProgramSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  status: z.enum(['draft', 'active', 'archived']).default('draft'),
  currency: z.string().length(3).default('CAD'),
});

export const updateProgramSchema = partialWithoutDefaults(createProgramSchema);

// =====================================================
// Award Type Schemas
// =====================================================

export const createAwardTypeSchema = z.object({
  programId: z.guid(),
  name: z.string().min(1).max(255),
  kind: z.enum(['milestone', 'peer', 'admin', 'automated']),
  defaultCreditAmount: z.number().int().positive(),
  requiresApproval: z.boolean().default(false),
  rulesJson: z.record(z.string(), z.any()).optional(),
});

export const updateAwardTypeSchema = partialWithoutDefaults(createAwardTypeSchema).omit({ programId: true });

// =====================================================
// Award Schemas
// =====================================================

export const createAwardSchema = z.object({
  programId: z.guid(),
  awardTypeId: z.guid(),
  recipientUserId: z.string().min(1).max(255),
  reason: z.string().min(1),
  metadataJson: z.record(z.string(), z.any()).optional(),
});

export const approveAwardSchema = z.object({
  awardId: z.guid(),
});

export const issueAwardSchema = z.object({
  awardId: z.guid(),
});

export const revokeAwardSchema = z.object({
  awardId: z.guid(),
  reason: z.string().min(1),
});

export const rejectAwardSchema = z.object({
  awardId: z.guid(),
  reason: z.string().min(1),
});

// =====================================================
// Budget Schemas
// =====================================================

const budgetEnvelopeBaseSchema = z.object({
  programId: z.guid(),
  name: z.string().min(1).max(255),
  scopeType: z.enum(['org', 'local', 'department', 'manager']).default('org'),
  scopeRefId: z.string().max(255).optional(),
  period: z.enum(['monthly', 'quarterly', 'annual']),
  amountLimit: z.number().int().positive(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

export const createBudgetEnvelopeSchema = budgetEnvelopeBaseSchema.refine(
  (data) => new Date(data.endsAt) > new Date(data.startsAt),
  {
    message: 'End date must be after start date',
    path: ['endsAt'],
  }
);

export const updateBudgetEnvelopeSchema = partialWithoutDefaults(budgetEnvelopeBaseSchema);

// =====================================================
// Redemption Schemas
// =====================================================

export const initiateRedemptionSchema = z.object({
  programId: z.guid(),
  creditsToSpend: z.number().int().positive(),
  providerDetails: z.record(z.string(), z.any()).optional(),
});

export const cancelRedemptionSchema = z.object({
  redemptionId: z.guid(),
  reason: z.string().min(1),
});

// =====================================================
// Query Schemas
// =====================================================

export const paginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  offset: z.coerce.number().int().nonnegative().default(0),
});

export const awardStatusQuerySchema = z.object({
  statuses: z.array(z.enum(['pending', 'approved', 'issued', 'rejected', 'revoked'])).default(['pending']),
  ...paginationSchema.shape,
});

export const reportQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  programId: z.guid().optional(),
});

// =====================================================
// Shopify Config Schemas
// =====================================================

export const updateShopifyConfigSchema = z.object({
  shopDomain: z.string().min(1).max(255),
  storefrontTokenSecretRef: z.string().min(1).max(255),
  adminTokenSecretRef: z.string().max(255).optional(),
  allowedCollections: z.array(z.string()).default([]),
  webhookSecretRef: z.string().min(1).max(255),
});

// =====================================================
// Type Exports
// =====================================================

export type CreateProgramInput = z.infer<typeof createProgramSchema>;
export type UpdateProgramInput = z.infer<typeof updateProgramSchema>;
export type CreateAwardTypeInput = z.infer<typeof createAwardTypeSchema>;
export type UpdateAwardTypeInput = z.infer<typeof updateAwardTypeSchema>;
export type CreateAwardInput = z.infer<typeof createAwardSchema>;
export type ApproveAwardInput = z.infer<typeof approveAwardSchema>;
export type IssueAwardInput = z.infer<typeof issueAwardSchema>;
export type RevokeAwardInput = z.infer<typeof revokeAwardSchema>;
export type RejectAwardInput = z.infer<typeof rejectAwardSchema>;
export type CreateBudgetEnvelopeInput = z.infer<typeof createBudgetEnvelopeSchema>;
export type UpdateBudgetEnvelopeInput = z.infer<typeof updateBudgetEnvelopeSchema>;
export type InitiateRedemptionInput = z.infer<typeof initiateRedemptionSchema>;
export type CancelRedemptionInput = z.infer<typeof cancelRedemptionSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
export type AwardStatusQueryInput = z.infer<typeof awardStatusQuerySchema>;
export type ReportQueryInput = z.infer<typeof reportQuerySchema>;
export type UpdateShopifyConfigInput = z.infer<typeof updateShopifyConfigSchema>;

