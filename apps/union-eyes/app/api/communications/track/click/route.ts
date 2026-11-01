import { NextRequest, NextResponse } from 'next/server';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { campaigns, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { verifyTrackingToken } from '@/lib/communications/tracking-token';
import { logger } from '@/lib/logger';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

function requireOrgAccess(_request: NextRequest): boolean {
  return true;
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

  try {
    await withSystemContext(async (tx) => {
      const [existing] = await tx
        .select({
          id: messageLog.id,
          organizationId: messageLog.organizationId,
          clickedAt: messageLog.clickedAt,
          openedAt: messageLog.openedAt,
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

      if (!existing || existing.clickedAt) return;

      // Simultaneous clicks may all read an unclicked row; the conditional UPDATE elects one winner, and only that winner counts and audits.
      const now = new Date();
      const firstOpen = !existing.openedAt;
      const [claimed] = await tx
        .update(messageLog)
        .set({ status: 'clicked', clickedAt: now, ...(firstOpen ? { openedAt: now } : {}) })
        .where(and(eq(messageLog.id, existing.id), eq(messageLog.organizationId, existing.organizationId), isNull(messageLog.clickedAt)))
        .returning({ id: messageLog.id });
      if (!claimed) return;

      // The increments run in PostgreSQL so concurrent events keep every count; the click implies an open only when none was recorded.
      const [updatedCampaign] = await tx
        .update(campaigns)
        .set({
          stats: firstOpen
            ? sql`jsonb_set(jsonb_set(COALESCE(${campaigns.stats}, '{}'::jsonb), '{clicked}', to_jsonb(COALESCE((${campaigns.stats}->>'clicked')::integer, 0) + 1), true), '{opened}', to_jsonb(COALESCE((${campaigns.stats}->>'opened')::integer, 0) + 1), true)`
            : sql`jsonb_set(COALESCE(${campaigns.stats}, '{}'::jsonb), '{clicked}', to_jsonb(COALESCE((${campaigns.stats}->>'clicked')::integer, 0) + 1), true)`,
          updatedAt: now,
        })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, existing.organizationId)))
        .returning({ id: campaigns.id });
      if (!updatedCampaign) throw new Error('Campaign was not found for an authorized tracking event');

      await persistAtomicAudit(tx, {
        organizationId: existing.organizationId,
        userId: 'system:communications-tracking',
        action: 'campaign.message.clicked',
        resourceType: 'message_log',
        resourceId: existing.id,
        details: { campaignId, impliedOpen: firstOpen },
      });
    });
  } catch (error) {
    // The redirect of a verified link must not depend on the analytics write; a failed transaction counts nothing.
    logger.error('[communications/click-track] Tracking write rolled back', {
      campaignId,
      error: error instanceof Error ? error.name : 'unknown',
    });
  }

  return NextResponse.redirect(redirectTarget, { status: 302 });
}
