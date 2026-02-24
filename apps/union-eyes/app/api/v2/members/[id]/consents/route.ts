/**
 * GET PATCH /api/members/[id]/consents
 * → Django: /api/auth_core/member-consents/?user_id=
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
      summary: 'GET consents',
      description: 'Proxied to Django: /api/auth_core/member-consents/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-consents/?user_id=');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'PATCH consents',
      description: 'Proxied to Django: /api/auth_core/member-consents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-consents/', { method: 'PATCH' });
    return response;
  },
);
