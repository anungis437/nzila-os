/**
 * Usage Metering Service
 *
 * Records raw usage events, aggregates them per billing period,
 * and produces billable usage amounts for invoice generation.
 *
 * @domain platform-economics
 * @layer 1.5 — Usage Metering
 */

import { db } from '@/db';
import {
  usageMeters,
  usageEvents,
  usageAggregates,
  type NewUsageMeter,
  type NewUsageEvent,
  type UsageAggregate,
} from '@/db/schema';
import { eq, and, between, sql, desc, gte, lte } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { v4 as uuidv4 } from 'uuid';
import { appendLedgerEntry } from './ledger-service';
import { multiplyMoney, toCents } from '@/lib/decimal-safe';

// ============================================================================
// Types
// ============================================================================

export interface RecordUsageInput {
  meterCode: string;
  organizationId: string;
  userId?: string;
  quantity: number;
  idempotencyKey?: string;
  metadata?: Record<string, unknown>;
}

export interface CloseAggregateInput {
  organizationId: string;
  billingPeriodId: string;
  postToLedger?: boolean;
  createdBy?: string;
}

// ============================================================================
// Meter Management
// ============================================================================

/**
 * Create a new usage meter definition.
 */
export async function createMeter(
  input: Omit<NewUsageMeter, 'id' | 'createdAt' | 'updatedAt'>,
) {
  const [meter] = await db
    .insert(usageMeters)
    .values(input)
    .returning();
  return meter;
}

/**
 * List all active meters.
 */
export async function listActiveMeters() {
  return await db
    .select()
    .from(usageMeters)
    .where(eq(usageMeters.isActive, true));
}

// ============================================================================
// Usage Recording
// ============================================================================

/**
 * Record a single usage event. Idempotent when idempotencyKey is provided.
 * Also updates or creates the usage_aggregate for the current billing period.
 */
export async function recordUsage(input: RecordUsageInput) {
  // Resolve meter by code
  const [meter] = await db
    .select()
    .from(usageMeters)
    .where(eq(usageMeters.code, input.meterCode))
    .limit(1);

  if (!meter) {
    throw new Error(`Unknown meter code: ${input.meterCode}`);
  }

  if (!meter.isActive) {
    throw new Error(`Meter ${input.meterCode} is inactive`);
  }

  const eventId = uuidv4();

  // Insert event (idempotencyKey unique index will reject duplicates)
  const [event] = await db
    .insert(usageEvents)
    .values({
      id: eventId,
      meterId: meter.id,
      organizationId: input.organizationId,
      userId: input.userId,
      quantity: String(input.quantity),
      idempotencyKey: input.idempotencyKey,
      metadata: input.metadata,
    })
    .onConflictDoNothing({ target: usageEvents.idempotencyKey })
    .returning();

  // If duplicate (conflict), return early
  if (!event) {
    return { deduplicated: true, eventId: null };
  }

  return { deduplicated: false, eventId: event.id };
}

// ============================================================================
// Aggregation
// ============================================================================

/**
 * Aggregate raw usage events into a usage_aggregate row for a given
 * organization + meter + billing period. Creates aggregate if it doesn't exist.
 */
export async function aggregateUsageForPeriod(
  organizationId: string,
  meterId: string,
  billingPeriodId: string,
  periodStart: Date,
  periodEnd: Date,
) {
  // Sum raw events for this meter + org + period
  const [sumResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${usageEvents.quantity}::numeric), 0)`,
    })
    .from(usageEvents)
    .where(
      and(
        eq(usageEvents.meterId, meterId),
        eq(usageEvents.organizationId, organizationId),
        gte(usageEvents.eventTime, periodStart),
        lte(usageEvents.eventTime, periodEnd),
      ),
    );

  const totalQuantity = sumResult?.total ?? '0';

  // Get meter to calculate billable amount
  const [meter] = await db
    .select()
    .from(usageMeters)
    .where(eq(usageMeters.id, meterId))
    .limit(1);

  if (!meter) throw new Error(`Meter ${meterId} not found`);

  const included = meter.includedQuantity ?? 0;
  const billable = Math.max(0, Number(totalQuantity) - included);
  const unitPrice = meter.pricePerUnit ?? '0';
  const totalAmount = multiplyMoney(unitPrice, billable);

  // Upsert aggregate
  const [agg] = await db
    .insert(usageAggregates)
    .values({
      meterId,
      organizationId,
      billingPeriodId,
      totalQuantity,
      includedQuantity: included,
      billableQuantity: String(billable),
      unitPrice,
      totalAmount,
      status: 'open',
    })
    .onConflictDoUpdate({
      target: [
        usageAggregates.meterId,
        usageAggregates.organizationId,
        usageAggregates.billingPeriodId,
      ],
      set: {
        totalQuantity,
        billableQuantity: String(billable),
        totalAmount,
        updatedAt: new Date(),
      },
    })
    .returning();

  return agg;
}

/**
 * Close all open aggregates for an org + period, optionally posting
 * usage_fee entries to the DAPL ledger.
 */
export async function closeAggregatesForPeriod(
  input: CloseAggregateInput,
) {
  const openAggs = await db
    .select()
    .from(usageAggregates)
    .where(
      and(
        eq(usageAggregates.organizationId, input.organizationId),
        eq(usageAggregates.billingPeriodId, input.billingPeriodId),
        eq(usageAggregates.status, 'open'),
      ),
    );

  const closed: UsageAggregate[] = [];
  for (const agg of openAggs) {
    // Close the aggregate
    const [updated] = await db
      .update(usageAggregates)
      .set({
        status: 'closed',
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(usageAggregates.id, agg.id))
      .returning();

    // Post to DAPL ledger if requested and amount > 0
    if (input.postToLedger && toCents(agg.totalAmount) > 0) {
      await appendLedgerEntry({
        organizationId: input.organizationId,
        billingPeriodId: input.billingPeriodId,
        costType: 'usage_fee',
        eventType: 'invoice_generated',
        sourceType: 'system',
        sourceId: agg.id,
        quantity: agg.billableQuantity,
        unitPriceCad: agg.unitPrice,
        amountCad: agg.totalAmount,
        description: `Usage: meter ${agg.meterId}`,
        createdBy: input.createdBy,
      });
    }

    closed.push(updated);
  }

  await auditLog({
    eventType: AuditEventType.DATA_UPDATE,
    severity: AuditSeverity.MEDIUM,
    organizationId: input.organizationId,
    resource: 'usage_aggregate',
    action: 'aggregates_closed',
    userId: input.createdBy,
    metadata: {
      billingPeriodId: input.billingPeriodId,
      closedCount: closed.length,
    },
  });

  return closed;
}
