/**
 * GET /api/finance/invoices/[id] — Get invoice detail with line items
 */

import { z } from 'zod';
import { withApi } from '@/lib/api/framework';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { getInvoiceWithLineItems } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

// The invoice and its lines are the caller organization's own: the handler runs in that organization's tenant transaction.
export const GET = withApi(
  {
    auth: { minRole: 'secretary_treasurer' },
    entitlement: 'financial_intelligence_suite',
    rlsOrgContext: true,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Finance'], summary: 'Get an invoice with its line items' },
  },
  async ({ organizationId, params }) => {
    const { id } = params;
    if (!id) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invoice ID required');
    }
    if (!z.guid().safeParse(id).success) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invoice ID must be a valid id');
    }

    try {
      const invoice = await getInvoiceWithLineItems(id, organizationId!);
      if (!invoice) {
        return standardErrorResponse(ErrorCode.NOT_FOUND, 'Invoice not found');
      }
      return standardSuccessResponse(invoice);
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch invoice', error);
    }
  },
);
