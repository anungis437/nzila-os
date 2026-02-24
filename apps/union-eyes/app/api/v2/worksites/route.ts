/**
 * GET POST /api/worksites
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
      summary: 'GET worksites',
      description: 'Proxied to Django: /api/unions/worksites/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/worksites/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Worksites', 'Django Proxy'],
      summary: 'POST worksites',
      description: 'Proxied to Django: /api/unions/worksites/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/worksites/', { method: 'POST' });
    return response;
  },
);
