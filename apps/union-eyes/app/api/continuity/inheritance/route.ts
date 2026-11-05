/**
 * GET POST /api/continuity/inheritance
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over pending_profiles, the pre-signup profile table (no succession record exists). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'support_agent' },
    openapi: {
      tags: ['Auth'],
      summary: '/api/continuity/inheritance (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/continuity/inheritance is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
