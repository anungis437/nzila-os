import { NextResponse } from 'next/server';
/**
 * GET /api/feature-flags
 * Migrated to withApi() framework
 */
import { evaluateFeatures, LRO_FEATURES } from '@/lib/services/feature-flags';
 
 
 
 
import { withApi } from '@/lib/api/framework';

export const GET = withApi(
  {
    auth: { required: true },
    openapi: {
      tags: ['Feature-flags'],
      summary: 'GET feature-flags',
    },
  },
  async ({ request: _request, userId, organizationId, user: _user, body: _body, query: _query }) => {

        // Evaluate all LRO features for this user
        const featureNames = Object.values(LRO_FEATURES);
        const flags = await evaluateFeatures(featureNames, {
          userId: userId ?? undefined,
          organizationId: organizationId ?? undefined,
        });
        return NextResponse.json({
          flags,
          userId,
          organizationId: organizationId || null,
        });
  },
);
