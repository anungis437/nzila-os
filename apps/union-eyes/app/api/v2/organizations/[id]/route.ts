/**
 * GET PATCH DELETE /api/organizations/[id]
 * → Django: /api/auth_core/organizations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizations', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizations', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizations', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/', { method: 'DELETE' });
    return response;
  },
);
