/**
 * GET POST /api/onboarding
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over the pre-signup pending-profiles table, which the governance policy denies, while the onboarding form posts to it (so every submission was refused). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'support_agent' },
    openapi: {
      tags: ['Auth'],
      summary: '/api/onboarding (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/onboarding is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
