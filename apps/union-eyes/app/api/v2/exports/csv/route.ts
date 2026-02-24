/**
 * GET POST /api/exports/csv
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
      tags: ['Exports', 'Django Proxy'],
      summary: 'GET csv',
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
      tags: ['Exports', 'Django Proxy'],
      summary: 'POST csv',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/', { method: 'POST' });
    return response;
  },
);
