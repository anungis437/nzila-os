/**
 * GET /api/analytics/claims/trends
 * → Django: /api/analytics/trend-analyses/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Analytics', 'Django Proxy'],
      summary: 'GET trends',
      description: 'Proxied to Django: /api/analytics/trend-analyses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/trend-analyses/');
    return response;
  },
);
