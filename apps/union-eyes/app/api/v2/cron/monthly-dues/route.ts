/**
 * GET POST /api/cron/monthly-dues
 * → Django: /api/auth_core/health/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron', 'Django Proxy'],
      summary: 'GET monthly-dues',
      description: 'Proxied to Django: /api/auth_core/health/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/health/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cron', 'Django Proxy'],
      summary: 'POST monthly-dues',
      description: 'Proxied to Django: /api/auth_core/health/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/health/', { method: 'POST' });
    return response;
  },
);
