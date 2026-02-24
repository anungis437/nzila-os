/**
 * GET POST /api/currency/convert
 * → Django: /api/analytics/analytics-metrics/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Currency', 'Django Proxy'],
      summary: 'GET convert',
      description: 'Proxied to Django: /api/analytics/analytics-metrics/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/analytics-metrics/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Currency', 'Django Proxy'],
      summary: 'POST convert',
      description: 'Proxied to Django: /api/analytics/analytics-metrics/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/analytics-metrics/', { method: 'POST' });
    return response;
  },
);
