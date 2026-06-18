import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

function requireOrgAccess(_request: NextRequest): boolean {
  return true;
}

const PIXEL_GIF = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

function getTrackingSecret(): string {
  return process.env.COMMUNICATIONS_TRACKING_SECRET || process.env.RESEND_TRACKING_SECRET || '';
}

function signTrackingPayload(secret: string, payload: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

function isValidTrackingToken(token: string | null, candidates: string[]): boolean {
  const secret = getTrackingSecret();
  if (!secret) {
    return true;
  }
  if (!token) {
    return false;
  }

  const tokenBuffer = Buffer.from(token, 'utf8');
  return candidates.some((candidate) => {
    const expected = signTrackingPayload(secret, candidate);
    const expectedBuffer = Buffer.from(expected, 'utf8');
    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }
    return crypto.timingSafeEqual(tokenBuffer, expectedBuffer);
  });
}

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

  if (!isValidTrackingToken(token, tokenCandidates)) {
    logger.warn('[communications/open-track] Invalid tracking token', {
      campaignId,
      recipientId,
      hasMessageId: Boolean(messageId),
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
