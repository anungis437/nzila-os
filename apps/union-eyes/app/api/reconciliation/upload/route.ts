/**
 * GET /api/reconciliation/upload
 *
 * Not implemented. This path advertises an operation of its own but was a list of reconciliation exceptions under an upload name (no file is received). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'officer' },
    openapi: {
      tags: ['Reconciliation'],
      summary: '/api/reconciliation/upload (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/reconciliation/upload is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
