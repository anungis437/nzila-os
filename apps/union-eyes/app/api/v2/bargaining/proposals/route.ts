/**
 * GET POST /api/bargaining/proposals
 * → Django: /api/bargaining/bargaining-proposals/
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
      summary: 'GET proposals',
      description: 'Proxied to Django: /api/bargaining/bargaining-proposals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-proposals/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining', 'Django Proxy'],
      summary: 'POST proposals',
      description: 'Proxied to Django: /api/bargaining/bargaining-proposals/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/bargaining-proposals/', { method: 'POST' });
    return response;
  },
);
