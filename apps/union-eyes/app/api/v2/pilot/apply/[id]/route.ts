/**
 * GET PATCH DELETE /api/pilot/apply/[id]
 * → Django: /api/auth_core/apply/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Pilot', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/auth_core/apply/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/apply/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Pilot', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/auth_core/apply/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/apply/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Pilot', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/auth_core/apply/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/apply/', { method: 'DELETE' });
    return response;
  },
);
