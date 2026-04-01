/**
 * GET  /api/finance/billing — Get billing account for the current org
 * POST /api/finance/billing — Create billing account
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
  createBillingAccount,
  getBillingAccount,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const createSchema = z.object({
  displayName: z.string().min(1).max(255),
  billingEmail: z.string().email(),
  billingContactName: z.string().max(255).optional(),
  billingPhone: z.string().max(50).optional(),
  billingAddress: z.object({
    line1: z.string(),
    line2: z.string().optional(),
    city: z.string(),
    province: z.string(),
    postalCode: z.string(),
    country: z.string(),
  }).optional(),
  taxId: z.string().max(50).optional(),
  netTermsDays: z.number().int().min(1).max(120).optional(),
});

export const GET = withMinRole('officer', async (_request, context: BaseAuthContext) => {
  const { organizationId, userId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);

  try {
    const account = await getBillingAccount(organizationId);
    if (!account) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'No billing account found');
    }
    return standardSuccessResponse(account);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch billing account', error);
  }
});

export const POST = withMinRole('admin', async (request, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = createSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const account = await createBillingAccount({
      organizationId,
      ...parsed.data,
      createdBy: userId,
    });
    return standardSuccessResponse(account);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to create billing account', error);
  }
});
