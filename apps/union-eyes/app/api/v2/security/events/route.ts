/**
 * GET POST /api/security/events
 * → Django: /api/core/security-events/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Security', 'Django Proxy'],
      summary: 'GET events',
      description: 'Proxied to Django: /api/core/security-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/security-events/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Security', 'Django Proxy'],
      summary: 'POST events',
      description: 'Proxied to Django: /api/core/security-events/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/core/security-events/', { method: 'POST' });
    return response;
  },
);
