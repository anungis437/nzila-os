/**
 * GET POST /api/mobile/sync
 * → Django: /api/auth_core/sync/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'GET sync',
      description: 'Proxied to Django: /api/auth_core/sync/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/sync/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'POST sync',
      description: 'Proxied to Django: /api/auth_core/sync/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/sync/', { method: 'POST' });
    return response;
  },
);
