/**
 * GET POST /api/external-data
 * → Django: /api/core/external-accounts/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['External-data', 'Django Proxy'],
      summary: 'GET external-data',
      description: 'Proxied to Django: /api/core/external-accounts/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/external-accounts/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['External-data', 'Django Proxy'],
      summary: 'POST external-data',
      description: 'Proxied to Django: /api/core/external-accounts/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/external-accounts/', { method: 'POST' });
    return response;
  },
);
