/**
 * GET /api/members/[id]/history
 * → Django: /api/auth_core/member-history-events/?user_id=
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
      summary: 'GET history',
      description: 'Proxied to Django: /api/auth_core/member-history-events/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-history-events/?user_id=');
    return response;
  },
);
