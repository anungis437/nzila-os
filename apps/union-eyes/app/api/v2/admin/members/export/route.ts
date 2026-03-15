/**
 * GET /api/admin/members/export
 * → Django: /api/auth_core/organization-members/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' as const },
    openapi: {
      tags: ['Admin', 'Django Proxy'],
      summary: 'GET export',
      description: 'Proxied to Django: /api/auth_core/organization-members/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/');
    return response;
  },
);
