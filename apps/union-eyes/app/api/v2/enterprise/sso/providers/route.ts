/**
 * GET POST /api/enterprise/sso/providers
 * → Django: /api/auth_core/sso/
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
      summary: 'GET providers',
      description: 'Proxied to Django: /api/auth_core/sso/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/sso/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Enterprise', 'Django Proxy'],
      summary: 'POST providers',
      description: 'Proxied to Django: /api/auth_core/sso/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/sso/', { method: 'POST' });
    return response;
  },
);
