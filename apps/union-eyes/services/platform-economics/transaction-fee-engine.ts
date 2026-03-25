/**
 * Transaction Fee Engine
 *
 * Calculates, captures, reverses, and settles platform fee revenue
 * on eligible transaction flows. All fee math is deterministic and
 * cents-safe (DECIMAL precision, HALF_EVEN rounding).
 *
 * Functions:
 *  - createFeeRule          — define fee rule for a flow/module/org
 *  - evaluateFee            — compute fee for a transaction (pure, no side-effects)
 *  - captureTransactionFee  — atomically record fee event (idempotent)
 *  - reverseTransactionFee  — reverse fee on refund
 *  - createSettlementBatch  — batch un-settled fee events
 *  - closeSettlementBatch   — finalize batch
 *  - getFeeReport           — gross/fee/net summary for a period
 *
 * @domain platform-economics
 * @layer 1.5 — Transaction Fees
 */

import { db } from '@/db';
import {
  transactionFeeRules,
  transactionFeeEvents,
  feeSettlementBatches,
  feeSettlementLines,
  feeAdjustments,
  type NewTransactionFeeRule,
  type TransactionFeeEvent,
} from '@/db/schema';
import { eq, and, lte, gte, isNull, or, desc, sql, inArray } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface CreateFeeRuleInput {
  organizationId?: string;
  contractId?: string;
  name: string;
  description?: string;
  feeModel: NewTransactionFeeRule['feeModel'];
  percentageRate?: string;
  flatFeeCad?: string;
  minimumFeeCad?: string;
  maximumFeeCad?: string;
  flowType: string;
  moduleKey?: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  priority?: number;
  createdBy?: string;
}

export interface FeeCalculationInput {
  organizationId: string;
  flowType: string;
  moduleKey?: string;
  grossAmountCad: string;
  contractId?: string;
}

export interface FeeCalculationResult {
  grossAmountCad: string;
  feeAmountCad: string;
  netAmountCad: string;
  feeModel: string;
  percentageRateApplied?: string;
  flatFeeApplied?: string;
  ruleId: string;
  ruleName: string;
}

export interface CaptureTransactionFeeInput {
  organizationId: string;
  ruleId: string;
  contractId?: string;
  idempotencyKey: string;
  sourceTransactionId: string;
  sourceTransactionType: string;
  grossAmountCad: string;
  feeAmountCad: string;
  netAmountCad: string;
  feeModel: TransactionFeeEvent['feeModel'];
  percentageRateApplied?: string;
  flatFeeApplied?: string;
  billingPeriodId?: string;
  metadata?: Record<string, unknown>;
}

export interface FeeReportSummary {
  totalGrossCad: string;
  totalFeesCad: string;
  totalNetCad: string;
  eventCount: number;
  byOrg: Array<{
    organizationId: string;
    grossCad: string;
    feesCad: string;
    netCad: string;
    count: number;
  }>;
}

// ============================================================================
// Fee Rule Management
// ============================================================================

/**
 * Create a reusable fee rule for a transaction flow.
 */
export async function createFeeRule(input: CreateFeeRuleInput) {
  const [rule] = await db
    .insert(transactionFeeRules)
    .values({
      organizationId: input.organizationId,
      contractId: input.contractId,
      name: input.name,
      description: input.description,
      feeModel: input.feeModel,
      percentageRate: input.percentageRate,
      flatFeeCad: input.flatFeeCad,
      minimumFeeCad: input.minimumFeeCad,
      maximumFeeCad: input.maximumFeeCad,
      flowType: input.flowType,
      moduleKey: input.moduleKey,
      effectiveFrom: input.effectiveFrom,
      effectiveTo: input.effectiveTo,
      priority: input.priority ?? 0,
      createdBy: input.createdBy,
    })
    .returning();

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'transaction_fee_rule',
    resourceId: rule.id,
    action: 'fee_rule_created',
    userId: input.createdBy,
    metadata: { flowType: input.flowType, feeModel: input.feeModel },
  });

  return rule;
}

/**
 * Find the best-matching active fee rule for a transaction.
 * Priority order: contract-specific > org-specific > global, then by priority column.
 */
