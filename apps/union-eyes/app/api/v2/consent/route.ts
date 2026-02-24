/**
 * GET POST /api/consent
 * → Django: /api/compliance/consent-records/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Consent', 'Django Proxy'],
      summary: 'GET consent',
      description: 'Proxied to Django: /api/compliance/consent-records/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/consent-records/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Consent', 'Django Proxy'],
      summary: 'POST consent',
      description: 'Proxied to Django: /api/compliance/consent-records/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/compliance/consent-records/', { method: 'POST' });
    return response;
  },
);
