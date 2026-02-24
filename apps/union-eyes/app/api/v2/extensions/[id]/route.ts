/**
 * GET PATCH DELETE /api/extensions/[id]
 * → Django: /api/auth_core/id/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Extensions', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/auth_core/id/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/id/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Extensions', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/auth_core/id/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/id/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Extensions', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/auth_core/id/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/id/', { method: 'DELETE' });
    return response;
  },
);
