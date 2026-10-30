/**
 * Delivery reconciliation for the canonical notification sender.
 *
 * An `attempted` row is not proof the provider was skipped, and an `accepted`
 * row is not confirmed delivery. A later retry must not call the provider
 * again unless the ledger shows a confirmed failure and no acceptance.
 */
import { and, eq } from 'drizzle-orm';
import { v4 as uuid } from 'uuid';

import { db } from '@/db';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { notificationDeliveryLog } from '@/db/schema/domains/communications';

export const DELIVERY_LEDGER_EVENTS = [
  'queued',
  'attempted',
  'accepted',
  'failed',
  'retried',
  'delivered',
  'suppressed',
  'bounced',
  'uncertain',
] as const;

export type DeliveryLedgerEvent = (typeof DELIVERY_LEDGER_EVENTS)[number];

export interface DeliveryFact {
  event: DeliveryLedgerEvent;
  externalEventId?: string | null;
  organizationId?: string | null;
  notificationId?: string | null;
}

export type DeliveryRetryDecision =
  | { action: 'send'; retry: boolean }
  | {
      action: 'skip';
      status: 'sent' | 'delivered' | 'failed' | 'bounced' | 'uncertain';
      reason: string;
      providerMessageId?: string;
    };

const LEDGER = new Set<string>(DELIVERY_LEDGER_EVENTS);

function providerMessageId(events: DeliveryFact[]): string | undefined {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const value = events[index]?.externalEventId;
    if (typeof value === 'string' && value.length > 0) return value;
  }
  return undefined;
}

/** Latest substantive outcome. `queued` and `retried` are markers, not outcomes. */
function latestOutcome(events: DeliveryFact[]): DeliveryLedgerEvent | null {
  for (let index = events.length - 1; index >= 0; index -= 1) {
    const event = events[index]?.event;
    if (!event || event === 'queued' || event === 'retried') continue;
    return event;
  }
  return null;
}

export function decideDeliveryRetry(events: DeliveryFact[]): DeliveryRetryDecision {
  const outcome = latestOutcome(events);
  const messageId = providerMessageId(events);
  if (outcome === 'delivered') {
    return { action: 'skip', status: 'delivered', reason: 'delivery already confirmed', providerMessageId: messageId };
  }
  if (outcome === 'accepted') {
    return {
      action: 'skip',
      status: 'sent',
      reason: 'provider already accepted this delivery',
      providerMessageId: messageId,
    };
  }
  if (outcome === 'attempted' || outcome === 'uncertain') {
    return {
      action: 'skip',
      status: 'uncertain',
      reason: 'delivery outcome is uncertain; not resending',
      providerMessageId: messageId,
    };
  }
  if (outcome === 'bounced') {
    return { action: 'skip', status: 'bounced', reason: 'provider confirmed a bounce', providerMessageId: messageId };
  }
  if (outcome === 'suppressed') {
    return { action: 'skip', status: 'failed', reason: 'suppressed: not a successful send', providerMessageId: messageId };
  }
  return { action: 'send', retry: outcome === 'failed' };
}

export type ProviderCallbackDecision = 'record' | 'duplicate' | 'ignore-downgrade';

const CALLBACK_RANK: Record<string, number> = {
  attempted: 1,
  uncertain: 1,
  failed: 2,
  bounced: 2,
  suppressed: 2,
  accepted: 3,
  delivered: 4,
};

export function decideProviderCallback(
  existing: DeliveryFact[],
  incoming: { event: DeliveryLedgerEvent; externalEventId: string },
): ProviderCallbackDecision {
  if (
    existing.some(
      (fact) => fact.event === incoming.event && fact.externalEventId === incoming.externalEventId,
    )
  ) {
    return 'duplicate';
  }
  const current = existing.reduce((rank, fact) => Math.max(rank, CALLBACK_RANK[fact.event] ?? 0), 0);
  const next = CALLBACK_RANK[incoming.event] ?? 0;
  if (current >= 4 && next < 4 && incoming.event !== 'bounced') return 'ignore-downgrade';
  if (current >= 3 && (incoming.event === 'failed' || incoming.event === 'attempted')) return 'ignore-downgrade';
  return 'record';
}

export function isDeliveryClaimConflict(error: unknown): boolean {
  const candidate = error as { code?: string; cause?: { code?: string } };
  if (candidate?.code === '23505' || candidate?.cause?.code === '23505') return true;
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /duplicate key|unique constraint/i.test(message);
}

