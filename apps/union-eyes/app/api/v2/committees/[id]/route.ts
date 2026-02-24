/**
 * GET PATCH DELETE /api/committees/[id]
 * → Django: /api/unions/committees/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Committees', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/committees/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/committees/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Committees', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/committees/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/committees/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Committees', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/committees/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/committees/', { method: 'DELETE' });
    return response;
  },
);
