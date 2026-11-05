/**
 * GET POST /api/integrations/api-keys
 *
 * Not implemented. This path advertises an operation of its own but was the generic CRUD factory over integration API keys, which the governance policy denies for every caller (so it refused every request). It answered with that other behaviour as though
 * it were the operation, so it now answers HTTP 501 and changes and returns nothing.
 */
import { withApi, ApiError } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

const handler = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Integrations'],
      summary: '/api/integrations/api-keys (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('/api/integrations/api-keys is not implemented: it performed no operation of its own.');
  },
);

export const GET = handler;
export const POST = handler;
