/**
 * GET /api/organizations/tree
 * → Django: /api/unions/hierarchy/tree/
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
      summary: 'GET tree',
      description: 'Proxied to Django: /api/unions/hierarchy/tree/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/hierarchy/tree/');
    return response;
  },
);
