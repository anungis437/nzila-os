/**
 * GET POST /api/enterprise/integrations
 * → Django: /api/auth_core/oauth-providers/
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
      summary: 'GET integrations',
      description: 'Proxied to Django: /api/auth_core/oauth-providers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/oauth-providers/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Enterprise', 'Django Proxy'],
      summary: 'POST integrations',
      description: 'Proxied to Django: /api/auth_core/oauth-providers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/oauth-providers/', { method: 'POST' });
    return response;
  },
);
