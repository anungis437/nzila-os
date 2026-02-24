/**
 * GET POST /api/members/segments
 * → Django: /api/unions/member-segments/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'GET segments',
      description: 'Proxied to Django: /api/unions/member-segments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/member-segments/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'POST segments',
      description: 'Proxied to Django: /api/unions/member-segments/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/member-segments/', { method: 'POST' });
    return response;
  },
);
