/**
 * GET POST /api/enterprise/dsr/requests
 * → Django: /api/auth_core/dsr/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Enterprise', 'Django Proxy'],
      summary: 'GET requests',
      description: 'Proxied to Django: /api/auth_core/dsr/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/dsr/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Enterprise', 'Django Proxy'],
      summary: 'POST requests',
      description: 'Proxied to Django: /api/auth_core/dsr/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/dsr/', { method: 'POST' });
    return response;
  },
);
