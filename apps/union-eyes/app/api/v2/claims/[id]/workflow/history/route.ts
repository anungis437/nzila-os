/**
 * GET /api/claims/[id]/workflow/history
 * → Django: /api/grievances/claims/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Claims', 'Django Proxy'],
      summary: 'GET history',
      description: 'Proxied to Django: /api/grievances/claims/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/claims/');
    return response;
  },
);
