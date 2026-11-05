/**
 * Unavailable union-finance routes (budgets, expenses, vendors, strike funds,
 * CLC remittances, ...).
 *
 * Either the backing table was never created or the route was bound to an
 * unrelated table. These handlers authenticate, then answer HTTP 501
 * NOT_IMPLEMENTED. They never return a 2xx payload that a client could mistake
 * for a successful financial operation, and they never point at Nzila SaaS
 * billing as an equivalent.
 */
import { withApi } from '@/lib/api/with-api';
import { logDeprecatedAccess } from '@/lib/api/deprecation';
import { capabilityNotImplementedResponse } from '@/lib/finance/financial-authority';

const DEFAULT_REASON =
  'This union finance capability has no qualified authoritative record store and is not available.';

export function retiredFinancialRoute(
  routePath: string,
  capability: string,
  reason: string = DEFAULT_REASON,
) {
  return withApi(
    {
      auth: { required: true, minRole: 'member' },
      openapi: {
        tags: ['Deprecated'],
        summary: `Not implemented — ${capability}`,
        deprecated: true,
      },
    },
    async ({ request }) => {
      logDeprecatedAccess(routePath, request.method, 'none');
      return capabilityNotImplementedResponse(capability, reason);
    },
  );
}