function callbackWriteConflict(error: unknown): 'duplicate' | 'ambiguous' | null {
  if (!isDeliveryClaimConflict(error)) return null;
  const parts: string[] = [];
  let current: unknown = error;
  for (let depth = 0; current && depth < 4; depth += 1) {
    if (current instanceof Error) parts.push(current.message);
    else if (typeof current === 'string') parts.push(current);
    current = (current as { cause?: unknown }).cause;
  }
  return /another organization/i.test(parts.join(' ')) ? 'ambiguous' : 'duplicate';
}

export function ledgerEventsFromRows(rows: unknown): DeliveryFact[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const event = (row as { event?: unknown }).event;
    if (typeof event !== 'string' || !LEDGER.has(event)) return [];
    const record = row as {
      externalEventId?: string | null;
      organizationId?: string | null;
      notificationId?: string | null;
    };
    return [{
      event: event as DeliveryLedgerEvent,
      externalEventId: record.externalEventId,
      organizationId: record.organizationId,
      notificationId: record.notificationId,
    }];
  });
}

export async function loadDeliveryFacts(organizationId: string, idempotencyKey: string): Promise<DeliveryFact[]> {
  const rows = await db
    .select({
      event: notificationDeliveryLog.event,
      externalEventId: notificationDeliveryLog.externalEventId,
      organizationId: notificationDeliveryLog.organizationId,
      notificationId: notificationDeliveryLog.notificationId,
    })
    .from(notificationDeliveryLog)
    .where(
      and(
        eq(notificationDeliveryLog.organizationId, organizationId),
        eq(notificationDeliveryLog.notificationId, idempotencyKey),
      ),
    )
    .limit(50);
  return ledgerEventsFromRows(rows);
}

/**
 * Records a provider callback in the delivery ledger. Pass the caller's transaction as `executor` to commit the ledger row with the
 * caller's other writes: a failure then rolls all of them back together and the provider's retry repeats none of them twice.
 */
export async function recordProviderCallback(input: {
  providerMessageId: string;
  event: Extract<DeliveryLedgerEvent, 'accepted' | 'delivered' | 'failed' | 'bounced' | 'suppressed'>;
  providerId: string;
  webhookId: string;
}, executor?: RLSTx): Promise<'recorded' | 'duplicate' | 'ignored' | 'unmatched' | 'ambiguous'> {
  const reader = executor ?? db;
  const rows = await reader
    .select({
      event: notificationDeliveryLog.event,
      externalEventId: notificationDeliveryLog.externalEventId,
      organizationId: notificationDeliveryLog.organizationId,
      notificationId: notificationDeliveryLog.notificationId,
    })
    .from(notificationDeliveryLog)
    .where(eq(notificationDeliveryLog.externalEventId, input.providerMessageId))
    .limit(20);
  const facts = ledgerEventsFromRows(rows);
  if (facts.length === 0) return 'unmatched';
  const organizations = new Set(facts.map((fact) => fact.organizationId).filter((value): value is string => Boolean(value)));
  if (organizations.size !== 1) return 'ambiguous';
  const decision = decideProviderCallback(facts, {
    event: input.event,
    externalEventId: input.providerMessageId,
  });
  if (decision === 'duplicate') return 'duplicate';
  if (decision === 'ignore-downgrade') return 'ignored';
  const organizationId = [...organizations][0];
  const notificationId = facts.find((fact) => fact.notificationId)?.notificationId;
  if (!organizationId || !notificationId) return 'ambiguous';
  const write = (handle: RLSTx) => handle.insert(notificationDeliveryLog).values({
      id: uuid(),
      organizationId,
      notificationId,
      event: input.event,
      eventTimestamp: new Date(),
      providerId: input.providerId,
      externalEventId: input.providerMessageId,
      details: { webhookId: input.webhookId, providerMessageId: input.providerMessageId },
    });
  try {
    // A unique violation aborts the surrounding transaction unless it happens inside a savepoint, so a caller's transaction
    // gets one and can carry on to answer 'duplicate' or 'ambiguous'.
    if (executor) await executor.transaction((savepoint) => write(savepoint as unknown as RLSTx));
    else await write(db);
  } catch (error) {
    const conflict = callbackWriteConflict(error);
    if (conflict) return conflict;
    throw error;
  }
  return 'recorded';
}
