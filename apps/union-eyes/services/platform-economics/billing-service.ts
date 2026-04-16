/**
 * Platform Billing Service
 * 
 * Org-level billing lifecycle: accounts, subscriptions, invoicing, payments.
 * All billing is CAD-only per CRA T106 requirements.
 * 
 * @domain platform-economics
 * @layer 1 — Platform Billing
 */

import { db } from '@/db';
import {
  billingAccounts,
  billingPeriods,
  orgSubscriptions,
  platformInvoices,
  platformInvoiceLineItems,
  platformPayments,
  paymentAllocations,
  subscriptionPlans,
  usageAggregates,
  usageEvents,
  usageMeters,
  organizations,
  type NewBillingAccount,
} from '@/db/schema';
import { eq, and, desc, inArray, sql, or, lt } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { appendLedgerEntry } from './ledger-service';
import { requireReconciliation } from './reconciliation-service';
import { getActiveContract } from './contract-service';

// ============================================================================
// Types
// ============================================================================

export interface CreateBillingAccountInput {
  organizationId: string;
  displayName: string;
  billingEmail: string;
  billingContactName?: string;
  billingPhone?: string;
  billingAddress?: NewBillingAccount['billingAddress'];
  taxId?: string;
  netTermsDays?: number;
  createdBy?: string;
}

export interface GenerateInvoiceInput {
  organizationId: string;
  billingPeriodId: string;
  createdBy?: string;
}

export interface RecordPaymentInput {
  organizationId: string;
  invoiceId: string;
  amount: string;
  method: string;
  externalReference?: string;
  idempotencyKey?: string;
  createdBy?: string;
}

// ============================================================================
// Billing Account Management
// ============================================================================

export async function createBillingAccount(
  input: CreateBillingAccountInput,
) {
  const [account] = await db
    .insert(billingAccounts)
    .values({
      organizationId: input.organizationId,
      displayName: input.displayName,
      billingEmail: input.billingEmail,
      billingContactName: input.billingContactName,
      billingPhone: input.billingPhone,
      billingAddress: input.billingAddress,
      taxId: input.taxId,
      currency: 'CAD', // Enforced
      netTermsDays: input.netTermsDays ?? 30,
      createdBy: input.createdBy,
    })
    .returning();

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'billing_account',
    resourceId: account.id,
    action: 'billing_account_created',
    userId: input.createdBy,
  });

  return account;
}

export async function getBillingAccount(organizationId: string) {
  const [account] = await db
    .select()
    .from(billingAccounts)
    .where(eq(billingAccounts.organizationId, organizationId))
    .limit(1);
  return account ?? null;
}

export async function updateBillingAccount(
  organizationId: string,
  updates: Partial<Pick<
    NewBillingAccount,
    'displayName' | 'billingEmail' | 'billingContactName' | 'billingPhone' | 'billingAddress' | 'taxId' | 'netTermsDays'
  >>,
  updatedBy?: string,
) {
  const [updated] = await db
    .update(billingAccounts)
    .set({ ...updates, updatedAt: new Date() })
    .where(eq(billingAccounts.organizationId, organizationId))
    .returning();

  if (updated) {
    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.HIGH,
      organizationId,
      resource: 'billing_account',
      resourceId: updated.id,
      action: 'billing_account_updated',
      userId: updatedBy,
      details: { fields: Object.keys(updates) },
    });
  }

  return updated ?? null;
}

// ============================================================================
// Billing Periods
// ============================================================================

export async function getOrCreateBillingPeriod(
  organizationId: string,
  label: string,
  periodStart: Date,
  periodEnd: Date,
) {
  const [existing] = await db
    .select()
    .from(billingPeriods)
    .where(
      and(
        eq(billingPeriods.organizationId, organizationId),
        eq(billingPeriods.label, label),
      ),
    )
    .limit(1);

  if (existing) return existing;

  const [created] = await db
    .insert(billingPeriods)
    .values({ organizationId, label, periodStart, periodEnd })
    .returning();

  return created;
}

