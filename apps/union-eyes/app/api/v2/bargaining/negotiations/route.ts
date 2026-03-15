/**
 * GET POST /api/bargaining/negotiations
 * → Django: /api/bargaining/negotiations/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'GET negotiations',
      description: 'Proxied to Django: /api/bargaining/negotiations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/negotiations/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'POST negotiations',
      description: 'Proxied to Django: /api/bargaining/negotiations/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/negotiations/', { method: 'POST' });
    return response;
  },
);
