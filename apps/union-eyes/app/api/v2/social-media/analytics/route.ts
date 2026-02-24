/**
 * GET POST PUT DELETE /api/social-media/analytics
 * Migrated to withApi() framework
 */
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _socialMediaAnalyticsSchema = z.object({
  platform: z.unknown().optional(),
  campaign_id: z.string().uuid('Invalid campaign_id'),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  limit: z.unknown().optional().default(50),
  offset: z.unknown().optional().default(0),
});

import { GET as v1GET, POST as v1POST, PUT as v1PUT, DELETE as v1DELETE } from '@/app/api/social-media/analytics/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Social-media'],
      summary: 'GET analytics',
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
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'POST analytics',
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
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'PUT analytics',
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
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'DELETE analytics',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1DELETE(request, {} as any);
    return response;
  },
);
