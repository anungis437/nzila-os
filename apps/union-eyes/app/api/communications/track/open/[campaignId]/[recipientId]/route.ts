import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { verifyTrackingToken } from '@/lib/communications/tracking-token';
import { logger } from '@/lib/logger';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

function requireOrgAccess(_request: NextRequest): boolean {
  return true;
}

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function pixelResponse(): NextResponse {
  return new NextResponse(PIXEL_GIF, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ campaignId: string; recipientId: string }> },
) {
  if (!requireOrgAccess(request)) {
    return pixelResponse();
  }

  const { campaignId, recipientId } = await context.params;
  const messageId = request.nextUrl.searchParams.get('messageId');
  const token = request.nextUrl.searchParams.get('token');

  const tokenCandidates = [
    `${campaignId}:${recipientId}`,
    ...(messageId ? [`${campaignId}:${recipientId}:${messageId}`] : []),
  ];

  // Fail closed: a missing/placeholder secret (configuration_missing) or a
  // forged/absent token (invalid) must serve the neutral pixel WITHOUT recording
  // an open. Only a valid, action-bound token authorizes the analytics mutation.
  const verification = verifyTrackingToken(token, tokenCandidates);
  if (verification !== 'valid') {
    logger.warn('[communications/open-track] Tracking token not authorized', {
      campaignId,
      recipientId,
      hasMessageId: Boolean(messageId),
      reason: verification,
    });
    return pixelResponse();
  }

  try {
    await withSystemContext(async (tx) => {
      const [existing] = await tx
        .select({
          id: messageLog.id,
          organizationId: messageLog.organizationId,
          openedAt: messageLog.openedAt,
          status: messageLog.status,
        })
        .from(messageLog)
        .where(
          and(
            eq(messageLog.campaignId, campaignId),
            eq(messageLog.recipientId, recipientId),
            ...(messageId ? [eq(messageLog.providerMessageId, messageId)] : []),
          ),
        )
        .limit(1);

      if (!existing || existing.openedAt) return;

      // Two simultaneous pixel requests may both read unopened. The conditional
      // UPDATE elects exactly one winner; only that winner changes counters or audits.
      const [claimed] = await tx
        .update(messageLog)
        .set({
          status: existing.status === 'clicked' ? 'clicked' : 'opened',
          openedAt: new Date(),
        })
        .where(
          and(
            eq(messageLog.id, existing.id),
            eq(messageLog.organizationId, existing.organizationId),
            isNull(messageLog.openedAt),
          ),
        )
        .returning({ id: messageLog.id });
      if (!claimed) return;

      // Increment in PostgreSQL, not in JavaScript after reading a stale JSON
      // snapshot. Preserve other counters and do not lose concurrent clicks.
      const [updatedCampaign] = await tx
        .update(campaigns)
        .set({
          stats: sql`jsonb_set(
            COALESCE(${campaigns.stats}, '{}'::jsonb),
            '{opened}',
            to_jsonb(COALESCE((${campaigns.stats}->>'opened')::integer, 0) + 1),
            true
          )`,
          updatedAt: new Date(),
        })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, existing.organizationId)))
        .returning({ id: campaigns.id });
      if (!updatedCampaign) throw new Error('Campaign was not found for an authorized tracking event');

      // The message transition, campaign counter and audit are one transaction.
      // If the audit or any other write fails, none of the three is committed.
      await persistAtomicAudit(tx, {
        organizationId: existing.organizationId,
        userId: 'system:communications-tracking',
        action: 'campaign.message.opened',
        resourceType: 'message_log',
        resourceId: existing.id,
        details: { campaignId },
      });
    });
  } catch (error) {
    // Email rendering must remain neutral. A failed transaction is not counted.
    logger.error('[communications/open-track] Tracking write rolled back', {
      campaignId,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }

  return pixelResponse();
}
