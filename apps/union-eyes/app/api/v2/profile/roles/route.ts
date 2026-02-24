/**
 * GET POST /api/profile/roles
 * → Django: /api/auth_core/profiles/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Profile', 'Django Proxy'],
      summary: 'GET roles',
      description: 'Proxied to Django: /api/auth_core/profiles/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/profiles/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Profile', 'Django Proxy'],
      summary: 'POST roles',
      description: 'Proxied to Django: /api/auth_core/profiles/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/profiles/', { method: 'POST' });
    return response;
  },
);
