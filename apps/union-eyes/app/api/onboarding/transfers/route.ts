/**
 * POST /api/onboarding/transfers
 *
 * Not implemented. This path advertises an operation of its own but was a wrapper over the onboarding events recorder behind a guard that always passes (nothing is transferred). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/onboarding/transfers (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/onboarding/transfers is not implemented: it performed no operation of its own.');
  },
);

export const POST = handler;
