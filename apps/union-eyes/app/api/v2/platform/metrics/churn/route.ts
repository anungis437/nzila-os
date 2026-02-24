/**
 * GET POST /api/platform/metrics/churn
 * → Django: /api/auth_core/metrics/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Platform', 'Django Proxy'],
      summary: 'GET churn',
      description: 'Proxied to Django: /api/auth_core/metrics/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/metrics/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Platform', 'Django Proxy'],
      summary: 'POST churn',
      description: 'Proxied to Django: /api/auth_core/metrics/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/metrics/', { method: 'POST' });
    return response;
  },
);
