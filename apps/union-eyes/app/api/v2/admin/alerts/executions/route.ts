/**
 * GET POST /api/admin/alerts/executions
 * → Django: /api/auth_core/organization-members/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Admin', 'Django Proxy'],
      summary: 'GET executions',
      description: 'Proxied to Django: /api/auth_core/organization-members/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Admin', 'Django Proxy'],
      summary: 'POST executions',
      description: 'Proxied to Django: /api/auth_core/organization-members/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/organization-members/', { method: 'POST' });
    return response;
  },
);
