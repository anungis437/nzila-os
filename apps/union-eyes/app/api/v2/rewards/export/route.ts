/**
 * GET /api/rewards/export
 * → Django: /api/unions/recognition-awards/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Rewards', 'Django Proxy'],
      summary: 'GET export',
      description: 'Proxied to Django: /api/unions/recognition-awards/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/recognition-awards/');
    return response;
  },
);
