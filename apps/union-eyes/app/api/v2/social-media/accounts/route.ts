/**
 * GET POST PUT DELETE /api/social-media/accounts
 * Migrated to withApi() framework
 */
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _socialMediaAccountsSchema = z.object({
  platform: z.string().min(1, 'platform is required'),
  account_id: z.string().uuid('Invalid account_id'),
});

import { GET as v1GET, POST as v1POST, PUT as v1PUT, DELETE as v1DELETE } from '@/app/api/social-media/accounts/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    openapi: {
      tags: ['Social-media'],
      summary: 'GET accounts',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1GET(request, {} as any);
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'POST accounts',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1POST(request, {} as any);
    return response;
  },
);

export const PUT = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'PUT accounts',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1PUT(request, {} as any);
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'DELETE accounts',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1DELETE(request, {} as any);
    return response;
  },
);
