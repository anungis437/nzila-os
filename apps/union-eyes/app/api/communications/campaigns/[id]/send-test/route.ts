/**
 * GET PATCH DELETE /api/communications/campaigns/:id/send-test
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over campaigns (a campaign row; no test message is sent). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: '/api/communications/campaigns/:id/send-test (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/communications/campaigns/:id/send-test is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
