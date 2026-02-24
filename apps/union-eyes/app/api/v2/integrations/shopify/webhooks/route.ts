/**
 * GET POST /api/integrations/shopify/webhooks
 * Migrated to withApi() framework
 */

import { withApi, RATE_LIMITS } from '@/lib/api/framework';

 
 
import { GET as v1GET, POST as v1POST } from '@/app/api/integrations/shopify/webhooks/route';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Integrations'],
      summary: 'GET webhooks',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    rateLimit: RATE_LIMITS.WEBHOOK_CALLS,
    openapi: {
      tags: ['Integrations'],
      summary: 'POST webhooks',
    },
  },
  async ({ request, params: _params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);
