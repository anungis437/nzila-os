/**
 * GET PATCH DELETE /api/worksites/[id]
 * → Django: /api/unions/worksites/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Worksites', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/worksites/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/worksites/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Worksites', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/worksites/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/worksites/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Worksites', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/worksites/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/worksites/', { method: 'DELETE' });
    return response;
  },
);