export async function findApplicableRule(
  organizationId: string,
  flowType: string,
  moduleKey?: string,
  contractId?: string,
) {
  const now = new Date();

  const rules = await db
    .select()
    .from(transactionFeeRules)
    .where(
      and(
        eq(transactionFeeRules.flowType, flowType),
        eq(transactionFeeRules.status, 'active'),
        lte(transactionFeeRules.effectiveFrom, now),
        or(
          isNull(transactionFeeRules.effectiveTo),
          gte(transactionFeeRules.effectiveTo, now),
        ),
        or(
          eq(transactionFeeRules.organizationId, organizationId),
          isNull(transactionFeeRules.organizationId),
        ),
      ),
    )
    .orderBy(desc(transactionFeeRules.priority));

  // Best match: contract-specific + module-specific > contract-specific > org > global
  let best: (typeof rules)[number] | null = null;
  for (const rule of rules) {
    if (contractId && rule.contractId === contractId && moduleKey && rule.moduleKey === moduleKey) {
      return rule; // Most specific match
    }
    if (contractId && rule.contractId === contractId && !rule.moduleKey) {
      best = best ?? rule;
      continue;
    }
    if (rule.organizationId === organizationId && !rule.contractId) {
      best = best ?? rule;
      continue;
    }
    if (!rule.organizationId && !rule.contractId) {
      best = best ?? rule;
    }
  }

  return best;
}

// ============================================================================
// Fee Calculation (pure, deterministic)
// ============================================================================

/**
 * Calculate fee for a transaction. Pure function — no DB writes.
 * Uses DECIMAL string math to avoid floating-point drift.
 */
export async function evaluateFee(
  input: FeeCalculationInput,
): Promise<FeeCalculationResult | null> {
  const rule = await findApplicableRule(
    input.organizationId,
    input.flowType,
    input.moduleKey,
    input.contractId,
  );

  if (!rule) return null;

  const gross = parseDecimal(input.grossAmountCad);
  let fee = '0.00';
  let percentageApplied: string | undefined;
  let flatApplied: string | undefined;

  switch (rule.feeModel) {
    case 'percentage': {
      const rate = parseDecimal(rule.percentageRate ?? '0');
      fee = multiplyDecimal(gross, rate);
      percentageApplied = rule.percentageRate ?? undefined;
      break;
    }
    case 'flat': {
      fee = rule.flatFeeCad ?? '0.00';
      flatApplied = fee;
      break;
    }
    case 'hybrid': {
      const pctRate = parseDecimal(rule.percentageRate ?? '0');
      const pctFee = multiplyDecimal(gross, pctRate);
      const flatFee = parseDecimal(rule.flatFeeCad ?? '0');
      fee = addDecimal(pctFee, flatFee);
      percentageApplied = rule.percentageRate ?? undefined;
      flatApplied = rule.flatFeeCad ?? undefined;
      break;
    }
    case 'waived':
    case 'subsidized':
      fee = '0.00';
      break;
  }

  // Apply min/max caps
  if (rule.minimumFeeCad && compareDecimal(fee, rule.minimumFeeCad) < 0) {
    fee = rule.minimumFeeCad;
  }
  if (rule.maximumFeeCad && compareDecimal(fee, rule.maximumFeeCad) > 0) {
    fee = rule.maximumFeeCad;
  }

  const net = subtractDecimal(gross, fee);

  return {
    grossAmountCad: gross,
    feeAmountCad: fee,
    netAmountCad: net,
    feeModel: rule.feeModel,
    percentageRateApplied: percentageApplied,
    flatFeeApplied: flatApplied,
    ruleId: rule.id,
    ruleName: rule.name,
  };
}

// ============================================================================
// Fee Capture (idempotent)
// ============================================================================

/**
 * Atomically capture a transaction fee event.
 * Idempotent: duplicate idempotencyKey is a no-op.
 */
export async function captureTransactionFee(
  input: CaptureTransactionFeeInput,
): Promise<TransactionFeeEvent> {
  // Check idempotency — if this key already exists, return existing
  const [existing] = await db
    .select()
    .from(transactionFeeEvents)
    .where(eq(transactionFeeEvents.idempotencyKey, input.idempotencyKey))
    .limit(1);

  if (existing) return existing;

  const [event] = await db
    .insert(transactionFeeEvents)
    .values({
      organizationId: input.organizationId,
      ruleId: input.ruleId,
      contractId: input.contractId,
      idempotencyKey: input.idempotencyKey,
      sourceTransactionId: input.sourceTransactionId,
      sourceTransactionType: input.sourceTransactionType,
      grossAmountCad: input.grossAmountCad,
      feeAmountCad: input.feeAmountCad,
      netAmountCad: input.netAmountCad,
      feeModel: input.feeModel,
      percentageRateApplied: input.percentageRateApplied,
      flatFeeApplied: input.flatFeeApplied,
      billingPeriodId: input.billingPeriodId,
      status: 'captured',
      metadata: input.metadata,
    })
    .returning();

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'transaction_fee_event',
    resourceId: event.id,
    action: 'fee_captured',
    metadata: {
      sourceTransactionId: input.sourceTransactionId,
      grossAmountCad: input.grossAmountCad,
      feeAmountCad: input.feeAmountCad,
      netAmountCad: input.netAmountCad,
    },
  });

  return event;
}

