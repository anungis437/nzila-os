/**
 * GET PATCH DELETE /api/case-studies/[slug]
 * → Django: /api/grievances/slug/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Case-studies', 'Django Proxy'],
      summary: 'GET [slug]',
      description: 'Proxied to Django: /api/grievances/slug/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/slug/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Case-studies', 'Django Proxy'],
      summary: 'PATCH [slug]',
      description: 'Proxied to Django: /api/grievances/slug/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/slug/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Case-studies', 'Django Proxy'],
      summary: 'DELETE [slug]',
      description: 'Proxied to Django: /api/grievances/slug/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/grievances/slug/', { method: 'DELETE' });
    return response;
  },
);
