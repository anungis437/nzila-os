/**
 * GET /api/case-studies
 * → Django: /api/grievances/grievances/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Case-studies', 'Django Proxy'],
      summary: 'GET case-studies',
      description: 'Proxied to Django: /api/grievances/grievances/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/grievances/');
    return response;
  },
);