export async function closeBillingPeriod(
  billingPeriodId: string,
  closedBy: string,
) {
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, billingPeriodId))
    .limit(1);

  if (!period) throw new Error(`Billing period ${billingPeriodId} not found`);
  if (period.isClosed) throw new Error(`Period ${period.label} is already closed`);

  // Guard: require completed reconciliation with no open exceptions
  await requireReconciliation(billingPeriodId);

  const [updated] = await db
    .update(billingPeriods)
    .set({ isClosed: true, closedAt: new Date(), closedBy })
    .where(eq(billingPeriods.id, billingPeriodId))
    .returning();

  await auditLog({
    eventType: AuditEventType.DATA_UPDATE,
    severity: AuditSeverity.CRITICAL,
    organizationId: period.organizationId,
    resource: 'billing_period',
    resourceId: billingPeriodId,
    action: 'billing_period_closed',
    userId: closedBy,
    details: { label: period.label },
  });

  return updated;
}

// ============================================================================
// Invoice Generation
// ============================================================================

export async function generateInvoice(input: GenerateInvoiceInput) {
  const account = await getBillingAccount(input.organizationId);
  if (!account) throw new Error(`No billing account for org ${input.organizationId}`);

  // Guard: prevent invoicing against a closed billing period
  const [period] = await db
    .select()
    .from(billingPeriods)
    .where(eq(billingPeriods.id, input.billingPeriodId))
    .limit(1);

  if (period?.isClosed) {
    throw new Error(`Cannot generate invoice: billing period ${period.label} is closed`);
  }

  // Guard: prevent duplicate invoices for same org+period
  const [existingInvoice] = await db
    .select({ id: platformInvoices.id, invoiceNumber: platformInvoices.invoiceNumber })
    .from(platformInvoices)
    .where(
      and(
        eq(platformInvoices.organizationId, input.organizationId),
        eq(platformInvoices.billingPeriodId, input.billingPeriodId),
      ),
    )
    .limit(1);

  if (existingInvoice) {
    throw new Error(
      `Invoice ${existingInvoice.invoiceNumber} already exists for this org+period`,
    );
  }

  // Guard: require active contract before invoicing
  const contract = await getActiveContract(input.organizationId);
  if (!contract) {
    throw new Error(`Cannot generate invoice: no active contract for org ${input.organizationId}`);
  }

  // Get active subscription
  const [subscription] = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.organizationId, input.organizationId),
        eq(orgSubscriptions.status, 'active'),
      ),
    )
    .limit(1);

  if (!subscription) throw new Error(`No active subscription for org ${input.organizationId}`);

  // Get plan details
  const [plan] = await db
    .select()
    .from(subscriptionPlans)
    .where(eq(subscriptionPlans.id, subscription.planId))
    .limit(1);

  if (!plan) throw new Error(`Plan ${subscription.planId} not found`);

  // Build line items
  const lineItems: Array<{
    description: string;
    costType: string;
    quantity: string;
    unitPrice: string;
    amount: string;
    metadata?: Record<string, unknown>;
  }> = [];

  const baseFee = centsSafe(plan.baseFee);
  if (baseFee > 0) {
    lineItems.push({
      description: `${plan.name} — Base Subscription`,
      costType: 'base_subscription',
      quantity: '1',
      unitPrice: plan.baseFee,
      amount: plan.baseFee,
    });
  }

  const perLocalFeeCents = centsSafe(plan.perLocalFee ?? '0');
  const localCount = subscription.localCount ?? 0;
  if (perLocalFeeCents > 0 && localCount > 0) {
    lineItems.push({
      description: `Local Fee × ${localCount}`,
      costType: 'local_fee',
      quantity: String(localCount),
      unitPrice: plan.perLocalFee!,
      amount: centsToDecimal(perLocalFeeCents * localCount),
    });
  }

  const perSeatFeeCents = centsSafe(plan.perSeatFee ?? '0');
  const seatCount = subscription.seatCount ?? 0;
  if (perSeatFeeCents > 0 && seatCount > 0) {
    lineItems.push({
      description: `Seat Fee × ${seatCount}`,
      costType: 'seat_fee',
      quantity: String(seatCount),
      unitPrice: plan.perSeatFee!,
      amount: centsToDecimal(perSeatFeeCents * seatCount),
    });
  }

  const modules = subscription.moduleList as string[] | null;
  const perModuleFeeCents = centsSafe(plan.perModuleFee ?? '0');
  if (perModuleFeeCents > 0 && modules && modules.length > 0) {
    lineItems.push({
      description: `Module Fee × ${modules.length}`,
      costType: 'module_fee',
      quantity: String(modules.length),
      unitPrice: plan.perModuleFee!,
      amount: centsToDecimal(perModuleFeeCents * modules.length),
    });
  }

  // Usage-driven line items with explicit event lineage.
  if (period) {
    const aggregates = await db
      .select({
        id: usageAggregates.id,
        meterId: usageAggregates.meterId,
        billableQuantity: usageAggregates.billableQuantity,
        unitPrice: usageAggregates.unitPrice,
        totalAmount: usageAggregates.totalAmount,
        status: usageAggregates.status,
        meterCode: usageMeters.code,
        meterUnit: usageMeters.unit,
      })
      .from(usageAggregates)
      .innerJoin(usageMeters, eq(usageMeters.id, usageAggregates.meterId))
      .where(
        and(
          eq(usageAggregates.organizationId, input.organizationId),
          eq(usageAggregates.billingPeriodId, input.billingPeriodId),
        ),
      );

    for (const agg of aggregates) {
      const amountCents = centsSafe(agg.totalAmount);
      if (amountCents <= 0) continue;

      const usageEventRows = await db
        .select({ id: usageEvents.id })
        .from(usageEvents)
        .where(
          and(
            eq(usageEvents.organizationId, input.organizationId),
            eq(usageEvents.meterId, agg.meterId),
            sql`${usageEvents.eventTime} >= ${period.periodStart}`,
            sql`${usageEvents.eventTime} <= ${period.periodEnd}`,
          ),
        );

      lineItems.push({
        description: `Usage ${agg.meterCode} (${agg.billableQuantity} ${agg.meterUnit})`,
        costType: 'usage_fee',
        quantity: String(agg.billableQuantity),
        unitPrice: String(agg.unitPrice),
        amount: String(agg.totalAmount),
        metadata: {
          usageAggregateId: agg.id,
          meterId: agg.meterId,
          meterCode: agg.meterCode,
          usageAggregateStatus: agg.status,
          usageEventIds: usageEventRows.map((r) => r.id),
        },
      });
    }
  }

  // Apply discount — cents-safe arithmetic
  let subtotalCents = lineItems.reduce((s, li) => s + centsSafe(li.amount), 0);
  const discountPct = centsSafe(subscription.discountPercent ?? '0');
  if (discountPct > 0) {
    const discountCents = Math.round(subtotalCents * discountPct / 10000);
    const discountStr = centsToDecimal(discountCents);
    lineItems.push({
      description: `Discount (${centsToDecimal(discountPct)}%)`,
      costType: 'credit',
      quantity: '1',
      unitPrice: `-${discountStr}`,
      amount: `-${discountStr}`,
    });
    subtotalCents -= discountCents;
  }

  // Apply subsidy
  const subsidyCents = centsSafe(subscription.subsidyAmount ?? '0');
  if (subsidyCents > 0) {
    const subsidyStr = centsToDecimal(subsidyCents);
    lineItems.push({
      description: 'Platform Subsidy',
      costType: 'subsidy',
      quantity: '1',
      unitPrice: `-${subsidyStr}`,
      amount: `-${subsidyStr}`,
    });
    subtotalCents -= subsidyCents;
  }

  const totalCents = Math.max(subtotalCents, 0);
  const invoiceNumber = `INV-${input.organizationId.slice(0, 8).toUpperCase()}-${Date.now()}`;
  const issueDate = new Date();
  const dueDate = new Date(issueDate.getTime() + account.netTermsDays * 86400000);

  // Insert invoice + line items + ledger entries in transaction
  const result = await db.transaction(async (tx) => {
    const [invoice] = await tx
      .insert(platformInvoices)
      .values({
        billingAccountId: account.id,
        organizationId: input.organizationId,
        billingPeriodId: input.billingPeriodId,
        invoiceNumber,
        issueDate,
        dueDate,
        subtotal: centsToDecimal(subtotalCents),
        totalAmount: centsToDecimal(totalCents),
        currency: 'CAD',
        status: 'issued',
        metadata: {
          pricingRuleVersion: `plan:${plan.id}@${plan.updatedAt?.toISOString?.() ?? 'unknown'}`,
          pricingPlanCode: plan.code,
        },
        createdBy: input.createdBy,
      })
      .returning();

    // Insert line items
    for (const li of lineItems) {
      await tx.insert(platformInvoiceLineItems).values({
        invoiceId: invoice.id,
        description: li.description,
        costType: li.costType,
        quantity: li.quantity,
        unitPrice: li.unitPrice,
        amount: li.amount,
        currency: 'CAD',
        metadata: li.metadata,
      });
    }

    return invoice;
  });

  // Create ledger entries for each positive line item
  for (const li of lineItems) {
    const amt = centsSafe(li.amount);
    if (amt === 0) continue;

    await appendLedgerEntry({
      organizationId: input.organizationId,
      billingPeriodId: input.billingPeriodId,
      costType: li.costType as NewPlatformCostLedgerEntry['costType'],
      eventType: 'invoice_generated',
      sourceType: 'invoice',
      sourceId: result.id,
      quantity: li.quantity,
      unitPriceCad: li.unitPrice,
      amountCad: li.amount,
      description: li.description,
      createdBy: input.createdBy,
    });
  }

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'platform_invoice',
    resourceId: result.id,
    action: 'invoice_generated',
    userId: input.createdBy,
    details: { invoiceNumber, totalAmount: centsToDecimal(totalCents), lineItemCount: lineItems.length },
  });

  return result;
}

