/**
 * GET /api/organizations/[id]/analytics
 * → Django: /api/analytics/organizations/
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
      summary: 'GET analytics',
      description: 'Proxied to Django: /api/analytics/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/organizations/');
    return response;
  },
);
