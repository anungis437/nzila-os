/**
 * GET /api/communications/campaigns/:id/schedule (UE-ACTION-CAMPAIGN-SEND, DEF-0B5-COMMS-CAMPAIGN-
 * DETACHED-FROM-CONSENT-AND-DELIVERY).
 *
 * A real, read-only audience preview: resolves every active organization member (segment-based
 * narrowing is not implemented - see lib/communications/campaign-audience.ts's header comment) and
 * evaluates each one against the platform's real communication_preferences and consent_records.
 * Never mutates anything, never sends anything, and never actually schedules a future send: no
 * dispatcher exists yet to act on one, so claiming to create a schedule here would be exactly the
 * kind of fabricated behaviour this route used to have under another name (the generic CRUD item
 * route) before it was corrected to this.
 *
 * PATCH/DELETE still answer 501: committing to and cancelling a real schedule both require that
 * dispatcher.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { campaigns } from '@/db/schema';
import { evaluateCampaignAudience } from '@/lib/communications/campaign-audience';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Notifications'], summary: 'Preview a campaign\'s real-time consent/preference-evaluated audience' },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [campaign] = await tx
        .select({ id: campaigns.id, channel: campaigns.channel })
        .from(campaigns)
        .where(and(eq(campaigns.id, params.id), eq(campaigns.organizationId, organizationId)))
        .limit(1);
      if (!campaign) throw ApiError.notFound('Campaign not found');

      const evaluation = await evaluateCampaignAudience(tx, organizationId, campaign.channel);
      return {
        data: {
          preview: true,
          scheduled: false,
          totalCandidates: evaluation.totalCandidates,
          eligibleCount: evaluation.eligible.length,
          excludedCount: evaluation.excluded.length,
          excludedSample: evaluation.excluded.slice(0, 20),
        },
      };
    });
  },
);

const notImplemented = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: '/api/communications/campaigns/:id/schedule (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('PATCH/DELETE /api/communications/campaigns/:id/schedule are not implemented: no dispatcher exists yet to act on a schedule.');
  },
);

export const PATCH = notImplemented;
export const DELETE = notImplemented;
