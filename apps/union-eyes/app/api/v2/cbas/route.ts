/**
 * GET POST /api/cbas
 * → Django: /api/bargaining/collective-agreements/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cbas', 'Django Proxy'],
      summary: 'GET cbas',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Cbas', 'Django Proxy'],
      summary: 'POST cbas',
      description: 'Proxied to Django: /api/bargaining/collective-agreements/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/collective-agreements/', { method: 'POST' });
    return response;
  },
);