// ============================================================================
// Payment Recording
// ============================================================================

export async function recordPayment(input: RecordPaymentInput) {
  const account = await getBillingAccount(input.organizationId);
  if (!account) throw new Error(`No billing account for org ${input.organizationId}`);

  // Idempotency guard: if a key is provided, return existing payment
  if (input.idempotencyKey) {
    const [existing] = await db
      .select()
      .from(platformPayments)
      .where(eq(platformPayments.externalReference, input.idempotencyKey))
      .limit(1);

    if (existing) return existing;
  }

  // Get invoice
  const [invoice] = await db
    .select()
    .from(platformInvoices)
    .where(eq(platformInvoices.id, input.invoiceId))
    .limit(1);
  if (!invoice) throw new Error(`Invoice ${input.invoiceId} not found`);
  if (invoice.organizationId !== input.organizationId) {
    throw new Error('Invoice does not belong to this organization');
  }

  const paymentAmountCents = centsSafe(input.amount);
  if (paymentAmountCents <= 0) throw new Error('Payment amount must be positive');

  const result = await db.transaction(async (tx) => {
    // Insert payment
    const [payment] = await tx
      .insert(platformPayments)
      .values({
        billingAccountId: account.id,
        organizationId: input.organizationId,
        amount: input.amount,
        currency: 'CAD',
        status: 'completed',
        method: input.method,
        externalReference: input.externalReference,
        paidAt: new Date(),
        createdBy: input.createdBy,
      })
      .returning();

    // Allocate payment to invoice
    await tx.insert(paymentAllocations).values({
      paymentId: payment.id,
      invoiceId: input.invoiceId,
      amount: input.amount,
      createdBy: input.createdBy,
    });

    // Update invoice paid amount + status (cents-safe)
    const newAmountPaidCents = centsSafe(invoice.amountPaid) + paymentAmountCents;
    const totalDueCents = centsSafe(invoice.totalAmount);
    const newStatus = newAmountPaidCents >= totalDueCents ? 'paid' : 'partially_paid';

    await tx
      .update(platformInvoices)
      .set({
        amountPaid: centsToDecimal(newAmountPaidCents),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(platformInvoices.id, input.invoiceId));

    return payment;
  });

  // Ledger entry for payment
  await appendLedgerEntry({
    organizationId: input.organizationId,
    billingPeriodId: invoice.billingPeriodId ?? undefined,
    costType: 'credit',
    eventType: 'payment_received',
    sourceType: 'payment',
    sourceId: result.id,
    unitPriceCad: `-${input.amount}`,
    amountCad: `-${input.amount}`,
    description: `Payment received — ${input.method}`,
    createdBy: input.createdBy,
  });

  await auditLog({
    eventType: AuditEventType.PAYMENT_PROCESSED,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'platform_payment',
    resourceId: result.id,
    action: 'payment_recorded',
    userId: input.createdBy,
    details: { amount: input.amount, method: input.method, invoiceId: input.invoiceId },
  });

  return result;
}

// ============================================================================
// Billing Lifecycle Automation
// ============================================================================

interface ReconcileExternalInvoicePaymentInput {
  organizationId: string;
  invoiceId: string;
  amount: string;
  method: string;
  externalReference: string;
  paidAt?: Date;
  status?: 'completed' | 'failed';
  failureReason?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export async function reconcileExternalInvoicePayment(input: ReconcileExternalInvoicePaymentInput) {
  const [invoice] = await db
    .select()
    .from(platformInvoices)
    .where(
      and(
        eq(platformInvoices.id, input.invoiceId),
        eq(platformInvoices.organizationId, input.organizationId),
      ),
    )
    .limit(1);

  if (!invoice) {
    throw new Error(`Invoice ${input.invoiceId} not found for org ${input.organizationId}`);
  }

  const [existingPayment] = await db
    .select()
    .from(platformPayments)
    .where(eq(platformPayments.externalReference, input.externalReference))
    .limit(1);

  if (existingPayment) return existingPayment;

  const account = await getBillingAccount(input.organizationId);
  if (!account) throw new Error(`No billing account for org ${input.organizationId}`);

  const normalizedStatus = input.status ?? 'completed';
  const paymentAmountCents = centsSafe(input.amount);

  const [payment] = await db
    .insert(platformPayments)
    .values({
      billingAccountId: account.id,
      organizationId: input.organizationId,
      amount: input.amount,
      currency: 'CAD',
      status: normalizedStatus,
      method: input.method,
      externalReference: input.externalReference,
      paidAt: input.paidAt ?? new Date(),
      failureReason: input.failureReason,
      metadata: input.metadata,
      createdBy: input.createdBy,
    })
    .returning();

  if (normalizedStatus === 'completed' && paymentAmountCents > 0) {
    const newAmountPaidCents = centsSafe(invoice.amountPaid) + paymentAmountCents;
    const totalDueCents = centsSafe(invoice.totalAmount);
    const newStatus = newAmountPaidCents >= totalDueCents ? 'paid' : 'partially_paid';

    await db.transaction(async (tx) => {
      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: input.amount,
        createdBy: input.createdBy,
      });

      await tx
        .update(platformInvoices)
        .set({
          amountPaid: centsToDecimal(newAmountPaidCents),
          status: newStatus,
          updatedAt: new Date(),
          metadata: {
            ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
            lifecycleState: newStatus === 'paid' ? 'paid' : 'finalized',
            lastReconciledPaymentId: payment.id,
          },
        })
        .where(eq(platformInvoices.id, invoice.id));
    });
  } else if (normalizedStatus === 'failed') {
    await db
      .update(platformInvoices)
      .set({
        status: invoice.status === 'paid' ? invoice.status : 'overdue',
        updatedAt: new Date(),
        metadata: {
          ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
          lifecycleState: 'failed',
          lastFailedPaymentRef: input.externalReference,
          lastFailureReason: input.failureReason ?? null,
        },
      })
      .where(eq(platformInvoices.id, invoice.id));
  }

  return payment;
}