// ============================================================================
// Fee Reversal
// ============================================================================

/**
 * Reverse a captured fee (e.g. on refund). Creates a fee adjustment
 * and marks the event as reversed. Idempotent — cannot reverse twice.
 */
export async function reverseTransactionFee(
  feeEventId: string,
  sourceRefundId: string,
  reason: string,
  approvedBy?: string,
): Promise<{ event: TransactionFeeEvent; adjustment: typeof feeAdjustments.$inferSelect }> {
  return await db.transaction(async (tx) => {
    const [event] = await tx
      .select()
      .from(transactionFeeEvents)
      .where(
        and(
          eq(transactionFeeEvents.id, feeEventId),
          eq(transactionFeeEvents.status, 'captured'),
        ),
      )
      .limit(1);

    if (!event) {
      throw new Error(`Fee event ${feeEventId} not found or already reversed`);
    }

    // Mark as reversed
    const [updatedEvent] = await tx
      .update(transactionFeeEvents)
      .set({ status: 'reversed' })
      .where(eq(transactionFeeEvents.id, feeEventId))
      .returning();

    // Create reversal adjustment
    const [adjustment] = await tx
      .insert(feeAdjustments)
      .values({
        feeEventId,
        organizationId: event.organizationId,
        adjustmentType: 'reversal',
        amountCad: `-${event.feeAmountCad}`,
        reason,
        sourceRefundId,
        approvedBy,
        approvedAt: approvedBy ? new Date() : undefined,
      })
      .returning();

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.HIGH,
      organizationId: event.organizationId,
      resource: 'transaction_fee_event',
      resourceId: feeEventId,
      action: 'fee_reversed',
      userId: approvedBy,
      metadata: {
        reversalAmount: `-${event.feeAmountCad}`,
        sourceRefundId,
        reason,
      },
    });

    return { event: updatedEvent, adjustment };
  });
}

// ============================================================================
// Settlement
// ============================================================================

/**
 * Create a settlement batch from un-settled fee events.
 */
