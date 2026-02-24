/**
 * GET PATCH DELETE /api/arbitration/precedents/[id]/citations
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
      summary: 'GET citations',
      description: 'Proxied to Django: /api/bargaining/arbitration-decisions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-decisions/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Arbitration', 'Django Proxy'],
      summary: 'PATCH citations',
      description: 'Proxied to Django: /api/bargaining/arbitration-decisions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-decisions/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Arbitration', 'Django Proxy'],
      summary: 'DELETE citations',
      description: 'Proxied to Django: /api/bargaining/arbitration-decisions/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/arbitration-decisions/', { method: 'DELETE' });
    return response;
  },
);
