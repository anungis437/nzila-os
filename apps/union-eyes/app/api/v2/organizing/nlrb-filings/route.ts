/**
 * GET POST /api/organizing/nlrb-filings
 * → Django: /api/unions/organizing-campaigns/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizing', 'Django Proxy'],
      summary: 'GET nlrb-filings',
      description: 'Proxied to Django: /api/unions/organizing-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizing-campaigns/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Organizing', 'Django Proxy'],
      summary: 'POST nlrb-filings',
      description: 'Proxied to Django: /api/unions/organizing-campaigns/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/organizing-campaigns/', { method: 'POST' });
    return response;
  },
);
