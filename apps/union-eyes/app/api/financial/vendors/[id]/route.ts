/**
 * @deprecated Vendor routes removed — vendors table never created.
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
    logDeprecatedAccess('/api/financial/vendors/:id', request.method, CANONICAL);
    return deprecatedResponse('/api/financial/vendors/:id', CANONICAL);
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
