/**
 * GET /api/onboarding/smart-defaults
 *
 * Not implemented. This path advertises an operation of its own but was a literal table of features, integrations and limits keyed by organization type, presented as intelligent defaults that no other code defines or reads. It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Not implemented'],
      summary: '/api/onboarding/smart-defaults (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/onboarding/smart-defaults is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
