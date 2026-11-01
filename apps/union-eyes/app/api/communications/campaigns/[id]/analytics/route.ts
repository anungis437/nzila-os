/**
 * GET PATCH DELETE /api/communications/campaigns/:id/analytics
 *
 * Not implemented. This path advertises campaign analytics but was the generic campaign item route: GET returned the campaign row and no analytics, PATCH was an unvalidated update of the same row, and DELETE archived the campaign. It now answers HTTP 501 and reads and writes nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    openapi: {
      tags: ['Notifications'],
      summary: '/api/communications/campaigns/:id/analytics (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/communications/campaigns/:id/analytics is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
