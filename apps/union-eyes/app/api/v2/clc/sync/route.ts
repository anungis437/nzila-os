/**
 * GET POST /api/clc/sync
 * → Django: /api/billing/clc-sync-log/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clc', 'Django Proxy'],
      summary: 'GET sync',
      description: 'Proxied to Django: /api/billing/clc-sync-log/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/clc-sync-log/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clc', 'Django Proxy'],
      summary: 'POST sync',
      description: 'Proxied to Django: /api/billing/clc-sync-log/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/clc-sync-log/', { method: 'POST' });
    return response;
  },
);