export async function runBillingLifecycleAutomation(runAt = new Date(), actor = 'system:billing-cron') {
  const subscriptions = await db
    .select({
      organizationId: orgSubscriptions.organizationId,
    })
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.status, 'active'));

  const monthStart = new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth(), 1, 0, 0, 0));
  const monthEnd = new Date(Date.UTC(runAt.getUTCFullYear(), runAt.getUTCMonth() + 1, 0, 23, 59, 59));
  const periodLabel = `${runAt.getUTCFullYear()}-${String(runAt.getUTCMonth() + 1).padStart(2, '0')}`;

  let periodsCreatedOrFound = 0;
  let invoicesGenerated = 0;
  let invoiceGenerationSkipped = 0;
  let invoicesFinalized = 0;
  let invoicesMarkedOverdue = 0;

  for (const subscription of subscriptions) {
    const period = await getOrCreateBillingPeriod(
      subscription.organizationId,
      periodLabel,
      monthStart,
      monthEnd,
    );
    periodsCreatedOrFound += 1;

    try {
      await generateInvoice({
        organizationId: subscription.organizationId,
        billingPeriodId: period.id,
        createdBy: actor,
      });
      invoicesGenerated += 1;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes('already exists')) {
        invoiceGenerationSkipped += 1;
      } else {
        throw error;
      }
    }

    const draftInvoices = await db
      .select()
      .from(platformInvoices)
      .where(
        and(
          eq(platformInvoices.organizationId, subscription.organizationId),
          eq(platformInvoices.status, 'draft'),
          lt(platformInvoices.issueDate, runAt),
        ),
      );

    for (const draft of draftInvoices) {
      await db
        .update(platformInvoices)
        .set({
          status: 'issued',
          updatedAt: runAt,
          metadata: {
            ...((draft.metadata as Record<string, unknown> | null) ?? {}),
            lifecycleState: 'finalized',
            finalizedAt: runAt.toISOString(),
            finalizedBy: actor,
          },
        })
        .where(eq(platformInvoices.id, draft.id));
      invoicesFinalized += 1;
    }

    const overdueInvoices = await db
      .select()
      .from(platformInvoices)
      .where(
        and(
          eq(platformInvoices.organizationId, subscription.organizationId),
          or(
            eq(platformInvoices.status, 'issued'),
            eq(platformInvoices.status, 'partially_paid'),
          ),
          lt(platformInvoices.dueDate, runAt),
        ),
      );

    for (const inv of overdueInvoices) {
      await db
        .update(platformInvoices)
        .set({
          status: 'overdue',
          updatedAt: runAt,
          metadata: {
            ...((inv.metadata as Record<string, unknown> | null) ?? {}),
            lifecycleState: 'failed',
            failureReason: 'invoice_due_date_passed',
            failedAt: runAt.toISOString(),
          },
        })
        .where(eq(platformInvoices.id, inv.id));
      invoicesMarkedOverdue += 1;
    }
  }

  return {
    runAt: runAt.toISOString(),
    organizationsScanned: subscriptions.length,
    periodLabel,
    periodsCreatedOrFound,
    invoicesGenerated,
    invoiceGenerationSkipped,
    invoicesFinalized,
    invoicesMarkedOverdue,
  };
}

