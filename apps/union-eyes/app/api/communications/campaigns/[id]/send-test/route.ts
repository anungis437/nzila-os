/**
 * POST /api/communications/campaigns/:id/send-test (UE-ACTION-CAMPAIGN-SEND, DEF-0B5-COMMS-CAMPAIGN-
 * DETACHED-FROM-CONSENT-AND-DELIVERY).
 *
 * Sends the campaign's own content, unmodified, to ONE caller-supplied test address - never to the
 * campaign's real audience and never through its (unbuilt) segment resolution. No campaign status,
 * scheduledAt or stats field changes: this proves the content and the provider work, nothing more.
 * A campaign with only a linked template and no inline subject/body uses the template's own content;
 * a campaign with neither is refused rather than silently sending something empty. Template
 * {{variable}} substitution is not implemented - raw content is sent as-is.
 *
 * GET/PATCH/DELETE still answer 501: this path is a send action, not a resource with those semantics.
 */
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { campaigns, messageTemplates } from '@/db/schema';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { sendEmail, isValidEmail } from '@/lib/email-service';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const sendTestBody = z.object({ testEmail: z.string().email() }).strict();

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: sendTestBody,
    openapi: { tags: ['Notifications'], summary: 'Send a campaign test message to one explicit address' },
  },
  async ({ organizationId, userId, params, body: input }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization membership required');
    if (!isValidEmail(input.testEmail)) throw ApiError.badRequest('testEmail is not a valid address');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [campaign] = await tx
        .select({
          id: campaigns.id,
          channel: campaigns.channel,
          subject: campaigns.subject,
          body: campaigns.body,
          templateId: campaigns.templateId,
        })
        .from(campaigns)
        .where(and(eq(campaigns.id, params.id), eq(campaigns.organizationId, organizationId)))
        .limit(1);
      if (!campaign) throw ApiError.notFound('Campaign not found');
      if (campaign.channel !== 'email') {
        throw ApiError.badRequest(`send-test does not yet support the ${campaign.channel} channel`);
      }

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
      if (!subject || !html) throw ApiError.badRequest('Campaign has no subject/body content to send (directly or via its template)');

      const result = await sendEmail({
        to: [{ email: input.testEmail, name: input.testEmail }],
        subject: `[TEST] ${subject}`,
        html,
      });

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'communications.campaign.send_test',
        resourceType: 'campaigns',
        resourceId: campaign.id,
        details: { success: result.success, providerError: result.success ? undefined : result.error },
      });

      if (!result.success) throw ApiError.internal(result.error ?? 'Test send failed');
      return { data: { sent: true, testEmail: input.testEmail } };
    });
  },
);

const notImplemented = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Notifications'],
      summary: '/api/communications/campaigns/:id/send-test (not implemented)',
      description: 'Not implemented: answers 501.',
    },
  },
  async () => {
    throw ApiError.notImplemented('GET/PATCH/DELETE /api/communications/campaigns/:id/send-test are not implemented: this path is a send action.');
  },
);

export const GET = notImplemented;
export const PATCH = notImplemented;
export const DELETE = notImplemented;
