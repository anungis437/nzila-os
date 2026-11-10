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
import { createHash } from 'node:crypto';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { campaignDeliveryOutbox, campaigns, messageTemplates } from '@/db/schema';
import { evaluateCampaignAudience } from '@/lib/communications/campaign-audience';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { and, eq, inArray } from 'drizzle-orm';

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

const scheduleBody = z.object({ scheduledAt: z.string().datetime().optional() }).strict();

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: scheduleBody,
    openapi: {
      tags: ['Notifications'],
      summary: 'Freeze a consent-evaluated campaign audience and queue durable deliveries',
    },
  },
  async ({ organizationId, userId, params, body }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [campaign] = await tx
        .select({
          id: campaigns.id,
          channel: campaigns.channel,
          status: campaigns.status,
          subject: campaigns.subject,
          body: campaigns.body,
          templateId: campaigns.templateId,
          updatedAt: campaigns.updatedAt,
        })
        .from(campaigns)
        .where(and(eq(campaigns.id, params.id), eq(campaigns.organizationId, organizationId)))
        .limit(1)
        .for('update');
      if (!campaign) throw ApiError.notFound('Campaign not found');
      if (!['draft', 'paused', 'failed'].includes(campaign.status)) {
        throw ApiError.conflict(`Campaign cannot be scheduled from ${campaign.status}`);
      }
      if (campaign.channel !== 'email') throw ApiError.badRequest('Only email campaign delivery is currently qualified');

      let subject = campaign.subject;
      let html = campaign.body;
      if ((!subject || !html) && campaign.templateId) {
        const [template] = await tx
          .select({ subject: messageTemplates.subject, htmlContent: messageTemplates.htmlContent, body: messageTemplates.body })
          .from(messageTemplates)
          .where(and(eq(messageTemplates.id, campaign.templateId), eq(messageTemplates.organizationId, organizationId)))
          .limit(1);
        subject = subject ?? template?.subject ?? null;
        html = html ?? template?.htmlContent ?? template?.body ?? null;
      }
      if (!subject || !html) throw ApiError.badRequest('Campaign has no sendable subject/body');

      const evaluation = await evaluateCampaignAudience(tx, organizationId, campaign.channel);
      const audienceVersion = createHash('sha256')
        .update(JSON.stringify({
          campaignId: campaign.id,
          updatedAt: campaign.updatedAt.toISOString(),
          subject,
          html,
          recipients: evaluation.eligible.map((r) => r.userId).sort(),
        }))
        .digest('hex');

      if (evaluation.eligible.length > 0) {
        await tx.insert(campaignDeliveryOutbox).values(evaluation.eligible.map((recipient) => ({
          organizationId,
          campaignId: campaign.id,
          audienceVersion,
          recipientId: recipient.userId,
          recipientEmail: recipient.email,
          channel: 'email' as const,
          contentSnapshot: { subject, html },
          status: 'queued',
          scheduledAt,
          nextAttemptAt: scheduledAt,
        }))).onConflictDoNothing();
      }

      await tx
        .update(campaigns)
        .set({
          status: 'scheduled',
          scheduledAt,
          audienceCount: evaluation.eligible.length,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(and(eq(campaigns.id, campaign.id), eq(campaigns.organizationId, organizationId)));
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'communications.campaign.scheduled',
        resourceType: 'campaigns',
        resourceId: campaign.id,
        details: {
          audienceVersion,
          eligibleCount: evaluation.eligible.length,
          excludedCount: evaluation.excluded.length,
          scheduledAt: scheduledAt.toISOString(),
        },
      });
      return { data: { scheduled: true, audienceVersion, queued: evaluation.eligible.length, excluded: evaluation.excluded.length } };
    });
  },
);

export const PATCH = POST;

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Notifications'], summary: 'Cancel queued campaign deliveries' },
  },
  async ({ organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const cancelled = await tx
        .update(campaignDeliveryOutbox)
        .set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
        .where(and(
          eq(campaignDeliveryOutbox.organizationId, organizationId),
          eq(campaignDeliveryOutbox.campaignId, params.id),
          inArray(campaignDeliveryOutbox.status, ['queued', 'retry']),
        ))
        .returning({ id: campaignDeliveryOutbox.id });
      const [campaign] = await tx
        .update(campaigns)
        .set({ status: 'cancelled', updatedBy: userId, updatedAt: new Date() })
        .where(and(eq(campaigns.id, params.id), eq(campaigns.organizationId, organizationId)))
        .returning({ id: campaigns.id });
      if (!campaign) throw ApiError.notFound('Campaign not found');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'communications.campaign.cancelled',
        resourceType: 'campaigns',
        resourceId: campaign.id,
        details: { cancelledDeliveries: cancelled.length },
      });
      return { data: { cancelled: cancelled.length } };
    });
  },
);
