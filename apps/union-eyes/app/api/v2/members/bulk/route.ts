/**
 * POST /api/members/bulk
 * → Django: /api/auth_core/organization-members/bulk/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'POST bulk',
      description: 'Proxied to Django: /api/auth_core/organization-members/bulk/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/bulk/', { method: 'POST' });
    return response;
  },
);
