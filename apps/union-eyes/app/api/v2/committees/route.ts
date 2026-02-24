/**
 * GET POST /api/committees
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
      summary: 'GET committees',
      description: 'Proxied to Django: /api/unions/committees/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/committees/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Committees', 'Django Proxy'],
      summary: 'POST committees',
      description: 'Proxied to Django: /api/unions/committees/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/committees/', { method: 'POST' });
    return response;
  },
);
