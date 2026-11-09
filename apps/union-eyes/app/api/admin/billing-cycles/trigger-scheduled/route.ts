/**
 * Cross-organization billing-cycle execution is deliberately unavailable.
 * Platform identity is not a tenant-scoped financial mandate (#1116, F03).
 */
import { withApi } from '@/lib/api/framework';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

export const runtime = 'nodejs';

const notImplemented = async () => standardErrorResponse(
  ErrorCode.NOT_IMPLEMENTED,
  'Cross-organization billing-cycle execution requires an issued, live, resource-scoped financial authorization instrument; none is implemented.',
);

export const POST = withApi(
  {
    auth: { minRole: 'platform_lead' },
    openapi: { tags: ['Admin', 'Billing'], summary: 'Cross-organization billing trigger (not implemented)' },
  },
  async () => notImplemented(),
);
