/**
 * GET PATCH DELETE /api/locals/[id]
 * → Django: /api/unions/bargaining-units/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Locals', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Locals', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Locals', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/bargaining-units/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/bargaining-units/', { method: 'DELETE' });
    return response;
  },
);
