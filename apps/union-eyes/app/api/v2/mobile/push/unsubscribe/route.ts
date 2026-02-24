/**
 * GET POST /api/mobile/push/unsubscribe
 * → Django: /api/auth_core/push/
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
      summary: 'GET unsubscribe',
      description: 'Proxied to Django: /api/auth_core/push/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/push/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'POST unsubscribe',
      description: 'Proxied to Django: /api/auth_core/push/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/push/', { method: 'POST' });
    return response;
  },
);
