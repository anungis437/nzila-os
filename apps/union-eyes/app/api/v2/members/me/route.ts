/**
 * GET PATCH /api/members/me
 * → Django: /api/auth_core/profile/
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
      summary: 'GET me',
      description: 'Proxied to Django: /api/auth_core/profile/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/profile/');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'PATCH me',
      description: 'Proxied to Django: /api/auth_core/member-contact-preferences/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-contact-preferences/', { method: 'PATCH' });
    return response;
  },
);
