/**
 * GET POST /api/federations
 * → Django: /api/unions/federations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Federations', 'Django Proxy'],
      summary: 'GET federations',
      description: 'Proxied to Django: /api/unions/federations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federations/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Federations', 'Django Proxy'],
      summary: 'POST federations',
      description: 'Proxied to Django: /api/unions/federations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federations/', { method: 'POST' });
    return response;
  },
);
