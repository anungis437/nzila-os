/**
 * GET  /api/finance/invoices/[id]/payments — List payments for an invoice
 * POST /api/finance/invoices/[id]/payments — Record a payment
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import {
  getInvoiceWithLineItems,
  getPayments,
  recordPayment,
} from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

const paymentSchema = z.object({
  amount: z.string()
    .regex(/^\d+\.\d{2}$/, 'Amount must be in CAD format (e.g. "1234.56")')
    .refine((value) => Number(value) > 0, 'Amount must be greater than zero'),
  method: z.enum(['eft', 'wire', 'cheque', 'ach', 'credit_card', 'pad', 'other']),
  externalReference: z.string().max(255).optional(),
});

const invoiceIdSchema = z.guid();

// The invoice and its payments are the caller organization's own: the handlers run in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'List payments of an invoice' },
  },
  async ({ organizationId, params }) => {
    const invoiceId = invoiceIdSchema.safeParse(params.id);
    if (!invoiceId.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invoice ID must be a valid id');
    }

    try {
      const payments = await getPayments(organizationId!, invoiceId.data);
      return standardSuccessResponse(payments);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch payments', error);
    }
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Record a payment against an invoice' },
  },
  async ({ request, organizationId, userId, params }) => {
    const invoiceId = invoiceIdSchema.safeParse(params.id);
    if (!invoiceId.success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invoice ID must be a valid id');
    }

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
      // An invoice that is not the caller organization's own reads as not found, never as a fault of the payment.
      const invoice = await getInvoiceWithLineItems(invoiceId.data, organizationId!);
      if (!invoice) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Invoice not found');
      }

      const payment = await recordPayment({
        organizationId: organizationId!,
        invoiceId: invoiceId.data,
        amount: parsed.data.amount,
        method: parsed.data.method,
        externalReference: parsed.data.externalReference,
        createdBy: userId!,
      });
      return standardSuccessResponse(payment);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to record payment', error);
    }
  },
);
