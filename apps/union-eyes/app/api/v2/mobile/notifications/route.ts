/**
 * GET POST /api/mobile/notifications
 * → Django: /api/auth_core/notifications/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'GET notifications',
      description: 'Proxied to Django: /api/auth_core/notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/notifications/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'POST notifications',
      description: 'Proxied to Django: /api/auth_core/notifications/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/notifications/', { method: 'POST' });
    return response;
  },
);
