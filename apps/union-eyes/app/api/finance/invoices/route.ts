/**
 * GET  /api/finance/invoices — List invoices for current org
 * POST /api/finance/invoices — Generate an invoice for a billing period
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
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
  billingPeriodId: z.guid(),
});

// A page size above the maximum is the maximum; a size or offset that is not a whole number in range is a client error,
// never NaN or a negative number handed to the query.
const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).default(50).transform((value) => Math.min(value, 200)),
  offset: z.coerce.number().int().min(0).default(0),
});

// The invoices are the caller organization's own: the handlers run in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    query: listQuerySchema,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'List invoices of the current organization' },
  },
  async ({ organizationId, query }) => {
    try {
      const { limit, offset } = query;
      const invoices = await getInvoices(organizationId!, limit, offset);
      return standardSuccessResponse(invoices, { total: invoices.length, limit, offset });
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch invoices', error);
    }
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Generate an invoice for a billing period' },
  },
  async ({ request, organizationId, userId }) => {
    let rawBody: any;
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
        organizationId: organizationId!,
        billingPeriodId: parsed.data.billingPeriodId,
        createdBy: userId!,
      });
      return standardSuccessResponse(invoice);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to generate invoice', error);
    }
  },
);
