/**
 * GET POST /api/members/[id]/claims
 * → Django: /api/grievances/claims/?member_id=
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
      summary: 'GET claims',
      description: 'Proxied to Django: /api/grievances/claims/?member_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/?member_id=');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'POST claims',
      description: 'Proxied to Django: /api/grievances/claims/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/', { method: 'POST' });
    return response;
  },
);
