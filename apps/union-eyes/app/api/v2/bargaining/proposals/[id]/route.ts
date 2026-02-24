/**
 * GET PATCH DELETE /api/bargaining/proposals/[id]
 * → Django: /api/bargaining/bargaining-proposals/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-proposals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-proposals/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-proposals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-proposals/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-proposals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-proposals/', { method: 'DELETE' });
    return response;
  },
);
