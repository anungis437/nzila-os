/**
 * GET POST /api/signatures/webhooks/docusign
 * → Django: /api/content/documents/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Signatures', 'Django Proxy'],
      summary: 'GET docusign',
      description: 'Proxied to Django: /api/content/documents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Signatures', 'Django Proxy'],
      summary: 'POST docusign',
      description: 'Proxied to Django: /api/content/documents/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/documents/', { method: 'POST' });
    return response;
  },
);
