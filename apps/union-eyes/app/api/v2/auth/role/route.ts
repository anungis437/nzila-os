/**
 * GET POST /api/auth/role
 * → Django: /api/auth_core/role/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Auth', 'Django Proxy'],
      summary: 'GET role',
      description: 'Proxied to Django: /api/auth_core/role/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/role/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Auth', 'Django Proxy'],
      summary: 'POST role',
      description: 'Proxied to Django: /api/auth_core/role/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/role/', { method: 'POST' });
    return response;
  },
);
