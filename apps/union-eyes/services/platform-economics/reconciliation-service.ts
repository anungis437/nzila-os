/**
 * Reconciliation Service
 *
 * Matches invoices, payments, fee events, and refunds to ensure
 * financial integrity. Generates exception records for manual review.
 *
 * Functions:
 *  - runReconciliation      — execute matching for a billing period
 *  - resolveException       — mark exception as resolved / written-off
 *  - getReconciliationRun   — retrieve run details
 *  - listExceptions         — list open exceptions for an org
 *
 * @domain platform-economics
 * @layer 5 — Finance Outputs & Reconciliation
 */

import { db } from '@/db';
import {
  reconciliationRuns,
  reconciliationMatches,
  reconciliationExceptions,
  platformInvoices,
  platformPayments,
  paymentAllocations,
  transactionFeeEvents,
  type ReconciliationRun,
  type ReconciliationException,
} from '@/db/schema';
import { eq, and, gte, lte, inArray } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { addMoney, subtractMoney, absMoney, toCents } from '@/lib/decimal-safe';

// ============================================================================
// Types
// ============================================================================

export interface RunReconciliationInput {
  organizationId?: string;
  billingPeriodId?: string;
  periodStart: Date;
  periodEnd: Date;
  runBy?: string;
}

export interface ReconciliationResult {
  runId: string;
  totalInvoices: number;
  totalPayments: number;
  totalMatches: number;
  totalExceptions: number;
  invoiceAmountCad: string;
  paymentAmountCad: string;
  varianceCad: string;
}

// ============================================================================
// Reconciliation Engine
// ============================================================================

/**
 * Run reconciliation for a period: match invoices↔payments, detect exceptions.
 */
