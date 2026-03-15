/**
 * GET PATCH DELETE /api/v2/notifications/[id]
 * Deprecated — use /api/notifications/[id] instead (DB-backed).
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'GET [id] (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/[id].',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'PATCH [id] (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/[id].',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'DELETE [id] (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/[id].',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'DELETE' });
    return response;
  },
);
