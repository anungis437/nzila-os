/**
 * GET PATCH /api/members/[id]/preferences
 * → Django: /api/auth_core/member-contact-preferences/?user_id=
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
      summary: 'GET preferences',
      description: 'Proxied to Django: /api/auth_core/member-contact-preferences/?user_id=',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-contact-preferences/?user_id=');
    return response;
  },
);

export const PATCH = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Members', 'Django Proxy'],
      summary: 'PATCH preferences',
      description: 'Proxied to Django: /api/auth_core/member-contact-preferences/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/auth_core/member-contact-preferences/', { method: 'PATCH' });
    return response;
  },
);