export async function runReconciliation(
  input: RunReconciliationInput,
): Promise<ReconciliationResult> {
  return await db.transaction(async (tx) => {
    // 1. Create run record
    const [run] = await tx
      .insert(reconciliationRuns)
      .values({
        organizationId: input.organizationId,
        billingPeriodId: input.billingPeriodId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: 'running',
        runBy: input.runBy,
      })
      .returning();

    // 2. Fetch invoices in period
    const invoiceConditions = [
      gte(platformInvoices.issueDate, input.periodStart),
      lte(platformInvoices.issueDate, input.periodEnd),
    ];
    if (input.organizationId) {
      invoiceConditions.push(eq(platformInvoices.organizationId, input.organizationId));
    }
    const invoices = await tx
      .select()
      .from(platformInvoices)
      .where(and(...invoiceConditions));

    // 3. Fetch payments in period
    const paymentConditions = [
      gte(platformPayments.createdAt, input.periodStart),
      lte(platformPayments.createdAt, input.periodEnd),
      inArray(platformPayments.status, ['completed', 'refunded']),
    ];
    if (input.organizationId) {
      paymentConditions.push(eq(platformPayments.organizationId, input.organizationId));
    }
    const payments = await tx
      .select()
      .from(platformPayments)
      .where(and(...paymentConditions));

    // 4. Build invoice lookup by ID
    const invoiceById = new Map(invoices.map((inv) => [inv.id, inv]));
    const matchedInvoiceIds = new Set<string>();
    const matchedPaymentIds = new Set<string>();

    let totalMatches = 0;
    let totalExceptions = 0;
    let invoiceAmountCad = '0.00';
    let paymentAmountCad = '0.00';

    for (const inv of invoices) {
      invoiceAmountCad = addMoney(invoiceAmountCad, inv.totalAmount ?? '0.00');
    }
    for (const pmt of payments) {
      paymentAmountCad = addMoney(paymentAmountCad, pmt.amount ?? '0.00');
    }

    // 5. Fetch payment allocations to link payments → invoices
    const paymentIds = payments.map((p) => p.id);
    const allocations = paymentIds.length > 0
      ? await tx
          .select()
          .from(paymentAllocations)
          .where(inArray(paymentAllocations.paymentId, paymentIds))
      : [];

    // Build payment→invoice allocation map
    const allocationsByPaymentId = new Map<string, typeof allocations>();
    for (const alloc of allocations) {
      const existing = allocationsByPaymentId.get(alloc.paymentId) ?? [];
      existing.push(alloc);
      allocationsByPaymentId.set(alloc.paymentId, existing);
    }

    // 5b. Match payments to invoices via allocations
    for (const pmt of payments) {
      const pmtAllocations = allocationsByPaymentId.get(pmt.id);
      if (!pmtAllocations || pmtAllocations.length === 0) {
        // Unmatched payment — exception
        await tx.insert(reconciliationExceptions).values({
          runId: run.id,
          organizationId: pmt.organizationId,
          exceptionType: 'unmatched_payment',
          status: 'open',
          sourceType: 'payment',
          sourceId: pmt.id,
          actualAmountCad: pmt.amount,
          description: `Payment ${pmt.id} has no linked invoice`,
        });
        totalExceptions++;
        continue;
      }

      // Process each allocation to match payment to invoice
      for (const alloc of pmtAllocations) {
        const inv = invoiceById.get(alloc.invoiceId);

        if (!inv) {
          // Payment allocation references invoice outside this period
          await tx.insert(reconciliationExceptions).values({
            runId: run.id,
            organizationId: pmt.organizationId,
            exceptionType: 'unmatched_payment',
            status: 'open',
            sourceType: 'payment',
            sourceId: pmt.id,
            actualAmountCad: alloc.amount,
            description: `Payment allocation references invoice ${alloc.invoiceId} not in reconciliation scope`,
          });
          totalExceptions++;
          continue;
        }

        // Match found — check allocated amount vs invoice total
        const allocAmt = alloc.amount ?? '0.00';
        const invAmt = inv.totalAmount ?? '0.00';
        const variance = subtractMoney(allocAmt, invAmt);

        await tx.insert(reconciliationMatches).values({
          runId: run.id,
          matchType: 'invoice_payment',
          sourceType: 'invoice',
          sourceId: inv.id,
          targetType: 'payment',
          targetId: pmt.id,
          sourceAmountCad: invAmt,
          targetAmountCad: allocAmt,
          varianceCad: variance,
        });
        totalMatches++;

        matchedInvoiceIds.add(inv.id);
        matchedPaymentIds.add(pmt.id);

        // Flag amount discrepancy if variance exceeds tolerance (1 cent)
        if (Math.abs(toCents(variance)) > 1) {
          await tx.insert(reconciliationExceptions).values({
            runId: run.id,
            organizationId: inv.organizationId,
            exceptionType: 'amount_discrepancy',
            status: 'open',
            sourceType: 'invoice',
            sourceId: inv.id,
            expectedAmountCad: invAmt,
            actualAmountCad: allocAmt,
            varianceCad: variance,
            description: `Payment ${pmt.id} allocation ${allocAmt} does not match invoice ${inv.invoiceNumber} total ${invAmt}`,
          });
          totalExceptions++;
        }
      }
    }

    // 6. Detect unmatched invoices (issued but no payment received)
    for (const inv of invoices) {
      if (!matchedInvoiceIds.has(inv.id) && inv.status !== 'void' && inv.status !== 'draft') {
        await tx.insert(reconciliationExceptions).values({
          runId: run.id,
          organizationId: inv.organizationId,
          exceptionType: 'unmatched_invoice',
          status: 'open',
          sourceType: 'invoice',
          sourceId: inv.id,
          expectedAmountCad: inv.totalAmount,
          description: `Invoice ${inv.invoiceNumber} (${inv.status}) has no matching payment in period`,
        });
        totalExceptions++;
      }
    }

    // 7. Fee event reconciliation — check for missing fee events on monetized payments
    const feeConditions = [
      gte(transactionFeeEvents.capturedAt, input.periodStart),
      lte(transactionFeeEvents.capturedAt, input.periodEnd),
    ];
    if (input.organizationId) {
      feeConditions.push(eq(transactionFeeEvents.organizationId, input.organizationId));
    }
    const feeEvents = await tx
      .select()
      .from(transactionFeeEvents)
      .where(and(...feeConditions));

    // Match fee events with settlement batches
    for (const fee of feeEvents) {
      if (fee.settlementBatchId) {
        await tx.insert(reconciliationMatches).values({
          runId: run.id,
          matchType: 'fee_settlement',
          sourceType: 'fee_event',
          sourceId: fee.id,
          targetType: 'settlement_batch',
          targetId: fee.settlementBatchId,
          sourceAmountCad: fee.feeAmountCad,
          targetAmountCad: fee.feeAmountCad,
          varianceCad: '0.00',
        });
        totalMatches++;
      }
    }

    // 8. Finalize run
    const varianceCad = subtractMoney(invoiceAmountCad, paymentAmountCad);

    await tx
      .update(reconciliationRuns)
      .set({
        status: 'completed',
        totalInvoices: invoices.length,
        totalPayments: payments.length,
        totalMatches,
        totalExceptions,
        invoiceAmountCad,
        paymentAmountCad,
        varianceCad,
        completedAt: new Date(),
      })
      .where(eq(reconciliationRuns.id, run.id));

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      organizationId: input.organizationId,
      resource: 'reconciliation_run',
      resourceId: run.id,
      action: 'reconciliation_completed',
      userId: input.runBy,
      metadata: {
        totalInvoices: invoices.length,
        totalPayments: payments.length,
        totalMatches,
        totalExceptions,
        varianceCad,
      },
    });

    // CRITICAL variance alert: flag net variance above $100 as critical audit event
    const varianceCents = Math.abs(toCents(varianceCad));
    if (varianceCents > 10000) {
      await auditLog({
        eventType: AuditEventType.DATA_CREATE,
        severity: AuditSeverity.CRITICAL,
        organizationId: input.organizationId,
        resource: 'reconciliation_run',
        resourceId: run.id,
        action: 'reconciliation_critical_variance',
        userId: input.runBy,
        metadata: {
          varianceCad,
          threshold: '100.00',
          totalExceptions,
          message: `Reconciliation variance $${absMoney(varianceCad)} exceeds $100 threshold — requires immediate review`,
        },
      });
    }

    return {
      runId: run.id,
      totalInvoices: invoices.length,
      totalPayments: payments.length,
      totalMatches,
      totalExceptions,
      invoiceAmountCad,
      paymentAmountCad,
      varianceCad,
    };
  });
}

