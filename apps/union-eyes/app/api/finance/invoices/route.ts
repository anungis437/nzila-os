/**
 * GET  /api/finance/invoices — List invoices for current org
 * POST /api/finance/invoices — Generate an invoice for a billing period
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
  getInvoices,
  generateInvoice,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const generateSchema = z.object({
  billingPeriodId: z.string().uuid(),
});

export const GET = withMinRole('officer', async (request, context: BaseAuthContext) => {
  const { organizationId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  await requireEntitlement(organizationId, 'financial_intelligence_suite', context.userId);

  try {
    const url = new URL(request.url);
    const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '50', 10), 200);
    const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);
    const invoices = await getInvoices(organizationId, limit);
    return standardSuccessResponse(invoices, { total: invoices.length, limit, offset });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch invoices', error);
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

  const parsed = generateSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const invoice = await generateInvoice({
      organizationId,
      billingPeriodId: parsed.data.billingPeriodId,
      createdBy: userId,
    });
    return standardSuccessResponse(invoice);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to generate invoice', error);
  }
});
