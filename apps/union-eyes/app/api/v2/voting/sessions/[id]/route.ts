/**
 * GET PATCH DELETE /api/voting/sessions/[id]
 * → Django: /api/unions/voting-sessions/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Voting', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Voting', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Voting', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/voting-sessions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/voting-sessions/', { method: 'DELETE' });
    return response;
  },
);
