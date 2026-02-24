/**
 * POST /api/onboarding/discover-federation
 * Migrated to withApi() framework
 */
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _onboardingDiscoverFederationSchema = z.object({
  province: z.string().min(1, 'province is required'),
  sector: z.unknown().optional(),
  estimatedMemberCount: z.number().int().positive(),
});

import { POST as v1POST } from '@/app/api/onboarding/discover-federation/route';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'officer' as const },
    rateLimit: RATE_LIMITS.ONBOARDING,
    openapi: {
      tags: ['Onboarding'],
      summary: 'POST discover-federation',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: Promise.resolve(params) });
    return response;
  },
);
