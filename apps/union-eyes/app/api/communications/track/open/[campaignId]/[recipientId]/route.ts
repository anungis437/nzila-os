import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { verifyTrackingToken } from '@/lib/communications/tracking-token';
import { logger } from '@/lib/logger';

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

function incrementStat(stats: any, key: string): Record<string, unknown> {
  const current =
    typeof stats === 'object' && stats !== null && !Array.isArray(stats)
      ? (stats as Record<string, unknown>)
      : {};

  const currentValue = typeof current[key] === 'number' ? current[key] : 0;
  return {
    ...current,
    [key]: currentValue + 1,
  };
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

  await withSystemContext(async () => {
    const [existing] = await db
      .select({
        id: messageLog.id,
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

    if (!existing) {
      return;
    }

    if (!existing.openedAt) {
      const nextStatus = existing.status === 'clicked' ? 'clicked' : 'opened';
      await db
        .update(messageLog)
        .set({
          status: nextStatus,
          openedAt: new Date(),
        })
        .where(eq(messageLog.id, existing.id));

      const [campaign] = await db
        .select({ stats: campaigns.stats })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (campaign) {
        await db
          .update(campaigns)
          .set({
            stats: incrementStat(campaign.stats, 'opened'),
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignId));
      }
    }
  });

  return pixelResponse();
}
