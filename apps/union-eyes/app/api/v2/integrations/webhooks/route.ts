/**
 * GET POST /api/integrations/webhooks
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
      tags: ['Integrations', 'Django Proxy'],
      summary: 'GET webhooks',
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
      tags: ['Integrations', 'Django Proxy'],
      summary: 'POST webhooks',
      description: 'Proxied to Django: /api/auth_core/oauth-providers/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/oauth-providers/', { method: 'POST' });
    return response;
  },
);
