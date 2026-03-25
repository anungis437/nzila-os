/**
 * Contract Line Items (Clauses) API
 *
 * GET /api/contracts/[id]/clauses — List line items for a contract
 */

import { withApi, ApiError } from '@/lib/api/framework';
import { getContractLineItems } from '@/services/platform-economics';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    openapi: {
      tags: ['Contracts'],
      summary: 'List line items (clauses) for a commercial contract',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const id = (params as Record<string, string>)?.id;
    if (!id) throw ApiError.badRequest('Contract ID is required');
    const lineItems = await getContractLineItems(id);
    return { lineItems };
  },
);
