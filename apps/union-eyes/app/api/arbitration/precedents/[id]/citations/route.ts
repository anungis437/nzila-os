/**
 * GET PATCH DELETE /api/arbitration/precedents/:id/citations
 *
 * Not implemented. This path advertises an operation of its own but was a byte-for-byte copy of the arbitration decision item route (the decision row, not its citations). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Bargaining'],
      summary: '/api/arbitration/precedents/:id/citations (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/arbitration/precedents/:id/citations is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const PATCH = handler;
export const DELETE = handler;
