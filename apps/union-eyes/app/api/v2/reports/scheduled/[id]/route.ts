/**
 * GET PATCH DELETE /api/reports/scheduled/[id]
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
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reports', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Reports', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/', { method: 'DELETE' });
    return response;
  },
);
