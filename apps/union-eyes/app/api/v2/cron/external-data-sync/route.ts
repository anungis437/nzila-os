/**
 * GET POST /api/cron/external-data-sync
 * Migrated to withApi() framework
 */

import { withApi } from '@/lib/api/framework';

import { GET as v1GET, POST as v1POST } from '@/app/api/cron/external-data-sync/route';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron'],
      summary: 'GET external-data-sync',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron'],
      summary: 'POST external-data-sync',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request);
    return response;
  },
);
