/**
 * GET POST /api/organizations
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
      summary: 'GET organizations',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizations', 'Django Proxy'],
      summary: 'POST organizations',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/', { method: 'POST' });
    return response;
  },
);
