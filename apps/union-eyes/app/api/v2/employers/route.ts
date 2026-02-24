/**
 * GET POST /api/employers
 * → Django: /api/unions/employers/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Employers', 'Django Proxy'],
      summary: 'GET employers',
      description: 'Proxied to Django: /api/unions/employers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/employers/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Employers', 'Django Proxy'],
      summary: 'POST employers',
      description: 'Proxied to Django: /api/unions/employers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/employers/', { method: 'POST' });
    return response;
  },
);
