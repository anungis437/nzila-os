/**
 * GET POST /api/debug/user-role
 * → Django: /api/auth_core/user-role/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Debug', 'Django Proxy'],
      summary: 'GET user-role',
      description: 'Proxied to Django: /api/auth_core/user-role/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/user-role/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Debug', 'Django Proxy'],
      summary: 'POST user-role',
      description: 'Proxied to Django: /api/auth_core/user-role/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/user-role/', { method: 'POST' });
    return response;
  },
);
