/**
 * GET POST /api/pilot/apply
 * → Django: /api/auth_core/apply/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Pilot', 'Django Proxy'],
      summary: 'GET apply',
      description: 'Proxied to Django: /api/auth_core/apply/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/apply/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Pilot', 'Django Proxy'],
      summary: 'POST apply',
      description: 'Proxied to Django: /api/auth_core/apply/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/apply/', { method: 'POST' });
    return response;
  },
);
