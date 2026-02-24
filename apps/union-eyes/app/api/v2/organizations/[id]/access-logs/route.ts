/**
 * GET /api/organizations/[id]/access-logs
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
      summary: 'GET access-logs',
      description: 'Proxied to Django: /api/auth_core/organizations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organizations/');
    return response;
  },
);
