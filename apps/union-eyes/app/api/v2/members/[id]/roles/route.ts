/**
 * GET POST /api/members/[id]/roles
 * → Django: /api/auth_core/organization-members/?user_id=
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
      summary: 'GET roles',
      description: 'Proxied to Django: /api/auth_core/organization-members/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/?user_id=');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'POST roles',
      description: 'Proxied to Django: /api/auth_core/organization-members/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/', { method: 'POST' });
    return response;
  },
);
