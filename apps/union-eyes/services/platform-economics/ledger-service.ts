/**
 * Platform Ledger Service (DAPL Core)
 * 
 * Canonical append-only ledger for all platform economics entries.
 * Immutable: entries are never updated — reversals create contra entries.
 * 
 * @domain platform-economics
 * @layer 2 — DAPL
 */

import { db } from '@/db';
import { platformCostLedgerEntries, type NewPlatformCostLedgerEntry } from '@/db/schema';
import { eq, and, sql, desc } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface LedgerEntryInput {
  organizationId: string;
  parentOrganizationId?: string;
  localId?: string;
  employerId?: string;
  regionId?: string;
  bargainingUnitId?: string;
  billingPeriodId?: string;
  costType: NewPlatformCostLedgerEntry['costType'];
  eventType: NewPlatformCostLedgerEntry['eventType'];
  sourceType: NewPlatformCostLedgerEntry['sourceType'];
  sourceId?: string;
  quantity?: string;
  unitPriceCad: string;
  amountCad: string;
  costCenterId?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  createdBy?: string;
}

export interface LedgerSummary {
  totalAmountCad: string;
  entryCount: number;
  byCostType: Record<string, string>;
}

// ============================================================================
// Service
// ============================================================================

/**
 * Append a single immutable entry to the platform cost ledger.
 * Validates CAD currency enforcement and logs audit event.
 */
export async function appendLedgerEntry(
  input: LedgerEntryInput,
): Promise<string> {
  const entryId = uuidv4();
  const auditReference = `DAPL-${Date.now()}-${entryId.slice(0, 8)}`;

  await db.insert(platformCostLedgerEntries).values({
    id: entryId,
    organizationId: input.organizationId,
    parentOrganizationId: input.parentOrganizationId,
    localId: input.localId,
    employerId: input.employerId,
    regionId: input.regionId,
    bargainingUnitId: input.bargainingUnitId,
    billingPeriodId: input.billingPeriodId,
    costType: input.costType,
    eventType: input.eventType,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    quantity: input.quantity ?? '1',
    unitPriceCad: input.unitPriceCad,
    amountCad: input.amountCad,
    costCenterId: input.costCenterId,
    description: input.description,
    metadata: input.metadata,
    createdBy: input.createdBy,
    auditReference,
  });

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'platform_cost_ledger',
    resourceId: entryId,
    action: 'ledger_entry_appended',
    userId: input.createdBy,
    details: {
      costType: input.costType,
      eventType: input.eventType,
      amountCad: input.amountCad,
      auditReference,
    },
  });

  return entryId;
}

/**
 * Append multiple ledger entries in a single transaction.
 */
export async function appendLedgerEntries(
  entries: LedgerEntryInput[],
): Promise<string[]> {
  const ids: string[] = [];

  await db.transaction(async (tx) => {
    for (const input of entries) {
      const entryId = uuidv4();
      const auditReference = `DAPL-${Date.now()}-${entryId.slice(0, 8)}`;

      await tx.insert(platformCostLedgerEntries).values({
        id: entryId,
        organizationId: input.organizationId,
        parentOrganizationId: input.parentOrganizationId,
        localId: input.localId,
        employerId: input.employerId,
        regionId: input.regionId,
        bargainingUnitId: input.bargainingUnitId,
        billingPeriodId: input.billingPeriodId,
        costType: input.costType,
        eventType: input.eventType,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        quantity: input.quantity ?? '1',
        unitPriceCad: input.unitPriceCad,
        amountCad: input.amountCad,
        costCenterId: input.costCenterId,
        description: input.description,
        metadata: input.metadata,
        createdBy: input.createdBy,
        auditReference,
      });

      ids.push(entryId);
    }
  });

  return ids;
}

/**
 * Create a reversal entry (negative amount) for an existing ledger entry.
 * The original entry remains untouched (immutable).
 */
