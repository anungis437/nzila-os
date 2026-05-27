import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

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

function incrementStat(stats: unknown, key: string): Record<string, unknown> {
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

function getSafeRedirectUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed.toString();
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const campaignId = request.nextUrl.searchParams.get('campaignId');
  const recipientId = request.nextUrl.searchParams.get('recipientId');
  const messageId = request.nextUrl.searchParams.get('messageId');
  const token = request.nextUrl.searchParams.get('token');
  const redirectTarget = getSafeRedirectUrl(request.nextUrl.searchParams.get('url'));

  if (!redirectTarget) {
    return NextResponse.json({ error: 'Missing or invalid url parameter' }, { status: 400 });
  }

  if (!campaignId || !recipientId) {
    return NextResponse.redirect(redirectTarget, { status: 302 });
  }

  const tokenCandidates = [
    `${campaignId}:${recipientId}:${redirectTarget}`,
    `${campaignId}:${recipientId}`,
    ...(messageId ? [`${campaignId}:${recipientId}:${messageId}:${redirectTarget}`] : []),
  ];

  if (!isValidTrackingToken(token, tokenCandidates)) {
    logger.warn('[communications/click-track] Invalid tracking token', {
      campaignId,
      recipientId,
      hasMessageId: Boolean(messageId),
    });
    return NextResponse.redirect(redirectTarget, { status: 302 });
  }

  await withSystemContext(async () => {
    const [existing] = await db
      .select({
        id: messageLog.id,
        clickedAt: messageLog.clickedAt,
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

    if (!existing.clickedAt) {
      const updatePayload: {
        status: 'clicked';
        clickedAt: Date;
        openedAt?: Date;
      } = {
        status: 'clicked',
        clickedAt: new Date(),
      };
      if (!existing.openedAt) {
        updatePayload.openedAt = new Date();
      }

      await db
        .update(messageLog)
        .set(updatePayload)
        .where(eq(messageLog.id, existing.id));

      const [campaign] = await db
        .select({ stats: campaigns.stats })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (campaign) {
        let nextStats = incrementStat(campaign.stats, 'clicked');
        if (existing.status !== 'opened' && existing.status !== 'clicked') {
          nextStats = incrementStat(nextStats, 'opened');
        }

        await db
          .update(campaigns)
          .set({
            stats: nextStats,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, campaignId));
      }
    }
  });

  return NextResponse.redirect(redirectTarget, { status: 302 });
}
