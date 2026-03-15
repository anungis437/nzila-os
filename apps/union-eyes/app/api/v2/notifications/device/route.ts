/**
 * POST DELETE /api/v2/notifications/device
 * Deprecated — use /api/notifications/device instead (DB-backed).
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST device (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/device.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'DELETE device (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/device.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'DELETE' });
    return response;
  },
);