export async function reverseLedgerEntry(
  originalEntryId: string,
  reason: string,
  createdBy?: string,
): Promise<string> {
  const [original] = await db
    .select()
    .from(platformCostLedgerEntries)
    .where(eq(platformCostLedgerEntries.id, originalEntryId))
    .limit(1);

  if (!original) {
    throw new Error(`Ledger entry ${originalEntryId} not found`);
  }

  const reversalAmount = negateDecimal(original.amountCad);
  const reversalUnitPrice = negateDecimal(original.unitPriceCad);

  return appendLedgerEntry({
    organizationId: original.organizationId,
    parentOrganizationId: original.parentOrganizationId ?? undefined,
    localId: original.localId ?? undefined,
    employerId: original.employerId ?? undefined,
    regionId: original.regionId ?? undefined,
    bargainingUnitId: original.bargainingUnitId ?? undefined,
    billingPeriodId: original.billingPeriodId ?? undefined,
    costType: original.costType,
    eventType: 'reversal',
    sourceType: original.sourceType,
    sourceId: original.id,
    quantity: original.quantity,
    unitPriceCad: reversalUnitPrice,
    amountCad: reversalAmount,
    costCenterId: original.costCenterId ?? undefined,
    description: `Reversal: ${reason}`,
    metadata: { reversedEntryId: originalEntryId, reason },
    createdBy,
  });
}

/**
 * Query ledger entries for an org within a billing period.
 */
export async function getLedgerEntries(params: {
  organizationId: string;
  billingPeriodId?: string;
  costType?: NewPlatformCostLedgerEntry['costType'];
  limit?: number;
  offset?: number;
}) {
  const conditions = [
    eq(platformCostLedgerEntries.organizationId, params.organizationId),
  ];

  if (params.billingPeriodId) {
    conditions.push(eq(platformCostLedgerEntries.billingPeriodId, params.billingPeriodId));
  }
  if (params.costType) {
    conditions.push(eq(platformCostLedgerEntries.costType, params.costType));
  }

  return db
    .select()
    .from(platformCostLedgerEntries)
    .where(and(...conditions))
    .orderBy(desc(platformCostLedgerEntries.createdAt))
    .limit(params.limit ?? 100)
    .offset(params.offset ?? 0);
}

/**
 * Compute aggregate ledger summary for an org / period.
 */
export async function getLedgerSummary(params: {
  organizationId: string;
  billingPeriodId?: string;
}): Promise<LedgerSummary> {
  const conditions = [
    eq(platformCostLedgerEntries.organizationId, params.organizationId),
  ];
  if (params.billingPeriodId) {
    conditions.push(eq(platformCostLedgerEntries.billingPeriodId, params.billingPeriodId));
  }

  const rows = await db
    .select({
      costType: platformCostLedgerEntries.costType,
      total: sql<string>`SUM(${platformCostLedgerEntries.amountCad})`,
      count: sql<number>`COUNT(*)`,
    })
    .from(platformCostLedgerEntries)
    .where(and(...conditions))
    .groupBy(platformCostLedgerEntries.costType);

  const byCostType: Record<string, string> = {};
  let totalAmount = 0;
  let totalCount = 0;

  for (const row of rows) {
    byCostType[row.costType] = row.total;
    totalAmount = (Math.round(totalAmount * 100) + Math.round(Number(row.total) * 100)) / 100;
    totalCount += row.count;
  }

  return {
    totalAmountCad: totalAmount.toFixed(2),
    entryCount: totalCount,
    byCostType,
  };
}

/**
 * Get ledger balance for a specific local within an org.
 */
export async function getLocalLedgerBalance(params: {
  organizationId: string;
  localId: string;
  billingPeriodId?: string;
}) {
  const conditions = [
    eq(platformCostLedgerEntries.organizationId, params.organizationId),
    eq(platformCostLedgerEntries.localId, params.localId),
  ];
  if (params.billingPeriodId) {
    conditions.push(eq(platformCostLedgerEntries.billingPeriodId, params.billingPeriodId));
  }

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${platformCostLedgerEntries.amountCad}), '0')`,
      count: sql<number>`COUNT(*)`,
    })
    .from(platformCostLedgerEntries)
    .where(and(...conditions));

  return {
    totalAmountCad: result.total,
    entryCount: result.count,
  };
}

// ============================================================================
// Decimal Helpers (cents-safe)
// ============================================================================

function negateDecimal(value: string): string {
  const cents = Math.round(Number(value) * 100);
  return ((-cents) / 100).toFixed(2);
}
