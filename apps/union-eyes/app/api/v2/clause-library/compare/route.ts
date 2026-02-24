/**
 * GET POST /api/clause-library/compare
 * → Django: /api/bargaining/shared-clause-library/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clause-library', 'Django Proxy'],
      summary: 'GET compare',
      description: 'Proxied to Django: /api/bargaining/shared-clause-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/shared-clause-library/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clause-library', 'Django Proxy'],
      summary: 'POST compare',
      description: 'Proxied to Django: /api/bargaining/shared-clause-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/shared-clause-library/', { method: 'POST' });
    return response;
  },
);
