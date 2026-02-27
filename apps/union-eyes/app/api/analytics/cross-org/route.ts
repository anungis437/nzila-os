/**
 * GET POST /api/analytics/cross-org
 * -> Django analytics: /api/analytics/analytics-metrics/
 * NOTE: auto-resolved from analytics/cross-org
 * Auto-migrated by scripts/migrate_routes.py
 * Hardened: wrapped in withApi() with admin-only auth gate
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Analytics', 'Django Proxy'],
      summary: 'Cross-org analytics metrics (GET)',
      description: 'Proxied to Django: /api/analytics/analytics-metrics/ — admin-only',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/analytics-metrics/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Analytics', 'Django Proxy'],
      summary: 'Cross-org analytics metrics (POST)',
      description: 'Proxied to Django: /api/analytics/analytics-metrics/ — admin-only',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/analytics/analytics-metrics/', { method: 'POST' });
    return response;
  },
);

