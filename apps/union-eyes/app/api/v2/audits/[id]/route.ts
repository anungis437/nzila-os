/**
 * GET /api/audits/[id]
 * → Django: /api/core/audit-logs/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Audits', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/core/audit-logs/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/audit-logs/');
    return response;
  },
);
