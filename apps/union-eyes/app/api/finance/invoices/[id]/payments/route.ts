/**
 * GET  /api/finance/invoices/[id]/payments — List payments for an invoice
 * POST /api/finance/invoices/[id]/payments — Record a payment
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
  getPayments,
  recordPayment,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
  amount: z.string().regex(/^\d+\.\d{2}$/, 'Amount must be in CAD format (e.g. "1234.56")'),
  method: z.enum(['eft', 'wire', 'cheque', 'ach', 'credit_card', 'pad', 'other']),
  externalReference: z.string().max(255).optional(),
});

export const GET = withMinRole('officer', async (
  _request,
  context: BaseAuthContext & { params: Promise<{ id: string }> },
) => {
  const { organizationId, userId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);

  const { id: invoiceId } = await context.params;

  try {
    const payments = await getPayments(organizationId, invoiceId);
    return standardSuccessResponse(payments);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch payments', error);
  }
});

export const POST = withMinRole('admin', async (
  request,
  context: BaseAuthContext & { params: Promise<{ id: string }> },
) => {
  const { userId, organizationId } = context;
  if (!organizationId || !userId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }
  await requireEntitlement(organizationId, 'financial_intelligence_suite', userId);

  const { id: invoiceId } = await context.params;

  let rawBody: any;
  try {
    rawBody = await request.json();
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid JSON');
  }

  const parsed = paymentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid input', parsed.error);
  }

  try {
    const payment = await recordPayment({
      organizationId,
      invoiceId,
      amount: parsed.data.amount,
      method: parsed.data.method,
      externalReference: parsed.data.externalReference,
      createdBy: userId,
    });
    return standardSuccessResponse(payment);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to record payment', error);
  }
});
