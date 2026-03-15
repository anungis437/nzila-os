/**
 * POST /api/v2/notifications/mark-all-read
 * Deprecated — use /api/notifications/mark-all-read instead (DB-backed).
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications', 'Django Proxy'],
      summary: 'POST mark-all-read (v2, deprecated)',
      description: 'Deprecated — use /api/notifications/mark-all-read.',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/notifications/in-app-notifications/', { method: 'POST' });
    return response;
  },
);
