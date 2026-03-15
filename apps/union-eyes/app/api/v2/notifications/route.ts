/**
 * GET POST /api/v2/notifications
 * Deprecated — use /api/notifications instead (DB-backed).
 * Kept for backward compatibility with auth hardening.
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'GET notifications (v2, deprecated)',
      description: 'Deprecated — use /api/notifications. Proxied to Django.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST notifications (v2, deprecated)',
      description: 'Deprecated — use /api/notifications. Proxied to Django.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);
