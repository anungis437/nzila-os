/**
 * GET PATCH DELETE /api/bargaining-notes/[id]
 * → Django: /api/bargaining/bargaining-notes/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining-notes', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-notes/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-notes/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining-notes', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-notes/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-notes/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Bargaining-notes', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/bargaining/bargaining-notes/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-notes/', { method: 'DELETE' });
    return response;
  },
);
