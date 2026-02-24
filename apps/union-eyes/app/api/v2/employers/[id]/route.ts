/**
 * GET PATCH DELETE /api/employers/[id]
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
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/unions/employers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/employers/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Employers', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/unions/employers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/employers/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Employers', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/unions/employers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/employers/', { method: 'DELETE' });
    return response;
  },
);
