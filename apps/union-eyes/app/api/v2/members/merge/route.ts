/**
 * POST /api/members/merge
 * → Django: /api/auth_core/organization-members/merge/
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
      summary: 'POST merge',
      description: 'Proxied to Django: /api/auth_core/organization-members/merge/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/merge/', { method: 'POST' });
    return response;
  },
);
