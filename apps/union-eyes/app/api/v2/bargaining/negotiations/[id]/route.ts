/**
 * GET PATCH DELETE /api/bargaining/negotiations/[id]
 * → Django: /api/bargaining/negotiations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/bargaining/negotiations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/negotiations/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/bargaining/negotiations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/negotiations/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/bargaining/negotiations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/negotiations/', { method: 'DELETE' });
    return response;
  },
);
