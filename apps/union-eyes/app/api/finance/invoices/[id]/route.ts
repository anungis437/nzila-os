/**
 * GET /api/finance/invoices/[id] — Get invoice detail with line items
 */

import { withMinRole, type BaseAuthContext } from '@/lib/api-auth-guard';
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
import { getInvoiceWithLineItems } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withMinRole('officer', async (
  _request,
  context: BaseAuthContext & { params: Promise<{ id: string }> },
) => {
  const { organizationId } = context;
  if (!organizationId) {
    return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Unauthorized');
  }

  const { id } = await context.params;
  if (!id) {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invoice ID required');
  }

  try {
    const invoice = await getInvoiceWithLineItems(id);
    if (!invoice) {
      return standardErrorResponse(ErrorCode.NOT_FOUND, 'Invoice not found');
    }
    return standardSuccessResponse(invoice);
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to fetch invoice', error);
  }
});
