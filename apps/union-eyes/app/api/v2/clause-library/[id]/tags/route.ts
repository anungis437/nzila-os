/**
 * GET PATCH DELETE /api/clause-library/[id]/tags
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
      summary: 'GET tags',
      description: 'Proxied to Django: /api/bargaining/shared-clause-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/shared-clause-library/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clause-library', 'Django Proxy'],
      summary: 'PATCH tags',
      description: 'Proxied to Django: /api/bargaining/shared-clause-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/shared-clause-library/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Clause-library', 'Django Proxy'],
      summary: 'DELETE tags',
      description: 'Proxied to Django: /api/bargaining/shared-clause-library/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/bargaining/shared-clause-library/', { method: 'DELETE' });
    return response;
  },
);
