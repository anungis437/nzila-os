/**
 * GET POST /api/arbitration/precedents
 * → Django: /api/bargaining/arbitration-decisions/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Arbitration', 'Django Proxy'],
      summary: 'GET precedents',
      description: 'Proxied to Django: /api/bargaining/arbitration-decisions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-decisions/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Arbitration', 'Django Proxy'],
      summary: 'POST precedents',
      description: 'Proxied to Django: /api/bargaining/arbitration-decisions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-decisions/', { method: 'POST' });
    return response;
  },
);
