/**
 * GET /api/investigations/audit
 *
 * Not implemented. This path advertises an operation of its own but was an alias of the organization audit-log list under an investigation name (no investigation audit exists, and it listed the organization audit log). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/investigations/audit (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/investigations/audit is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
