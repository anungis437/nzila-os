/**
 * GET /api/analytics/insights
 * → Django: /api/analytics/insight-recommendations/
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
      summary: 'GET insights',
      description: 'Proxied to Django: /api/analytics/insight-recommendations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/insight-recommendations/');
    return response;
  },
);
