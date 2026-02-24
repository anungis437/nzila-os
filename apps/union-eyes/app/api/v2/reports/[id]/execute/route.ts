/**
 * GET PATCH DELETE /api/reports/[id]/execute
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
      summary: 'GET execute',
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
      summary: 'PATCH execute',
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
      summary: 'DELETE execute',
      description: 'Proxied to Django: /api/analytics/reports/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/reports/', { method: 'DELETE' });
    return response;
  },
);
