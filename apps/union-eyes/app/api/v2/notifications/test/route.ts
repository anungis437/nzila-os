/**
 * POST /api/v2/notifications/test
 * Deprecated — use /api/notifications/test instead (DB-backed).
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST test (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/test.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);
