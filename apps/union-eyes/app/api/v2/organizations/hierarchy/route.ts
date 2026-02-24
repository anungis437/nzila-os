/**
 * GET /api/organizations/hierarchy
 * → Django: /api/unions/hierarchy/
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
      summary: 'GET hierarchy',
      description: 'Proxied to Django: /api/unions/hierarchy/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/hierarchy/');
    return response;
  },
);