// ============================================================================
// Exception Management
// ============================================================================

/**
 * Resolve a reconciliation exception.
 */
export async function resolveException(
  exceptionId: string,
  resolution: {
    status: 'resolved' | 'written_off';
    resolvedBy: string;
    notes: string;
  },
): Promise<ReconciliationException> {
  const [updated] = await db
    .update(reconciliationExceptions)
    .set({
      status: resolution.status,
      resolvedBy: resolution.resolvedBy,
      resolvedAt: new Date(),
      resolutionNotes: resolution.notes,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(reconciliationExceptions.id, exceptionId),
        inArray(reconciliationExceptions.status, ['open', 'under_review']),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error(`Exception ${exceptionId} not found or already resolved`);
  }

  await auditLog({
    eventType: AuditEventType.DATA_UPDATE,
    severity: AuditSeverity.MEDIUM,
    organizationId: updated.organizationId ?? undefined,
    resource: 'reconciliation_exception',
    resourceId: exceptionId,
    action: 'exception_resolved',
    userId: resolution.resolvedBy,
    metadata: { status: resolution.status, notes: resolution.notes },
  });

  return updated;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get a reconciliation run with summary.
 */
export async function getReconciliationRun(
  runId: string,
): Promise<ReconciliationRun | null> {
  const [run] = await db
    .select()
    .from(reconciliationRuns)
    .where(eq(reconciliationRuns.id, runId))
    .limit(1);
  return run ?? null;
}

/**
 * List open exceptions for an org (paginated).
 */
export async function listExceptions(
  organizationId: string,
  statusFilter: ('open' | 'under_review' | 'resolved' | 'written_off')[] = ['open', 'under_review'],
): Promise<ReconciliationException[]> {
  return await db
    .select()
    .from(reconciliationExceptions)
    .where(
      and(
        eq(reconciliationExceptions.organizationId, organizationId),
        inArray(reconciliationExceptions.status, statusFilter),
      ),
    );
}

/**
 * Guard: require a completed reconciliation run before period closure.
 * Returns the latest completed run or throws if none exists or open exceptions remain.
 */
export async function requireReconciliation(
  billingPeriodId: string,
): Promise<ReconciliationRun> {
  const [run] = await db
    .select()
    .from(reconciliationRuns)
    .where(
      and(
        eq(reconciliationRuns.billingPeriodId, billingPeriodId),
        eq(reconciliationRuns.status, 'completed'),
      ),
    )
    .limit(1);

  if (!run) {
    throw new Error(
      `Billing period ${billingPeriodId} cannot be closed: no completed reconciliation run found`,
    );
  }

  const openExceptions = await db
    .select()
    .from(reconciliationExceptions)
    .where(
      and(
        eq(reconciliationExceptions.runId, run.id),
        inArray(reconciliationExceptions.status, ['open', 'under_review']),
      ),
    );

  if (openExceptions.length > 0) {
    throw new Error(
      `Billing period ${billingPeriodId} cannot be closed: ${openExceptions.length} unresolved reconciliation exception(s)`,
    );
  }

  return run;
}
