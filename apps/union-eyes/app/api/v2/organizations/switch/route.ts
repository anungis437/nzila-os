/**
 * POST /api/organizations/switch
 * → Django: /api/auth_core/organization-members/switch/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizations', 'Django Proxy'],
      summary: 'POST switch',
      description: 'Proxied to Django: /api/auth_core/organization-members/switch/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/switch/', { method: 'POST' });
    return response;
  },
);
