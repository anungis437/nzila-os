/**
 * GET POST PUT DELETE /api/social-media/campaigns
 * Migrated to withApi() framework
 */
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _socialMediaCampaignsSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  platforms: z.unknown().optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  goals: z.unknown().optional(),
  hashtags: z.unknown().optional(),
  target_audience: z.unknown().optional(),
  status: z.unknown().optional(),
});

import { GET as v1GET, POST as v1POST, PUT as v1PUT, DELETE as v1DELETE } from '@/app/api/social-media/campaigns/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Social-media'],
      summary: 'GET campaigns',
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
    rateLimit: RATE_LIMITS.CAMPAIGN_OPERATIONS,
    openapi: {
      tags: ['Social-media'],
      summary: 'POST campaigns',
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
    rateLimit: RATE_LIMITS.CAMPAIGN_OPERATIONS,
    openapi: {
      tags: ['Social-media'],
      summary: 'PUT campaigns',
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
    rateLimit: RATE_LIMITS.CAMPAIGN_OPERATIONS,
    openapi: {
      tags: ['Social-media'],
      summary: 'DELETE campaigns',
    },
  },
  async ({ request }) => {
    // Delegate to v1 handler while framework migration is in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await v1DELETE(request, {} as any);
    return response;
  },
);
