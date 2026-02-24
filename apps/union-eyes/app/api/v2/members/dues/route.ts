/**
 * GET /api/members/dues
 * → Django: /api/billing/dues/
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
      summary: 'GET dues',
      description: 'Proxied to Django: /api/billing/dues/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/dues/');
    return response;
  },
);
