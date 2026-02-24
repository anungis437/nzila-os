/**
 * GET POST /api/user/status
 * → Django: /api/auth_core/users/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['User', 'Django Proxy'],
      summary: 'GET status',
      description: 'Proxied to Django: /api/auth_core/users/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/users/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['User', 'Django Proxy'],
      summary: 'POST status',
      description: 'Proxied to Django: /api/auth_core/users/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/users/', { method: 'POST' });
    return response;
  },
);
