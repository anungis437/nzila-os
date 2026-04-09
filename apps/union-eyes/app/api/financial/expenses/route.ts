/**
 * @deprecated Expense routes removed — expenses table never created.
 * Use /api/billing/reports for financial reporting.
 *
 * Phase 9 — Deprecation System
 */
import { withApi } from '@/lib/api/with-api';
import { logDeprecatedAccess, deprecatedResponse } from '@/lib/api/deprecation';

export const dynamic = 'force-dynamic';

const CANONICAL = '/api/billing/reports';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Deprecated'],
      summary: 'Deprecated — use /api/billing/reports',
      deprecated: true,
    },
  },
  async ({ request }) => {
    logDeprecatedAccess('/api/financial/expenses', request.method, CANONICAL);
    return deprecatedResponse('/api/financial/expenses', CANONICAL);
  },
);

export const GET = handler;
export const POST = handler;
