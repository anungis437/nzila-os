import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, inArray, ne } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, communicationPreferences, consentRecords, messageLog, newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';
import { withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { verifyTrackingToken } from '@/lib/communications/tracking-token';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

/**
 * A signed unsubscribe capability uses colon-delimited campaign/recipient
 * components. Reject delimiter injection, duplicate authority parameters and
 * oversized identifiers before signature verification or any database work.
 * The POST body is deliberately not an authority source: RFC 8058 clients
 * submit a one-click form body, while the action is authorized by the URL token.
 */
const unsubscribeTargetSchema = z.object({
  recipientId: z.string().min(1).max(256).refine(
    (value) => !/[:\s/?#\x00-\x1f]/.test(value),
    'Invalid recipient identifier',
  ),
  campaignId: z.string().min(1).max(256).refine(
    (value) => !/[:\s/?#\x00-\x1f]/.test(value),
    'Invalid campaign identifier',
  ).nullable(),
  scope: z.enum(['all']).nullable(),
  token: z.string().min(1).max(512).nullable(),
}).superRefine((target, ctx) => {
  if ((target.scope === 'all') === (target.campaignId !== null)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Exactly one unsubscribe authority scope is required',
    });
  }
});

function parseUnsubscribeTarget(request: NextRequest, recipientId: string) {
  const params = request.nextUrl.searchParams;
  // URLSearchParams.get() silently picks the first duplicate, which can make
  // proxy, mail-client and server interpretations disagree about authority.
  if (['campaignId', 'scope', 'token'].some((key) => params.getAll(key).length > 1)) {
    return null;
  }
  const parsed = unsubscribeTargetSchema.safeParse({
    recipientId,
    campaignId: params.get('campaignId'),
    scope: params.get('scope'),
    token: params.get('token'),
  });
  return parsed.success ? parsed.data : null;
}

// The unsubscribe link is a narrowly scoped capability, not a user session.
// Its signed action, campaign and recipient must all match; a recipient-only
// token must never revoke preferences across unrelated organizations.
function requireOrgAccess(token: string | null, campaignId: string | null, recipientId: string, scope: string | null) {
  // A deliberate global opt-out uses a separate, explicitly signed action.
  // The legacy recipient-only :unsubscribe token cannot authorize all-org writes.
  const payload = scope === 'all'
    ? `${recipientId}:unsubscribe-all`
    : `${campaignId}:${recipientId}:unsubscribe`;
  return verifyTrackingToken(token, [payload]);
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

function confirmationHtml(locale: string): string {
  if (locale.toLowerCase() === 'fr-ca') {
    return `<!doctype html>
<html lang="fr-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Désabonnement confirmé</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;margin:0;">
<main style="max-width:640px;margin:48px auto;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
<h1 style="margin-top:0;">Désabonnement confirmé</h1>
<p>Vous ne recevrez plus les campagnes courriel de cette organisation.</p>
<p>Si vous souhaitez reprendre les communications, mettez à jour vos préférences dans votre tableau de bord.</p>
</main></body></html>`;
  }

  return `<!doctype html>
<html lang="en-CA"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Unsubscribed</title></head>
<body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f8fafc;color:#0f172a;margin:0;">
<main style="max-width:640px;margin:48px auto;padding:24px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;">
<h1 style="margin-top:0;">You are unsubscribed</h1>
<p>You will no longer receive campaign emails from this organization.</p>
<p>If you change your mind, you can re-enable communications in your dashboard preferences.</p>
</main></body></html>`;
}

async function revokeEmailForOrganization(
  tx: RLSTx,
  organizationId: string,
  recipientId: string,
  reason: string,
  campaignId: string | null,
): Promise<void> {
  const now = new Date();
  const [existingPreference] = await tx
    .select({ id: communicationPreferences.id })
    .from(communicationPreferences)
    .where(and(eq(communicationPreferences.organizationId, organizationId), eq(communicationPreferences.userId, recipientId)))
    .limit(1);

  if (existingPreference) {
    await tx
      .update(communicationPreferences)
      .set({ emailEnabled: false, globallyUnsubscribed: true, unsubscribedAt: now, unsubscribeReason: reason, updatedAt: now })
      .where(and(eq(communicationPreferences.id, existingPreference.id), eq(communicationPreferences.organizationId, organizationId)));
  } else {
    await tx.insert(communicationPreferences).values({
      organizationId,
      userId: recipientId,
      emailEnabled: false,
      globallyUnsubscribed: true,
      unsubscribedAt: now,
      unsubscribeReason: reason,
    });
  }

  // An unsubscribe also ends the recipient's subscriptions to this organization's distribution lists.
  await tx
    .update(newsletterListSubscribers)
    .set({ status: 'unsubscribed', unsubscribedAt: now })
    .where(
      and(
        eq(newsletterListSubscribers.profileId, recipientId),
        ne(newsletterListSubscribers.status, 'unsubscribed'),
        inArray(
          newsletterListSubscribers.listId,
          tx.select({ id: newsletterDistributionLists.id }).from(newsletterDistributionLists).where(eq(newsletterDistributionLists.organizationId, organizationId)),
        ),
      ),
    );

  await tx.insert(consentRecords).values({
    organizationId,
    userId: recipientId,
    consentType: 'email_marketing',
    channel: 'email',
    status: 'revoked',
    method: 'unsubscribe_link',
    metadata: { reason, campaignId },
  });
}


/**
 * Link scanners and mail clients routinely prefetch GET URLs. A GET must not
 * change consent, campaign metrics or subscriptions. The signed capability is
 * checked before showing the confirmation form, but is consumed only by POST.
 * RFC 8058 one-click clients can POST directly to the same signed URL.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ recipientId: string }> },
) {
  const { recipientId } = await context.params;
  const target = parseUnsubscribeTarget(request, recipientId);
  if (!target) {
    return new NextResponse('An explicit campaign or all-organizations unsubscribe scope is required', {
      status: 400, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const { campaignId, scope, token } = target;
  const verification = requireOrgAccess(token, campaignId, recipientId, scope);
  if (verification !== 'valid') {
    return new NextResponse('Invalid unsubscribe token', {
      status: 401, headers: { 'Cache-Control': 'no-store' },
    });
  }
  const fr = request.nextUrl.searchParams.get('locale')?.toLowerCase() === 'fr-ca';
  const global = scope === 'all';
  const title = fr ? 'Confirmer le désabonnement' : 'Confirm unsubscribe';
  const explanation = global
    ? (fr ? 'Confirmez le désabonnement des communications de toutes vos organisations associées.'
          : 'Confirm that you want to stop campaign emails from all your associated organizations.')
    : (fr ? 'Confirmez le désabonnement des communications de cette organisation.'
          : 'Confirm that you want to stop campaign emails from this organization.');
  const button = fr ? 'Confirmer' : 'Unsubscribe';
  // No token is reflected into the HTML. Without an action attribute the form
  // POSTs to the current document URL, retaining its signed query parameters.
  const html = `<!doctype html><html lang="${fr ? 'fr-CA' : 'en-CA'}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head><body style="font-family:system-ui,sans-serif;max-width:640px;margin:48px auto;padding:24px"><main><h1>${title}</h1><p>${explanation}</p><form method="post"><button type="submit">${button}</button></form></main></body></html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ recipientId: string }> },
) {
  const { recipientId } = await context.params;
  const target = parseUnsubscribeTarget(request, recipientId);
  if (!target) {
    return new NextResponse('Invalid unsubscribe target or authority scope', { status: 400 });
  }
  const { campaignId, token, scope } = target;
  // Query strings are untrusted and may contain personal information; persist
  // only the supported reason codes, never arbitrary link-supplied text.
  const requestedReason = request.nextUrl.searchParams.get('reason');
  const reason = requestedReason === 'manual' || requestedReason === 'preference_center'
    ? requestedReason : 'unsubscribe_link';
  const locale = request.nextUrl.searchParams.get('locale') || 'en-CA';

  // Only an action-bound token for this exact campaign and recipient may
  // authorize a write; open/click tokens cannot be repurposed.
  const verification = requireOrgAccess(token, campaignId, recipientId, scope);
  if (verification !== 'valid') {
    logger.warn('[communications/unsubscribe] Unsubscribe token not authorized', {
      reason: verification,
    });
    return new NextResponse('Invalid unsubscribe token', { status: 401 });
  }

  const targetFound = await withSystemContext(async (tx) => {
    if (!campaignId) {
      // Global opt-out is an explicit, separately signed recipient capability.
      // Collect organization IDs only from that recipient's preferences/lists;
      // never infer a tenant from caller-supplied organization parameters.
      const fromPreferences = await tx
        .select({ organizationId: communicationPreferences.organizationId })
        .from(communicationPreferences)
        .where(eq(communicationPreferences.userId, recipientId))
        .limit(101);
      const fromLists = await tx
        .select({ organizationId: newsletterDistributionLists.organizationId })
        .from(newsletterListSubscribers)
        .innerJoin(newsletterDistributionLists, eq(newsletterListSubscribers.listId, newsletterDistributionLists.id))
        .where(eq(newsletterListSubscribers.profileId, recipientId))
        .limit(101);
      const organizationIds = [...new Set([...fromPreferences, ...fromLists].map(row => row.organizationId))];
      // Do not silently truncate a large result or falsely acknowledge an
      // unsubscribe when there are no organization records to revoke.
      if (organizationIds.length === 0 || organizationIds.length > 100 || fromPreferences.length > 100 || fromLists.length > 100) {
        return false;
      }
      for (const orgId of organizationIds) {
        await revokeEmailForOrganization(tx, orgId, recipientId, reason, null);
      }
      return true;
    }

    const [campaign] = await tx
      .select({ id: campaigns.id, organizationId: campaigns.organizationId, stats: campaigns.stats })
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .limit(1);

    if (!campaign) return false;

    const updatedMessageRows = await tx
      .update(messageLog)
      .set({ status: 'unsubscribed' })
      .where(and(
        eq(messageLog.campaignId, campaignId),
        eq(messageLog.organizationId, campaign.organizationId),
        eq(messageLog.recipientId, recipientId),
        eq(messageLog.channelType, 'email'),
        ne(messageLog.status, 'unsubscribed'),
      ))
      .returning({ id: messageLog.id });

    if (updatedMessageRows.length > 0) {
      await tx.update(campaigns)
        .set({ stats: incrementStat(campaign.stats, 'unsubscribed'), updatedAt: new Date() })
        .where(and(eq(campaigns.id, campaignId), eq(campaigns.organizationId, campaign.organizationId)));
    }

    await revokeEmailForOrganization(tx, campaign.organizationId, recipientId, reason, campaignId);
    return true;
  });

  if (!targetFound) {
    return new NextResponse('Unsubscribe target not found or too large', { status: 404 });
  }

  return new NextResponse(confirmationHtml(locale), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
