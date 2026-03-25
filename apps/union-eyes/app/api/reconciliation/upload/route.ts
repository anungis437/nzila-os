/**
 * GET /api/reconciliation/upload — List reconciliation exceptions (open/under_review)
 *
 * Upload endpoint reserved for future bank-statement file intake.
 * Currently serves as the exception list for the reconciliation dashboard.
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { listExceptions } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    openapi: {
      tags: ['Reconciliation'],
      summary: 'List reconciliation exceptions for the organization',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const statusFilter = status
      ? (status.split(',') as ('open' | 'under_review' | 'resolved' | 'written_off')[])
      : undefined;
    const exceptions = await listExceptions(organizationId, statusFilter);
    return { exceptions };
  },
);
