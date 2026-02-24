/**
 * POST /api/claims/bulk
 * → Django: /api/grievances/claims/bulk/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Claims', 'Django Proxy'],
      summary: 'POST bulk',
      description: 'Proxied to Django: /api/grievances/claims/bulk/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/bulk/', { method: 'POST' });
    return response;
  },
);
