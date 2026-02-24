/**
 * GET /api/admin/clc/analytics/organizations
 * → Django: /api/analytics/analytics-metrics/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Admin', 'Django Proxy'],
      summary: 'GET organizations',
      description: 'Proxied to Django: /api/analytics/analytics-metrics/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/analytics-metrics/');
    return response;
  },
);
