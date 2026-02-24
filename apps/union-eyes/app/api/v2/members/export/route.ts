/**
 * GET /api/members/export
 * → Django: /api/auth_core/organization-members/export/
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
      summary: 'GET export',
      description: 'Proxied to Django: /api/auth_core/organization-members/export/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/export/');
    return response;
  },
);
