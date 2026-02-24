/**
 * GET PATCH DELETE /api/federations/[id]/dashboard
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
      summary: 'GET dashboard',
      description: 'Proxied to Django: /api/unions/federations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federations/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Federations', 'Django Proxy'],
      summary: 'PATCH dashboard',
      description: 'Proxied to Django: /api/unions/federations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federations/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Federations', 'Django Proxy'],
      summary: 'DELETE dashboard',
      description: 'Proxied to Django: /api/unions/federations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/federations/', { method: 'DELETE' });
    return response;
  },
);