// ============================================================================
// Queries
// ============================================================================

export async function getInvoices(organizationId: string, limit = 50) {
  return db
    .select()
    .from(platformInvoices)
    .where(eq(platformInvoices.organizationId, organizationId))
    .orderBy(desc(platformInvoices.issueDate))
    .limit(limit);
}

export async function getInvoiceWithLineItems(invoiceId: string) {
  const [invoice] = await db
    .select()
    .from(platformInvoices)
    .where(eq(platformInvoices.id, invoiceId))
    .limit(1);

  if (!invoice) return null;

  const lineItems = await db
    .select()
    .from(platformInvoiceLineItems)
    .where(eq(platformInvoiceLineItems.invoiceId, invoiceId));

  return { ...invoice, lineItems };
}

export async function replayInvoiceDeterministically(invoiceId: string) {
  const invoiceData = await getInvoiceWithLineItems(invoiceId);
  if (!invoiceData) return null;

  let recomputedSubtotalCents = 0;
  const lineage: Array<Record<string, unknown>> = [];

  for (const item of invoiceData.lineItems) {
    const amountCents = centsSafe(item.amount);
    recomputedSubtotalCents += amountCents;

    const metadata = (item.metadata ?? {}) as Record<string, unknown>;
    const usageEventIds = Array.isArray(metadata.usageEventIds)
      ? metadata.usageEventIds.map(String)
      : [];

    lineage.push({
      lineItemId: item.id,
      costType: item.costType,
      amount: String(item.amount),
      usageAggregateId: metadata.usageAggregateId ?? null,
      usageEventIds,
    });
  }

  const recomputedSubtotal = centsToDecimal(recomputedSubtotalCents);
  const storedSubtotal = String(invoiceData.subtotal);

  return {
    invoiceId: invoiceData.id,
    pricingRuleVersion: (invoiceData.metadata as Record<string, unknown> | null | undefined)?.pricingRuleVersion ?? null,
    recomputed: {
      subtotal: recomputedSubtotal,
      storedSubtotal,
      totalAmount: String(invoiceData.totalAmount),
      isMatch: recomputedSubtotal === storedSubtotal,
    },
    lineage,
  };
}

