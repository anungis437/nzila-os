/**
 * GET /api/health
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
      tags: ['Health', 'Django Proxy'],
      summary: 'GET health',
      description: 'Proxied to Django: /api/auth_core/health/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/health/');
    return response;
  },
);
