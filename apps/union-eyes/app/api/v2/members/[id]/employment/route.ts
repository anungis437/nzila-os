/**
 * GET PATCH /api/members/[id]/employment
 * → Django: /api/unions/member-employment/?user_id=
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
      summary: 'GET employment',
      description: 'Proxied to Django: /api/unions/member-employment/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/member-employment/?user_id=');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'PATCH employment',
      description: 'Proxied to Django: /api/auth_core/member-employment-details/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-employment-details/', { method: 'PATCH' });
    return response;
  },
);
