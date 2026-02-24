/**
 * POST /api/whop/create-checkout
 * Migrated to withApi() framework
 */
import { withApi } from '@/lib/api/framework';

 
import { POST as v1POST } from '@/app/api/whop/create-checkout/route';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Whop'],
      summary: 'POST create-checkout',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);
