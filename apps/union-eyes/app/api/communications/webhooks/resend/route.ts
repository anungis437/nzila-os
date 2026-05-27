import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';
import { Resend, type WebhookEventPayload } from 'resend';
import { z } from 'zod';

import { db } from '@/db';
import { campaigns, communicationPreferences, messageLog } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const WebhookEnvelopeSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  signature: z.string().min(1),
  payload: z.string().min(1),
});

type MessageStatus =
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'bounced'
  | 'failed'
  | 'unsubscribed'
  | 'complained';

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

function getEventTimestamp(event: WebhookEventPayload): Date {
  const raw = event.created_at;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function mapEventToStatus(eventType: WebhookEventPayload['type']): {
  status: MessageStatus;
  statKey: string;
  timeField?: 'sentAt' | 'deliveredAt' | 'openedAt' | 'clickedAt' | 'bouncedAt';
} | null {
  switch (eventType) {
    case 'email.sent':
      return { status: 'sent', statKey: 'sent', timeField: 'sentAt' };
    case 'email.delivered':
      return { status: 'delivered', statKey: 'delivered', timeField: 'deliveredAt' };
    case 'email.opened':
      return { status: 'opened', statKey: 'opened', timeField: 'openedAt' };
    case 'email.clicked':
      return { status: 'clicked', statKey: 'clicked', timeField: 'clickedAt' };
    case 'email.bounced':
      return { status: 'bounced', statKey: 'bounced', timeField: 'bouncedAt' };
    case 'email.failed':
      return { status: 'failed', statKey: 'failed' };
    case 'email.suppressed':
      return { status: 'unsubscribed', statKey: 'unsubscribed' };
    case 'email.complained':
      return { status: 'complained', statKey: 'complained' };
    default:
      return null;
  }
}

function isEmailEvent(
  event: WebhookEventPayload,
): event is Extract<
  WebhookEventPayload,
  { type: `email.${string}`; data: { email_id: string; to: string[] } }
> {
  if (!event.type.startsWith('email.')) {
    return false;
  }

  const data = event.data as unknown;
  return (
    typeof data === 'object'
    && data !== null
    && 'email_id' in data
    && typeof (data as { email_id?: unknown }).email_id === 'string'
  );
}

function verifyWebhookSignature(
  resend: Resend,
  webhookSecret: string,
  envelope: { id: string; timestamp: string; signature: string; payload: string },
): WebhookEventPayload {
  const parsed = WebhookEnvelopeSchema.safeParse(envelope);
  if (!parsed.success) {
    throw new Error('Invalid webhook envelope');
  }

  return resend.webhooks.verify({
    payload: parsed.data.payload,
    headers: {
      id: parsed.data.id,
      timestamp: parsed.data.timestamp,
      signature: parsed.data.signature,
    },
    webhookSecret,
  });
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY;
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!apiKey || !webhookSecret) {
    logger.error('[resend-webhook] Missing RESEND_API_KEY or RESEND_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 500 });
  }

  const svixId = request.headers.get('svix-id');
  const svixTimestamp = request.headers.get('svix-timestamp');
  const svixSignature = request.headers.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: 'Missing webhook signature headers' }, { status: 400 });
  }

  const payload = await request.text();

  let event: WebhookEventPayload;
  const resend = new Resend(apiKey);
  try {
    event = verifyWebhookSignature(resend, webhookSecret, {
      id: svixId,
      timestamp: svixTimestamp,
      signature: svixSignature,
      payload,
    });
  } catch (error) {
    logger.error('[resend-webhook] Signature verification failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
  }

  if (!isEmailEvent(event)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const mapping = mapEventToStatus(event.type);
  if (!mapping) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const providerMessageId = event.data.email_id;
  const eventTimestamp = getEventTimestamp(event);

  await withSystemContext(async () => {
    const [logRow] = await db
      .select({
        id: messageLog.id,
        campaignId: messageLog.campaignId,
        organizationId: messageLog.organizationId,
        recipientId: messageLog.recipientId,
        sentAt: messageLog.sentAt,
        deliveredAt: messageLog.deliveredAt,
        openedAt: messageLog.openedAt,
        clickedAt: messageLog.clickedAt,
        bouncedAt: messageLog.bouncedAt,
        status: messageLog.status,
        errorMessage: messageLog.errorMessage,
      })
      .from(messageLog)
      .where(eq(messageLog.providerMessageId, providerMessageId))
      .limit(1);

    if (!logRow) {
      logger.warn('[resend-webhook] No message_log row for provider message', {
        providerMessageId,
        eventType: event.type,
      });
      return;
    }

    const updates: {
      status: MessageStatus;
      sentAt?: Date;
      deliveredAt?: Date;
      openedAt?: Date;
      clickedAt?: Date;
      bouncedAt?: Date;
      errorMessage?: string;
      metadata?: Record<string, unknown>;
    } = {
      status: mapping.status,
      metadata: {
        ...(typeof logRow.errorMessage === 'string' ? { lastErrorMessage: logRow.errorMessage } : {}),
        resendEventType: event.type,
        resendEventCreatedAt: event.created_at,
      },
    };

    let shouldIncrementStat = false;

    if (mapping.timeField === 'sentAt' && !logRow.sentAt) {
      updates.sentAt = eventTimestamp;
      shouldIncrementStat = true;
    }
    if (mapping.timeField === 'deliveredAt' && !logRow.deliveredAt) {
      updates.deliveredAt = eventTimestamp;
      shouldIncrementStat = true;
    }
    if (mapping.timeField === 'openedAt' && !logRow.openedAt) {
      updates.openedAt = eventTimestamp;
      shouldIncrementStat = true;
    }
    if (mapping.timeField === 'clickedAt' && !logRow.clickedAt) {
      updates.clickedAt = eventTimestamp;
      if (!logRow.openedAt) {
        updates.openedAt = eventTimestamp;
      }
      shouldIncrementStat = true;
    }
    if (mapping.timeField === 'bouncedAt' && !logRow.bouncedAt) {
      updates.bouncedAt = eventTimestamp;
      shouldIncrementStat = true;
    }

    if (mapping.status === 'failed' && event.type === 'email.failed') {
      updates.errorMessage = event.data.failed?.reason || 'delivery_failed';
      shouldIncrementStat = true;
    }

    if (mapping.status === 'unsubscribed' || mapping.status === 'complained') {
      shouldIncrementStat = true;

      await db
        .update(communicationPreferences)
        .set({
          emailEnabled: false,
          globallyUnsubscribed: true,
          unsubscribedAt: eventTimestamp,
          unsubscribeReason: mapping.status === 'complained' ? 'complaint' : 'suppressed',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(communicationPreferences.organizationId, logRow.organizationId),
            eq(communicationPreferences.userId, logRow.recipientId),
          ),
        );
    }

    if (
      mapping.timeField === undefined
      && logRow.status === mapping.status
      && mapping.status !== 'clicked'
      && mapping.status !== 'opened'
    ) {
      shouldIncrementStat = false;
    }

    await db.update(messageLog).set(updates).where(eq(messageLog.id, logRow.id));

    if (logRow.campaignId && shouldIncrementStat) {
      const [campaign] = await db
        .select({ stats: campaigns.stats })
        .from(campaigns)
        .where(eq(campaigns.id, logRow.campaignId))
        .limit(1);

      if (campaign) {
        let nextStats = incrementStat(campaign.stats, mapping.statKey);
        if (mapping.status === 'clicked' && !logRow.openedAt) {
          nextStats = incrementStat(nextStats, 'opened');
        }

        await db
          .update(campaigns)
          .set({
            stats: nextStats,
            updatedAt: new Date(),
          })
          .where(eq(campaigns.id, logRow.campaignId));
      }
    }
  });

  return NextResponse.json({ received: true, eventType: event.type });
}
