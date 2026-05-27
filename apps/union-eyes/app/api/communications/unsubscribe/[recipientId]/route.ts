import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';

import { db } from '@/db';
import { campaigns, communicationPreferences, consentRecords, messageLog } from '@/db/schema';
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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ recipientId: string }> },
) {
  const { recipientId } = await context.params;
  const campaignId = request.nextUrl.searchParams.get('campaignId');
  const token = request.nextUrl.searchParams.get('token');
  const reason = request.nextUrl.searchParams.get('reason') || 'unsubscribe_link';
  const locale = request.nextUrl.searchParams.get('locale') || 'en-CA';

  const tokenCandidates = campaignId
    ? [`${campaignId}:${recipientId}:unsubscribe`, `${campaignId}:${recipientId}`]
    : [`${recipientId}:unsubscribe`];

  if (!isValidTrackingToken(token, tokenCandidates)) {
    logger.warn('[communications/unsubscribe] Invalid unsubscribe token', {
      recipientId,
      campaignId,
    });
    return new NextResponse('Invalid unsubscribe token', { status: 401 });
  }

  await withSystemContext(async () => {
    let organizationId: string | null = null;

    if (campaignId) {
      const [campaign] = await db
        .select({ id: campaigns.id, organizationId: campaigns.organizationId, stats: campaigns.stats })
        .from(campaigns)
        .where(eq(campaigns.id, campaignId))
        .limit(1);

      if (campaign) {
        organizationId = campaign.organizationId;

        const updatedMessageRows = await db
          .update(messageLog)
          .set({
            status: 'unsubscribed',
          })
          .where(
            and(
              eq(messageLog.campaignId, campaignId),
              eq(messageLog.recipientId, recipientId),
              eq(messageLog.channelType, 'email'),
              ne(messageLog.status, 'unsubscribed'),
            ),
          )
          .returning({ id: messageLog.id });

        if (updatedMessageRows.length > 0) {
          await db
            .update(campaigns)
            .set({
              stats: incrementStat(campaign.stats, 'unsubscribed'),
              updatedAt: new Date(),
            })
            .where(eq(campaigns.id, campaignId));
        }
      }
    }

    if (organizationId) {
      const [existingPreference] = await db
        .select({ id: communicationPreferences.id })
        .from(communicationPreferences)
        .where(
          and(
            eq(communicationPreferences.organizationId, organizationId),
            eq(communicationPreferences.userId, recipientId),
          ),
        )
        .limit(1);

      if (existingPreference) {
        await db
          .update(communicationPreferences)
          .set({
            emailEnabled: false,
            globallyUnsubscribed: true,
            unsubscribedAt: new Date(),
            unsubscribeReason: reason,
            updatedAt: new Date(),
          })
          .where(eq(communicationPreferences.id, existingPreference.id));
      } else {
        await db.insert(communicationPreferences).values({
          organizationId,
          userId: recipientId,
          emailEnabled: false,
          globallyUnsubscribed: true,
          unsubscribedAt: new Date(),
          unsubscribeReason: reason,
        });
      }

      await db.insert(consentRecords).values({
        organizationId,
        userId: recipientId,
        consentType: 'email_marketing',
        channel: 'email',
        status: 'revoked',
        method: 'unsubscribe_link',
        metadata: {
          reason,
          campaignId,
        },
      });
    } else {
      await db
        .update(communicationPreferences)
        .set({
          emailEnabled: false,
          globallyUnsubscribed: true,
          unsubscribedAt: new Date(),
          unsubscribeReason: reason,
          updatedAt: new Date(),
        })
        .where(eq(communicationPreferences.userId, recipientId));
    }
  });

  return new NextResponse(confirmationHtml(locale), {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}
