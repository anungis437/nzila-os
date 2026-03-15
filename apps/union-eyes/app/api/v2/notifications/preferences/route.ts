/**
 * GET POST /api/v2/notifications/preferences
 * Deprecated — use /api/notifications/preferences instead (DB-backed).
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'GET preferences (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/preferences.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST preferences (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/preferences.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);