export async function getPayments(organizationId: string, invoiceId?: string, limit = 50) {
  const conditions = [eq(platformPayments.organizationId, organizationId)];

  if (invoiceId) {
    const paymentIds = db
      .select({ paymentId: paymentAllocations.paymentId })
      .from(paymentAllocations)
      .where(eq(paymentAllocations.invoiceId, invoiceId));
    conditions.push(inArray(platformPayments.id, paymentIds));
  }

  return db
    .select()
    .from(platformPayments)
    .where(and(...conditions))
    .orderBy(desc(platformPayments.createdAt))
    .limit(limit);
}

// ============================================================================
// Admin Cross-Org Queries (Billing Dashboard)
// ============================================================================

export async function getAdminSubscriptions() {
  const rows = await db
    .select({
      id: orgSubscriptions.id,
      organizationId: orgSubscriptions.organizationId,
      orgName: organizations.name,
      planName: subscriptionPlans.name,
      planCode: subscriptionPlans.code,
      pricingModel: subscriptionPlans.pricingModel,
      baseFee: subscriptionPlans.baseFee,
      currency: subscriptionPlans.currency,
      billingInterval: subscriptionPlans.billingInterval,
      status: orgSubscriptions.status,
      startDate: orgSubscriptions.startDate,
      endDate: orgSubscriptions.endDate,
      localCount: orgSubscriptions.localCount,
      seatCount: orgSubscriptions.seatCount,
      discountPercent: orgSubscriptions.discountPercent,
      memberCount: organizations.memberCount,
      perCapitaRate: organizations.perCapitaRate,
      createdAt: orgSubscriptions.createdAt,
    })
    .from(orgSubscriptions)
    .innerJoin(subscriptionPlans, eq(orgSubscriptions.planId, subscriptionPlans.id))
    .innerJoin(organizations, eq(orgSubscriptions.organizationId, organizations.id))
    .orderBy(desc(subscriptionPlans.baseFee));

  return rows;
}

