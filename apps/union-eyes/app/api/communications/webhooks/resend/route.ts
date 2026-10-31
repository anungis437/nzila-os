import { NextRequest, NextResponse } from 'next/server';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { Resend, type WebhookEventPayload } from 'resend';
import { z } from 'zod';

import { campaigns, communicationPreferences, consentRecords, messageLog, newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { logger } from '@/lib/logger';
import { suppressAddress } from '@/lib/communications/address-suppression';
import { recordProviderCallback, type DeliveryLedgerEvent } from '@/lib/services/delivery-reconciliation';
import {
  advanceStatus, alreadyCounted, incrementedStats, keysToCount, nextMetadata,
  type MessageStatus, type StatKey,
} from '@/lib/communications/resend-event-rules';

export const dynamic = 'force-dynamic';

const WebhookEnvelopeSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  signature: z.string().min(1),
  payload: z.string().min(1),
});

function getEventTimestamp(event: WebhookEventPayload): Date {
  const raw = event.created_at;
  const parsed = raw ? new Date(raw) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function callbackLedgerEvent(eventType: WebhookEventPayload['type']): Extract<DeliveryLedgerEvent, 'accepted' | 'delivered' | 'failed' | 'bounced' | 'suppressed'> | null {
  switch (eventType) {
    case 'email.sent':
      return 'accepted';
    case 'email.delivered':
      return 'delivered';
    case 'email.bounced':
      return 'bounced';
    case 'email.failed':
      return 'failed';
    case 'email.suppressed':
    case 'email.complained':
      return 'suppressed';
    default:
      return null;
  }
}

function mapEventToStatus(eventType: WebhookEventPayload['type']): {
  status: MessageStatus;
  statKey: StatKey;
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

  const data = event.data as any;
  return (
    typeof data === 'object'
    && data !== null
    && 'email_id' in data
    && typeof (data as { email_id?: any }).email_id === 'string'
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
    return NextResponse.json({ error: 'Webhook configuration missing' }, { status: 503 });
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
  const ledgerEvent = callbackLedgerEvent(event.type);

  // One transaction carries the message row, the statistics, any suppression and the delivery-ledger row, so a failure anywhere
  // rolls all of them back and the provider's retry repeats nothing that was already applied.
  const outcome = await withSystemContext(async (tx) => {
    const rows = await tx
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
        metadata: messageLog.metadata,
      })
      .from(messageLog)
      .where(eq(messageLog.providerMessageId, providerMessageId))
      .limit(2)
      .for('update');

    // The same provider id on two rows would make the receiving organization arbitrary; refuse to guess.
    if (rows.length > 1) return { kind: 'ambiguous' as const };

    const [logRow] = rows;
    if (!logRow) {
      const ledger = ledgerEvent
        ? await recordProviderCallback({ providerMessageId, event: ledgerEvent, providerId: 'resend', webhookId: svixId }, tx)
        : null;
      return ledger === 'recorded' || ledger === 'duplicate' || ledger === 'ignored'
        ? { kind: 'ledger-only' as const, ledger }
        : { kind: 'unmatched' as const, ledger };
    }

    const counted = alreadyCounted(logRow);
    const added = keysToCount(mapping.statKey, counted);
    const status = advanceStatus(logRow.status, mapping.status);

    const updates: Record<string, unknown> = {
      metadata: nextMetadata(logRow.metadata, counted, added, {
        type: event.type,
        createdAt: event.created_at,
        lastErrorMessage: typeof logRow.errorMessage === 'string' ? logRow.errorMessage : null,
      }),
    };
    if (status !== logRow.status) updates.status = status;

    // Fact timestamps are about the message, not a verdict, so a late event still fills one that is missing.
    if (mapping.timeField === 'sentAt' && !logRow.sentAt) updates.sentAt = eventTimestamp;
    if (mapping.timeField === 'deliveredAt' && !logRow.deliveredAt) updates.deliveredAt = eventTimestamp;
    if (mapping.timeField === 'openedAt' && !logRow.openedAt) updates.openedAt = eventTimestamp;
    if (mapping.timeField === 'clickedAt' && !logRow.clickedAt) {
      updates.clickedAt = eventTimestamp;
      if (!logRow.openedAt) updates.openedAt = eventTimestamp;
    }
    if (mapping.timeField === 'bouncedAt' && !logRow.bouncedAt) updates.bouncedAt = eventTimestamp;
    if (event.type === 'email.failed' && status === 'failed') {
      updates.errorMessage = event.data.failed?.reason || 'delivery_failed';
    }

    // Suppression changes the recipient's consent state, so it is applied once per message, with a consent record and an audit entry,
    // and it creates the preference row when the recipient never had one.
    if ((mapping.status === 'unsubscribed' || mapping.status === 'complained') && added.includes(mapping.statKey)) {
      const reason = mapping.status === 'complained' ? 'complaint' : 'suppressed';
      const preference = {
        emailEnabled: false,
        globallyUnsubscribed: true,
        unsubscribedAt: eventTimestamp,
        unsubscribeReason: reason,
        updatedAt: new Date(),
      };
      const touched = await tx
        .update(communicationPreferences)
        .set(preference)
        .where(and(
          eq(communicationPreferences.organizationId, logRow.organizationId),
          eq(communicationPreferences.userId, logRow.recipientId),
        ))
        .returning({ id: communicationPreferences.id });
      if (touched.length === 0) {
        await tx.insert(communicationPreferences).values({
          organizationId: logRow.organizationId,
          userId: logRow.recipientId,
          ...preference,
        });
      }
      await tx.insert(consentRecords).values({
        organizationId: logRow.organizationId,
        userId: logRow.recipientId,
        consentType: 'email_delivery',
        channel: 'email',
        status: 'revoked',
        method: 'provider_webhook',
        metadata: { reason, providerMessageId, messageLogId: logRow.id, eventId: svixId },
      });
      // The recipient's subscriptions to this organization's distribution lists end with the preference, as they do when the recipient
      // unsubscribes themselves.
      const endedSubscriptions = await tx
        .update(newsletterListSubscribers)
        .set({ status: 'unsubscribed', unsubscribedAt: eventTimestamp })
        .where(and(
          eq(newsletterListSubscribers.profileId, logRow.recipientId),
          ne(newsletterListSubscribers.status, 'unsubscribed'),
          inArray(
            newsletterListSubscribers.listId,
            tx.select({ id: newsletterDistributionLists.id }).from(newsletterDistributionLists).where(eq(newsletterDistributionLists.organizationId, logRow.organizationId)),
          ),
        ))
        .returning({ id: newsletterListSubscribers.id });

      // Platform-wide delivery suppression, so no other organization writes to an address that complained. It is attributed to one
      // address only: an event for a message with several recipients cannot say which of them complained, so it is not guessed.
      const eventRecipients = (event.data as { to?: unknown }).to;
      const addresses = Array.isArray(eventRecipients) ? eventRecipients.filter((a): a is string => typeof a === 'string') : [];
      const platformSuppressed = addresses.length === 1;
      if (platformSuppressed) {
        await suppressAddress(tx, {
          address: addresses[0],
          reason: mapping.status === 'complained' ? 'complaint' : 'provider_suppressed',
          sourceOrganizationId: logRow.organizationId,
          providerEventId: svixId,
        });
      }

      await persistAtomicAudit(tx, {
        organizationId: logRow.organizationId,
        userId: 'system:resend-webhook',
        action: 'communications.email_suppression.apply',
        resourceType: 'communication_preferences',
        resourceId: logRow.recipientId,
        details: { reason, messageLogId: logRow.id, providerMessageId, listSubscriptionsEnded: endedSubscriptions.length, platformSuppression: platformSuppressed },
      });
    }

    await tx
      .update(messageLog)
      .set(updates)
      .where(and(eq(messageLog.id, logRow.id), eq(messageLog.organizationId, logRow.organizationId)));

    if (logRow.campaignId && added.length > 0) {
      await tx
        .update(campaigns)
        .set({ stats: incrementedStats(campaigns.stats, added), updatedAt: new Date() })
        .where(and(eq(campaigns.id, logRow.campaignId), eq(campaigns.organizationId, logRow.organizationId)));
    }

    const ledger = ledgerEvent
      ? await recordProviderCallback({ providerMessageId, event: ledgerEvent, providerId: 'resend', webhookId: svixId }, tx)
      : null;
    return { kind: 'applied' as const, ledger, organizationId: logRow.organizationId };
  });

  if (outcome.kind === 'ambiguous') {
    logger.error('[resend-webhook] More than one message_log row carries the provider message id', { providerMessageId, eventType: event.type });
    return NextResponse.json({ error: 'Ambiguous provider message id' }, { status: 409 });
  }
  if (outcome.kind === 'unmatched') {
    // A non-2xx makes the provider redeliver, which covers an event that beats the sender storing the provider message id.
    logger.warn('[resend-webhook] No message_log or delivery-ledger row for provider message; asking the provider to retry', {
      providerMessageId, eventType: event.type, ledger: outcome.ledger,
    });
    return NextResponse.json({ error: 'Message not recorded', retryable: true }, { status: 404 });
  }
  if (outcome.kind === 'applied' && (outcome.ledger === 'unmatched' || outcome.ledger === 'ambiguous')) {
    logger.warn('[resend-webhook] Delivery-ledger callback did not match a ledger row', {
      providerMessageId, eventType: event.type, ledger: outcome.ledger, organizationId: outcome.organizationId,
    });
  }

  return NextResponse.json({ received: true, eventType: event.type });
}
