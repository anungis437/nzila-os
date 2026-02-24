/**
 * GET POST /api/gdpr/requests
 * → Django: /api/compliance/dsr-requests/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Gdpr', 'Django Proxy'],
      summary: 'GET requests',
      description: 'Proxied to Django: /api/compliance/dsr-requests/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/dsr-requests/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Gdpr', 'Django Proxy'],
      summary: 'POST requests',
      description: 'Proxied to Django: /api/compliance/dsr-requests/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/dsr-requests/', { method: 'POST' });
    return response;
  },
);
