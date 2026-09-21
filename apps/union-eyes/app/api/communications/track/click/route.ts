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

// Neutral, fail-closed rejection for click links that cannot be verified. It does
// NOT redirect to the caller-supplied url: the only way to obtain a redirect from
// this endpoint is a token whose signature is bound to that exact destination, so
// a forged or unsigned link can never turn this route into an open redirect
// (TRACKING_CLICK_OPEN_REDIRECT = NO).
function linkRejectionResponse(): NextResponse {
  return NextResponse.json({ error: 'This link could not be verified' }, { status: 400 });
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

  if (!requireOrgAccess(request)) {
    return linkRejectionResponse();
  }

  if (!campaignId || !recipientId) {
    return linkRejectionResponse();
  }

  // The redirect destination is bound into every candidate payload, so a valid
  // token proves the platform signed a link to exactly this destination.
  const tokenCandidates = [
    `${campaignId}:${recipientId}:${redirectTarget}`,
    ...(messageId ? [`${campaignId}:${recipientId}:${messageId}:${redirectTarget}`] : []),
  ];

  // Fail closed: a missing/placeholder secret (configuration_missing) or a
  // forged/absent token (invalid) records nothing AND performs no attacker-
  // controlled redirect. Only a valid, destination-bound token redirects.
  const verification = verifyTrackingToken(token, tokenCandidates);
  if (verification !== 'valid') {
    logger.warn('[communications/click-track] Tracking token not authorized', {
      campaignId,
      recipientId,
      hasMessageId: Boolean(messageId),
      reason: verification,
    });
    return linkRejectionResponse();
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
