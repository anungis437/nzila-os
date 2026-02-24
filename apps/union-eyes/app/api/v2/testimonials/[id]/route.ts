/**
 * GET PATCH DELETE /api/testimonials/[id]
 * → Django: /api/content/public-content/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Testimonials', 'Django Proxy'],
      summary: 'GET [id]',
      description: 'Proxied to Django: /api/content/public-content/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/public-content/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Testimonials', 'Django Proxy'],
      summary: 'PATCH [id]',
      description: 'Proxied to Django: /api/content/public-content/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/public-content/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Testimonials', 'Django Proxy'],
      summary: 'DELETE [id]',
      description: 'Proxied to Django: /api/content/public-content/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/content/public-content/', { method: 'DELETE' });
    return response;
  },
);
