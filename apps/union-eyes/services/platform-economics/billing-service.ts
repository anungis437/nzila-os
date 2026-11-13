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
  organizations,
  type NewBillingAccount,
} from '@/db/schema';
import { eq, and, desc, inArray, or, lt } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
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

// Validate invoice multipliers before converting to CAD or issuing an invoice.
// Number arithmetic beyond MAX_SAFE_INTEGER cents can silently alter charges.
function safeFeeProduct(unitCents: number, count: number): number {
  if (!Number.isSafeInteger(unitCents) || unitCents < 0 ||
      !Number.isSafeInteger(count) || count < 0 ||
      (unitCents !== 0 && count > Math.floor(Number.MAX_SAFE_INTEGER / unitCents))) {
    throw new Error('Invoice fee multiplication exceeds safe CAD limits');
  }
  return unitCents * count;
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
  // The unique (organization_id, label) index arbitrates concurrent creators.
  // Never return a period with different dates for the same label.
  const [created] = await db
    .insert(billingPeriods)
    .values({ organizationId, label, periodStart, periodEnd })
    .onConflictDoNothing({ target: [billingPeriods.organizationId, billingPeriods.label] })
    .returning();

  if (created) return created;

  const [existing] = await db
    .select()
    .from(billingPeriods)
    .where(and(eq(billingPeriods.organizationId, organizationId), eq(billingPeriods.label, label)))
    .limit(1);

  if (!existing) throw new Error('Billing period conflict could not be resolved');
  if (existing.periodStart.getTime() !== periodStart.getTime() ||
      existing.periodEnd.getTime() !== periodEnd.getTime()) {
    throw new Error('Billing period label conflicts with existing dates');
  }
  return existing;
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
    .where(and(
      eq(billingPeriods.id, billingPeriodId),
      eq(billingPeriods.organizationId, period.organizationId),
      eq(billingPeriods.isClosed, false),
    ))
    .returning();

  // Reconciliation and the initial read do not serialize concurrent closers.
  // Only the caller that actually transitions the period may claim closure.
  if (!updated) throw new Error('Billing period was already closed or changed concurrently');

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
    .where(and(eq(billingPeriods.id, input.billingPeriodId), eq(billingPeriods.organizationId, input.organizationId)))
    .limit(1);
  if (!period || period.organizationId !== input.organizationId) {
    throw new Error('Billing period not found for organization');
  }

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
  // Fail closed on ambiguous pricing authority: choosing the first active
  // subscription would issue an invoice against an arbitrary plan.
  const activeSubscriptions = await db
    .select()
    .from(orgSubscriptions)
    .where(
      and(
        eq(orgSubscriptions.organizationId, input.organizationId),
        eq(orgSubscriptions.status, 'active'),
      ),
    )
    .limit(2);

  if (activeSubscriptions.length > 1) {
    throw new Error('Cannot generate invoice: multiple active subscriptions require reconciliation');
  }
  const subscription = activeSubscriptions[0];
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
  if (!Number.isSafeInteger(localCount) || localCount < 0) {
    throw new Error('Invoice local count is invalid');
  }
  if (perLocalFeeCents > 0 && localCount > 0) {
    lineItems.push({
      description: `Local Fee × ${localCount}`,
      costType: 'local_fee',
      quantity: String(localCount),
      unitPrice: plan.perLocalFee!,
      amount: centsToDecimal(safeFeeProduct(perLocalFeeCents, localCount)),
    });
  }

  const perSeatFeeCents = centsSafe(plan.perSeatFee ?? '0');
  const seatCount = subscription.seatCount ?? 0;
  if (!Number.isSafeInteger(seatCount) || seatCount < 0) {
    throw new Error('Invoice seat count is invalid');
  }
  if (perSeatFeeCents > 0 && seatCount > 0) {
    lineItems.push({
      description: `Seat Fee × ${seatCount}`,
      costType: 'seat_fee',
      quantity: String(seatCount),
      unitPrice: plan.perSeatFee!,
      amount: centsToDecimal(safeFeeProduct(perSeatFeeCents, seatCount)),
    });
  }

  // Subscription module data is persisted JSON; a TypeScript cast does not validate it.
  // Reject malformed or duplicated modules rather than issuing an incorrect invoice.
  const modules = subscription.moduleList as string[] | null;
  if (modules != null && (!Array.isArray(modules) ||
      modules.some((moduleId) => typeof moduleId !== 'string' || moduleId.trim().length === 0) ||
      new Set(modules).size !== modules.length)) {
    throw new Error('Invoice subscription modules are invalid');
  }
  const perModuleFeeCents = centsSafe(plan.perModuleFee ?? '0');
  if (perModuleFeeCents > 0 && modules && modules.length > 0) {
    lineItems.push({
      description: `Module Fee × ${modules.length}`,
      costType: 'module_fee',
      quantity: String(modules.length),
      unitPrice: plan.perModuleFee!,
      amount: centsToDecimal(safeFeeProduct(perModuleFeeCents, modules.length)),
    });
  }

  // Usage-driven line items are not billed: metering is not implemented. The only writer of usage_events / usage_aggregates
  // (usage-metering-service.ts) has no caller, so there is no usage to invoice, and the application's roles hold no grant on the
  // metering tables (they are LATENT_UNREACHABLE in the storage-authority manifest). An invoice carries the subscription fees; when
  // metering exists, its line items come back with the metering tables' authority declared.

  // Apply discount — cents-safe arithmetic
  let subtotalCents = lineItems.reduce((sum, li) => {
    const amount = centsSafe(li.amount);
    if (amount > Number.MAX_SAFE_INTEGER - sum) {
      throw new Error('Invoice subtotal exceeds safe CAD limits');
    }
    return sum + amount;
  }, 0);
  const discountPct = centsSafe(subscription.discountPercent ?? '0');
  if (discountPct > 10000) {
    throw new Error('Invoice discount exceeds 100 percent');
  }
  if (discountPct > 0) {
    // Multiplication in floating point can lose integer-cent precision.
    const discountCents = Number((BigInt(subtotalCents) * BigInt(discountPct) + 5000n) / 10000n);
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
  if (subsidyCents > subtotalCents) {
    throw new Error('Invoice subsidy exceeds remaining charges');
  }
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

  // The invoice, its lines, its ledger entries and its audit record commit together: a failure of any leaves no invoice.
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

    // Ledger entries for each non-zero line item
    for (const li of lineItems) {
      const amt = centsSafe(li.amount);
      if (amt === 0) continue;

      await appendLedgerEntry({
        organizationId: input.organizationId,
        billingPeriodId: input.billingPeriodId,
        costType: li.costType as NewPlatformCostLedgerEntry['costType'],
        eventType: 'invoice_generated',
        sourceType: 'invoice',
        sourceId: invoice.id,
        quantity: li.quantity,
        unitPriceCad: li.unitPrice,
        amountCad: li.amount,
        description: li.description,
        createdBy: input.createdBy,
      }, tx);
    }

    await persistAtomicAudit(tx as unknown as RLSTx, {
      organizationId: input.organizationId,
      userId: input.createdBy,
      action: 'invoice_generated',
      resourceType: 'platform_invoice',
      resourceId: invoice.id,
      details: { invoiceNumber, totalAmount: centsToDecimal(totalCents), lineItemCount: lineItems.length },
    });

    return invoice;
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
      .where(and(eq(platformPayments.organizationId, input.organizationId), eq(platformPayments.externalReference, input.idempotencyKey)))
      .limit(1);

    if (existing) {
      if (existing.organizationId !== input.organizationId || existing.amount !== input.amount) {
        throw new Error('Payment idempotency reference conflicts with the requested organization or amount');
      }
      // A reference cannot safely identify a payment without proving its invoice allocation.
      throw new Error('Payment idempotency replay requires verified invoice allocation');
    }
    // No database-enforced uniqueness currently protects concurrent keyed payments.
    throw new Error('Keyed payment recording unavailable until transactional idempotency is enforced');
  }

  // Reject malformed CAD amounts before financial writes; centsSafe alone can round precision.
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.amount)) {
    throw new Error('Payment amount must be a valid CAD amount with at most two decimals');
  }
  const paymentAmountCents = centsSafe(input.amount);
  if (!Number.isSafeInteger(paymentAmountCents) || paymentAmountCents <= 0) {
    throw new Error('Payment amount must be positive and within safe CAD limits');
  }

  const result = await db.transaction(async (tx) => {
    // Lock the invoice before reading its balance. Concurrent payments for this
    // invoice serialize on the same row, preventing stale amountPaid writes.
    const [invoice] = await tx
      .select()
      .from(platformInvoices)
      .where(and(eq(platformInvoices.id, input.invoiceId), eq(platformInvoices.organizationId, input.organizationId)))
      .for('update')
      .limit(1);
    if (!invoice || invoice.organizationId !== input.organizationId) throw new Error('Invoice not found for organization');
    if (invoice.status === 'void' || invoice.status === 'written_off') {
      throw new Error('Cannot record payment against a void or written-off invoice');
    }
    const alreadyPaidCents = centsSafe(invoice.amountPaid);
    const totalDueCents = centsSafe(invoice.totalAmount);
    const newAmountPaidCents = alreadyPaidCents + paymentAmountCents;
    // Financial state must be nonnegative, internally consistent and exactly
    // representable in integer cents before any payment or allocation insert.
    if (!Number.isSafeInteger(alreadyPaidCents) || alreadyPaidCents < 0 ||
        !Number.isSafeInteger(totalDueCents) || totalDueCents < 0 ||
        alreadyPaidCents > totalDueCents || !Number.isSafeInteger(newAmountPaidCents)) {
      throw new Error('Invoice balance is invalid or exceeds safe CAD limits');
    }
    if (newAmountPaidCents > totalDueCents) {
      throw new Error('Payment exceeds remaining invoice balance');
    }

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
    const newStatus = newAmountPaidCents === totalDueCents ? 'paid' : 'partially_paid';

    const [updatedInvoice] = await tx
      .update(platformInvoices)
      .set({
        amountPaid: centsToDecimal(newAmountPaidCents),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(and(eq(platformInvoices.id, input.invoiceId), eq(platformInvoices.organizationId, input.organizationId)))
      .returning({ id: platformInvoices.id });

    // Never commit an orphaned payment or claim success if the invoice disappeared.
    if (!updatedInvoice) throw new Error('Invoice payment balance update failed');

    // Payment, allocation, balance, immutable ledger and audit are one commit.
    // A failed ledger/audit write rolls back every financial mutation.
    await appendLedgerEntry({
      organizationId: input.organizationId,
      billingPeriodId: invoice.billingPeriodId ?? undefined,
      costType: 'credit',
      eventType: 'payment_received',
      sourceType: 'payment',
      sourceId: payment.id,
      unitPriceCad: `-${input.amount}`,
      amountCad: `-${input.amount}`,
      description: `Payment received — ${input.method}`,
      createdBy: input.createdBy,
    }, tx);
    await persistAtomicAudit(tx as unknown as RLSTx, {
      organizationId: input.organizationId,
      userId: input.createdBy,
      action: 'payment_recorded',
      resourceType: 'platform_payment',
      resourceId: payment.id,
      details: { amount: input.amount, method: input.method, invoiceId: input.invoiceId },
    });

    return payment;
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
  if (!input.externalReference?.trim()) throw new Error('External payment reference is required');
  if (input.status !== undefined && input.status !== 'completed' && input.status !== 'failed') {
    throw new Error('Unsupported external payment status');
  }
  if (!/^\d+(?:\.\d{1,2})?$/.test(input.amount)) {
    throw new Error('External payment amount must be a non-negative CAD amount with at most two decimals');
  }
  const paymentAmountCents = centsSafe(input.amount);
  if (!Number.isSafeInteger(paymentAmountCents) || paymentAmountCents < 0) {
    throw new Error('External payment amount exceeds safe CAD limits');
  }
  const normalizedStatus = input.status ?? 'completed';
  if (normalizedStatus === 'completed' && paymentAmountCents <= 0) {
    throw new Error('Completed external payment amount must be positive');
  }

  // Payment insertion, allocation and invoice mutation share one rollback boundary.
  // Lock the invoice before reading its balance to serialize competing settlements.
  return db.transaction(async (tx) => {
    const [invoice] = await tx
      .select()
      .from(platformInvoices)
      .where(and(eq(platformInvoices.id, input.invoiceId), eq(platformInvoices.organizationId, input.organizationId)))
      .for('update')
      .limit(1);
    if (!invoice) throw new Error('Invoice not found for organization');

    const [existingPayment] = await tx
      .select()
      .from(platformPayments)
      .where(and(eq(platformPayments.organizationId, input.organizationId), eq(platformPayments.externalReference, input.externalReference)))
      .limit(1);
    if (existingPayment) {
      if (existingPayment.organizationId !== input.organizationId || existingPayment.amount !== input.amount) {
        throw new Error('External payment reference conflicts with the requested organization or amount');
      }
      throw new Error('External payment replay requires verified invoice allocation');
    }

    const [account] = await tx
      .select()
      .from(billingAccounts)
      .where(eq(billingAccounts.organizationId, input.organizationId))
      .limit(1);
    if (!account) throw new Error('No billing account for organization');

    let newAmountPaidCents = 0;
    if (normalizedStatus === 'completed') {
      if (invoice.status === 'void' || invoice.status === 'written_off') {
        throw new Error('Cannot settle a void or written-off invoice');
      }
      const alreadyPaidCents = centsSafe(invoice.amountPaid);
      const totalDueCents = centsSafe(invoice.totalAmount);
      // Reject corrupt persisted balances before settlement, including negative
      // paid/total values and paid amounts already exceeding the invoice total.
      // A failed settlement must not repair corruption by silently rewriting it.
      if (!Number.isSafeInteger(alreadyPaidCents) || alreadyPaidCents < 0 ||
          !Number.isSafeInteger(totalDueCents) || totalDueCents < 0 ||
          alreadyPaidCents > totalDueCents) {
        throw new Error('External settlement invoice balance is invalid');
      }
      newAmountPaidCents = alreadyPaidCents + paymentAmountCents;
      if (!Number.isSafeInteger(newAmountPaidCents) || newAmountPaidCents > totalDueCents) {
        throw new Error('External settlement exceeds invoice balance');
      }
    }

    const [payment] = await tx
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
    if (!payment) throw new Error('External payment insert returned no record');

    if (normalizedStatus === 'completed') {
      await tx.insert(paymentAllocations).values({
        paymentId: payment.id,
        invoiceId: invoice.id,
        amount: input.amount,
        createdBy: input.createdBy,
      });
      const newStatus = newAmountPaidCents === centsSafe(invoice.totalAmount) ? 'paid' : 'partially_paid';
      const [updated] = await tx.update(platformInvoices).set({
        amountPaid: centsToDecimal(newAmountPaidCents),
        status: newStatus,
        updatedAt: new Date(),
        metadata: {
          ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
          lifecycleState: newStatus === 'paid' ? 'paid' : 'finalized',
          lastReconciledPaymentId: payment.id,
        },
      }).where(and(eq(platformInvoices.id, invoice.id), eq(platformInvoices.organizationId, input.organizationId))).returning();
      if (!updated) throw new Error('External payment invoice update failed');
    } else if (invoice.status !== 'paid' && invoice.status !== 'void' && invoice.status !== 'written_off') {
      const [updated] = await tx.update(platformInvoices).set({
        status: 'overdue',
        updatedAt: new Date(),
        metadata: {
          ...((invoice.metadata as Record<string, unknown> | null) ?? {}),
          lifecycleState: 'failed',
          lastFailedPaymentRef: input.externalReference,
          lastFailureReason: input.failureReason ?? null,
        },
      }).where(and(eq(platformInvoices.id, invoice.id), eq(platformInvoices.organizationId, input.organizationId))).returning();
      if (!updated) throw new Error('External payment failure update failed');
    }
    return payment;
  });
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
        .where(and(eq(platformInvoices.id, draft.id), eq(platformInvoices.organizationId, subscription.organizationId)));
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
        .where(and(eq(platformInvoices.id, inv.id), eq(platformInvoices.organizationId, subscription.organizationId)));
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

export async function getInvoices(organizationId: string, limit = 50, offset = 0) {
  return db
    .select()
    .from(platformInvoices)
    .where(eq(platformInvoices.organizationId, organizationId))
    .orderBy(desc(platformInvoices.issueDate), desc(platformInvoices.id))
    .limit(limit)
    .offset(offset);
}

/** eader is the caller's tenant transaction when the read and its audit record must commit together; it defaults to the shared handle. */
export async function getInvoiceWithLineItems(invoiceId: string, organizationId: string, reader: Pick<typeof db, 'select'> = db) {
  const [invoice] = await reader
    .select()
    .from(platformInvoices)
    .where(and(eq(platformInvoices.id, invoiceId), eq(platformInvoices.organizationId, organizationId)))
    .limit(1);

  if (!invoice || invoice.organizationId !== organizationId) return null;

  const lineItems = await reader
    .select()
    .from(platformInvoiceLineItems)
    .where(eq(platformInvoiceLineItems.invoiceId, invoiceId));

  return { ...invoice, lineItems };
}

export async function replayInvoiceDeterministically(invoiceId: string, organizationId: string, reader: Pick<typeof db, 'select'> = db) {
  const invoiceData = await getInvoiceWithLineItems(invoiceId, organizationId, reader);
  if (!invoiceData) return null;

  let recomputedSubtotalCents = 0;
  const lineage: Array<Record<string, unknown>> = [];

  for (const item of invoiceData.lineItems) {
    // Discounts and subsidies are legitimate negative invoice lines. Validate the
    // persisted decimal exactly and restrict negative values to those cost types.
    // centsSafe intentionally rounds and cannot validate corrupted stored amounts.
    const rawAmount = String(item.amount);
    const isAdjustment = item.costType === 'credit' || item.costType === 'subsidy';
    if (!/^-?\\d+(?:\\.\\d{1,2})?$/.test(rawAmount) ||
        (!isAdjustment && rawAmount.startsWith('-')) ||
        (isAdjustment && !rawAmount.startsWith('-'))) {
      throw new Error('Invoice replay contains invalid or overflowing line-item amounts');
    }
    const amountCents = Number(rawAmount) * 100;
    const roundedCents = Math.round(amountCents);
    if (!Number.isSafeInteger(roundedCents) ||
        Math.abs(amountCents - roundedCents) > 0.000001 ||
        !Number.isSafeInteger(recomputedSubtotalCents + roundedCents) ||
        recomputedSubtotalCents + roundedCents < 0) {
      throw new Error('Invoice replay contains invalid or overflowing line-item amounts');
    }
    recomputedSubtotalCents += roundedCents;

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
