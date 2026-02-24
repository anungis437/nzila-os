/**
 * GET POST /api/reports/datasources/sample
 * → Django: /api/analytics/reports/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reports', 'Django Proxy'],
      summary: 'GET sample',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reports', 'Django Proxy'],
      summary: 'POST sample',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/', { method: 'POST' });
    return response;
  },
);
