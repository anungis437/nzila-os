/**
 * GET PATCH DELETE /api/stewards/[id]
 * → Django: /api/unions/steward-assignments/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stewards', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/steward-assignments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/steward-assignments/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stewards', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/steward-assignments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/steward-assignments/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stewards', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/steward-assignments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/steward-assignments/', { method: 'DELETE' });
    return response;
  },
);
