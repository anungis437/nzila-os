/**
 * GET POST /api/stripe/webhooks
 * → Django: /api/billing/stripe-connect-accounts/
 * Migrated to withApi() framework
 */
import { djangoProxy } from '@/lib/django-proxy';
import { withApi } from '@/lib/api/framework';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stripe', 'Django Proxy'],
      summary: 'GET webhooks',
      description: 'Proxied to Django: /api/billing/stripe-connect-accounts/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/stripe-connect-accounts/');
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: false },
    openapi: {
      tags: ['Stripe', 'Django Proxy'],
      summary: 'POST webhooks',
      description: 'Proxied to Django: /api/billing/stripe-connect-accounts/',
    },
  },
  async ({ request }) => {
    const response = await djangoProxy(request, '/api/billing/stripe-connect-accounts/', { method: 'POST' });
    return response;
  },
);
