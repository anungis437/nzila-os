/**
 * GET POST /api/analytics/kpis
 * → Django: /api/analytics/kpi-configurations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Analytics', 'Django Proxy'],
      summary: 'GET kpis',
      description: 'Proxied to Django: /api/analytics/kpi-configurations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/kpi-configurations/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Analytics', 'Django Proxy'],
      summary: 'POST kpis',
      description: 'Proxied to Django: /api/analytics/kpi-configurations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/kpi-configurations/', { method: 'POST' });
    return response;
  },
);
