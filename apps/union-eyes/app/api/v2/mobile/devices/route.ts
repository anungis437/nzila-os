/**
 * GET POST /api/mobile/devices
 * → Django: /api/auth_core/devices/
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
      summary: 'GET devices',
      description: 'Proxied to Django: /api/auth_core/devices/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/devices/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Mobile', 'Django Proxy'],
      summary: 'POST devices',
      description: 'Proxied to Django: /api/auth_core/devices/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/devices/', { method: 'POST' });
    return response;
  },
);