export async function createSettlementBatch(
  periodStart: Date,
  periodEnd: Date,
  createdBy?: string,
): Promise<typeof feeSettlementBatches.$inferSelect> {
  const batchNumber = `STL-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;

  return await db.transaction(async (tx) => {
    // Get captured events not yet settled
    const events = await tx
      .select()
      .from(transactionFeeEvents)
      .where(
        and(
          eq(transactionFeeEvents.status, 'captured'),
          gte(transactionFeeEvents.capturedAt, periodStart),
          lte(transactionFeeEvents.capturedAt, periodEnd),
          isNull(transactionFeeEvents.settlementBatchId),
        ),
      );

    if (events.length === 0) {
      throw new Error('No un-settled fee events found for this period');
    }

    let totalGross = '0.00';
    let totalFees = '0.00';
    let totalNet = '0.00';

    for (const e of events) {
      totalGross = addDecimal(totalGross, e.grossAmountCad);
      totalFees = addDecimal(totalFees, e.feeAmountCad);
      totalNet = addDecimal(totalNet, e.netAmountCad);
    }

    // Create batch
    const [batch] = await tx
      .insert(feeSettlementBatches)
      .values({
        batchNumber,
        periodStart,
        periodEnd,
        totalGrossCad: totalGross,
        totalFeesCad: totalFees,
        totalNetCad: totalNet,
        eventCount: events.length,
        status: 'open',
      })
      .returning();

    // Link events to batch and create settlement lines
    const eventIds = events.map((e) => e.id);
    await tx
      .update(transactionFeeEvents)
      .set({ settlementBatchId: batch.id })
      .where(inArray(transactionFeeEvents.id, eventIds));

    for (const e of events) {
      await tx.insert(feeSettlementLines).values({
        batchId: batch.id,
        feeEventId: e.id,
        organizationId: e.organizationId,
        grossAmountCad: e.grossAmountCad,
        feeAmountCad: e.feeAmountCad,
        netAmountCad: e.netAmountCad,
      });
    }

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      resource: 'fee_settlement_batch',
      resourceId: batch.id,
      action: 'settlement_batch_created',
      userId: createdBy,
      metadata: { batchNumber, eventCount: events.length, totalFeesCad: totalFees },
    });

    return batch;
  });
}

/**
 * Close a settlement batch (mark events as settled).
 */
export async function closeSettlementBatch(
  batchId: string,
  closedBy: string,
) {
  return await db.transaction(async (tx) => {
    // Update batch status
    const [batch] = await tx
      .update(feeSettlementBatches)
      .set({
        status: 'closed',
        closedAt: new Date(),
        closedBy,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(feeSettlementBatches.id, batchId),
          eq(feeSettlementBatches.status, 'open'),
        ),
      )
      .returning();

    if (!batch) {
      throw new Error(`Settlement batch ${batchId} not found or not open`);
    }

    // Mark events as settled
    await tx
      .update(transactionFeeEvents)
      .set({ status: 'settled' })
      .where(eq(transactionFeeEvents.settlementBatchId, batchId));

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.HIGH,
      resource: 'fee_settlement_batch',
      resourceId: batchId,
      action: 'settlement_batch_closed',
      userId: closedBy,
      metadata: { batchNumber: batch.batchNumber, eventCount: batch.eventCount },
    });

    return batch;
  });
}

// ============================================================================
// Reporting
// ============================================================================

/**
 * Fee revenue summary for a period.
 */
export async function getFeeReport(
  periodStart: Date,
  periodEnd: Date,
  organizationId?: string,
): Promise<FeeReportSummary> {
  const conditions = [
    gte(transactionFeeEvents.capturedAt, periodStart),
    lte(transactionFeeEvents.capturedAt, periodEnd),
    inArray(transactionFeeEvents.status, ['captured', 'settled']),
  ];
  if (organizationId) {
    conditions.push(eq(transactionFeeEvents.organizationId, organizationId));
  }

  const events = await db
    .select()
    .from(transactionFeeEvents)
    .where(and(...conditions));

  let totalGross = '0.00';
  let totalFees = '0.00';
  let totalNet = '0.00';

  const byOrgMap: Record<string, { grossCad: string; feesCad: string; netCad: string; count: number }> = {};

  for (const e of events) {
    totalGross = addDecimal(totalGross, e.grossAmountCad);
    totalFees = addDecimal(totalFees, e.feeAmountCad);
    totalNet = addDecimal(totalNet, e.netAmountCad);

    if (!byOrgMap[e.organizationId]) {
      byOrgMap[e.organizationId] = { grossCad: '0.00', feesCad: '0.00', netCad: '0.00', count: 0 };
    }
    byOrgMap[e.organizationId].grossCad = addDecimal(byOrgMap[e.organizationId].grossCad, e.grossAmountCad);
    byOrgMap[e.organizationId].feesCad = addDecimal(byOrgMap[e.organizationId].feesCad, e.feeAmountCad);
    byOrgMap[e.organizationId].netCad = addDecimal(byOrgMap[e.organizationId].netCad, e.netAmountCad);
    byOrgMap[e.organizationId].count += 1;
  }

  return {
    totalGrossCad: totalGross,
    totalFeesCad: totalFees,
    totalNetCad: totalNet,
    eventCount: events.length,
    byOrg: Object.entries(byOrgMap).map(([orgId, data]) => ({
      organizationId: orgId,
      ...data,
    })),
  };
}

// ============================================================================
// Decimal Helpers (cents-safe string arithmetic)
// ============================================================================

function parseDecimal(value: string | null | undefined): string {
  if (!value) return '0.00';
  const n = Number(value);
  if (Number.isNaN(n)) return '0.00';
  return n.toFixed(2);
}

function addDecimal(a: string, b: string): string {
  const result = (Math.round(Number(a) * 100) + Math.round(Number(b) * 100)) / 100;
  return result.toFixed(2);
}

function subtractDecimal(a: string, b: string): string {
  const result = (Math.round(Number(a) * 100) - Math.round(Number(b) * 100)) / 100;
  return result.toFixed(2);
}

function multiplyDecimal(amount: string, rate: string): string {
  // Banker's rounding: round half to even
  const raw = Number(amount) * Number(rate);
  const cents = Math.round(raw * 100);
  return (cents / 100).toFixed(2);
}

function compareDecimal(a: string, b: string): number {
  return Math.round(Number(a) * 100) - Math.round(Number(b) * 100);
}
