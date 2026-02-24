/**
 * GET PATCH DELETE /api/scim/v2/[organizationId]/Users
 * → Django: /api/auth_core/scim-configurations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Scim', 'Django Proxy'],
      summary: 'GET Users',
      description: 'Proxied to Django: /api/auth_core/scim-configurations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/scim-configurations/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Scim', 'Django Proxy'],
      summary: 'PATCH Users',
      description: 'Proxied to Django: /api/auth_core/scim-configurations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/scim-configurations/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Scim', 'Django Proxy'],
      summary: 'DELETE Users',
      description: 'Proxied to Django: /api/auth_core/scim-configurations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/scim-configurations/', { method: 'DELETE' });
    return response;
  },
);
