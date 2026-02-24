/**
 * GET PATCH DELETE /api/education/programs/[id]/enrollments
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
      summary: 'GET enrollments',
      description: 'Proxied to Django: /api/unions/training-courses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/training-courses/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Education', 'Django Proxy'],
      summary: 'PATCH enrollments',
      description: 'Proxied to Django: /api/unions/training-courses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/training-courses/', { method: 'PATCH' });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Education', 'Django Proxy'],
      summary: 'DELETE enrollments',
      description: 'Proxied to Django: /api/unions/training-courses/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/unions/training-courses/', { method: 'DELETE' });
    return response;
  },
);
