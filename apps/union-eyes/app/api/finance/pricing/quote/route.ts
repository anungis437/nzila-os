/**
 * POST /api/finance/pricing/quote — Compute a GTM pricing quote
 *
 * Pure calculation endpoint — no database writes.
 * Accepts member count, optional tier override, region details,
 * contract term, and custom discounts; returns a full quote breakdown.
 *
 * Aligned with: docs/plans/go-to-market/Draft Pricing Model.xlsx
 */

import { z } from 'zod';
import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import {
  computeQuote,
  type PricingQuoteInput,
  type DiscountRule,
} from '@/services/platform-economics/pricing-calculator';

export const dynamic = 'force-dynamic';

const discountSchema = z.object({
  type: z.enum(['volume', 'contract_term', 'early_adopter', 'partner_referral', 'custom']),
  name: z.string().min(1).max(255),
  ratePercent: z.number().min(0).max(100),
  appliesTo: z.enum(['per_member', 'base_fee', 'total']),
  memberThreshold: z.number().int().min(0).optional(),
  contractTermMinMonths: z.number().int().min(0).optional(),
});

const quoteSchema = z.object({
  memberCount: z.number().int().min(1).max(10_000_000),
  tier: z.enum(['starter', 'professional', 'premium', 'enterprise']).optional(),
  regionCount: z.number().int().min(0).max(20).optional(),
  regions: z.array(z.string().min(2).max(10)).max(20).optional(),
  contractTermMonths: z.number().int().min(1).max(120).optional(),
  contractYear: z.number().int().min(1).max(10).optional(),
  customDiscounts: z.array(discountSchema).max(10).optional(),
});

export const POST = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  try {
    await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);
  } catch (err) {
    return standardErrorResponse(ErrorCode.FORBIDDEN, err instanceof Error ? err.message : 'Entitlement required');
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = quoteSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  const input: PricingQuoteInput = {
    memberCount: parsed.data.memberCount,
    tier: parsed.data.tier,
    regionCount: parsed.data.regionCount,
    regions: parsed.data.regions,
    contractTermMonths: parsed.data.contractTermMonths,
    contractYear: parsed.data.contractYear,
    customDiscounts: parsed.data.customDiscounts as DiscountRule[] | undefined,
  };

  try {
    const quote = computeQuote(input);
    return standardSuccessResponse(quote);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Quote computation failed', error);
  }
});
