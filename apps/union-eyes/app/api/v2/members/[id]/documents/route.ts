/**
 * GET /api/members/[id]/documents
 * → Django: /api/content/documents/?user_id=
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'GET documents',
      description: 'Proxied to Django: /api/content/documents/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/?user_id=');
    return response;
  },
);