export async function getAdminInvoices() {
  const rows = await db
    .select({
      id: platformInvoices.id,
      organizationId: platformInvoices.organizationId,
      orgName: organizations.name,
      invoiceNumber: platformInvoices.invoiceNumber,
      status: platformInvoices.status,
      subtotal: platformInvoices.subtotal,
      taxAmount: platformInvoices.taxAmount,
      totalAmount: platformInvoices.totalAmount,
      amountPaid: platformInvoices.amountPaid,
      dueDate: platformInvoices.dueDate,
      issueDate: platformInvoices.issueDate,
      notes: platformInvoices.notes,
      createdAt: platformInvoices.createdAt,
    })
    .from(platformInvoices)
    .innerJoin(organizations, eq(platformInvoices.organizationId, organizations.id))
    .orderBy(desc(platformInvoices.createdAt));

  return rows;
}

export async function getAdminPayments() {
  const rows = await db
    .select({
      id: platformPayments.id,
      organizationId: platformPayments.organizationId,
      orgName: organizations.name,
      amount: platformPayments.amount,
      currency: platformPayments.currency,
      status: platformPayments.status,
      method: platformPayments.method,
      failureReason: platformPayments.failureReason,
      paidAt: platformPayments.paidAt,
      createdAt: platformPayments.createdAt,
    })
    .from(platformPayments)
    .innerJoin(organizations, eq(platformPayments.organizationId, organizations.id))
    .orderBy(desc(platformPayments.createdAt));

  return rows;
}

// Re-export NewPlatformCostLedgerEntry for billing service callers
import type { NewPlatformCostLedgerEntry } from '@/db/schema';

// ============================================================================
// Decimal Helpers (cents-safe)
// ============================================================================

/** Convert a decimal string (e.g. "99.95") to integer cents for safe arithmetic. */
function centsSafe(value: string | null | undefined): number {
  if (!value) return 0;
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.round(n * 100);
}

/** Convert integer cents back to a "0.00" string. */
function centsToDecimal(cents: number): string {
  return (cents / 100).toFixed(2);
}
