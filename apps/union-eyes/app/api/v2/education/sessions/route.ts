/**
 * GET POST /api/education/sessions
 * → Django: /api/unions/training-courses/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Education', 'Django Proxy'],
      summary: 'GET sessions',
      description: 'Proxied to Django: /api/unions/training-courses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/training-courses/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Education', 'Django Proxy'],
      summary: 'POST sessions',
      description: 'Proxied to Django: /api/unions/training-courses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/training-courses/', { method: 'POST' });
    return response;
  },
);
