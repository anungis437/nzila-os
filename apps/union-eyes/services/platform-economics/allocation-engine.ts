/**
 * Allocation Engine Service
 * 
 * Distributes platform costs across locals/units based on configurable rules.
 * Supports simulation mode (no writes), rule versioning, and period locking.
 * 
 * @domain platform-economics
 * @layer 3 — Allocation Engine
 */

import { db } from '@/db';
import { toCents, fromCents, multiplyMoney, compareMoney } from '@/lib/decimal-safe';
import {
  allocationRules,
  allocationRuleVersions,
  allocationRuns,
  allocationRunLines,
  allocationBasisSnapshots,
  chargebackStatements,
  platformCostLedgerEntries,
  billingPeriods,
  type AllocationRuleVersion,
} from '@/db/schema';
import { eq, and, desc, lte, gte, isNull, or, sql } from 'drizzle-orm';
import { appendLedgerEntry } from './ledger-service';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface CreateAllocationRuleInput {
  organizationId: string;
  name: string;
  description?: string;
  method: AllocationRuleVersion['method'];
  weights?: Record<string, number>;
  effectiveFrom: Date;
  effectiveTo?: Date;
  createdBy?: string;
}

export interface LocalBasis {
  localId: string;
  localName?: string;
  memberCount: number;
  activeUserCount: number;
  caseVolume: number;
  remittanceSummary?: number;
}

export interface RunAllocationInput {
  organizationId: string;
  billingPeriodId: string;
  ruleId: string;
  isSimulation?: boolean;
  localBasis: LocalBasis[];
  createdBy?: string;
}

export interface AllocationResult {
  runId: string;
  isSimulation: boolean;
  totalAmount: string;
  lines: Array<{
    localId: string;
    localName?: string;
    method: string;
    basisValue: string;
    weight: string;
    allocatedAmount: string;
    costType: string;
  }>;
}

// ============================================================================
// Rule Management
// ============================================================================

export async function createAllocationRule(input: CreateAllocationRuleInput) {
  const result = await db.transaction(async (tx) => {
    const [rule] = await tx
      .insert(allocationRules)
      .values({
        organizationId: input.organizationId,
        name: input.name,
        description: input.description,
        createdBy: input.createdBy,
      })
      .returning();

    const [version] = await tx
      .insert(allocationRuleVersions)
      .values({
        ruleId: rule.id,
        version: 1,
        method: input.method,
        weights: input.weights,
        effectiveFrom: input.effectiveFrom,
        effectiveTo: input.effectiveTo,
        createdBy: input.createdBy,
      })
      .returning();

    return { rule, version };
  });

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.HIGH,
    organizationId: input.organizationId,
    resource: 'allocation_rule',
    resourceId: result.rule.id,
    action: 'allocation_rule_created',
    userId: input.createdBy,
    details: { name: input.name, method: input.method, weights: input.weights },
  });

  return result;
}

export async function getActiveRuleVersion(
  ruleId: string,
  asOfDate: Date = new Date(),
): Promise<AllocationRuleVersion | null> {
  const [version] = await db
    .select()
    .from(allocationRuleVersions)
    .where(
      and(
        eq(allocationRuleVersions.ruleId, ruleId),
        lte(allocationRuleVersions.effectiveFrom, asOfDate),
        or(
          isNull(allocationRuleVersions.effectiveTo),
          gte(allocationRuleVersions.effectiveTo, asOfDate),
        ),
      ),
    )
    .orderBy(desc(allocationRuleVersions.version))
    .limit(1);

  return version ?? null;
}

export async function getAllocationRules(organizationId: string) {
  return db
    .select()
    .from(allocationRules)
    .where(eq(allocationRules.organizationId, organizationId))
    .orderBy(desc(allocationRules.createdAt));
}

// ============================================================================
// Allocation Execution
// ============================================================================

/**
 * Run cost allocation for a billing period.
 * 
 * In simulation mode (isSimulation=true), no ledger entries or chargebacks
 * are created. The run is stored as status='simulated' for preview.
 */
export async function runAllocation(
  input: RunAllocationInput,
): Promise<AllocationResult> {
  // Validate period is not closed (unless simulation)
  if (!input.isSimulation) {
    const [period] = await db
      .select()
      .from(billingPeriods)
      .where(eq(billingPeriods.id, input.billingPeriodId))
      .limit(1);

    if (!period) throw new Error(`Billing period ${input.billingPeriodId} not found`);
    if (period.isClosed) throw new Error(`Billing period ${period.label} is closed`);
  }

  // Get effective rule version
  const ruleVersion = await getActiveRuleVersion(input.ruleId);
  if (!ruleVersion) throw new Error(`No active version for rule ${input.ruleId}`);

  // Calculate total unallocated cost for the period
  const [costResult] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${platformCostLedgerEntries.amountCad}), '0')`,
    })
    .from(platformCostLedgerEntries)
    .where(
      and(
        eq(platformCostLedgerEntries.organizationId, input.organizationId),
        eq(platformCostLedgerEntries.billingPeriodId, input.billingPeriodId),
        eq(platformCostLedgerEntries.allocationStatus, 'unallocated'),
      ),
    );

  const totalCostCents = toCents(costResult.total);
  if (totalCostCents <= 0 && !input.isSimulation) {
    throw new Error('No unallocated costs for this period');
  }

  // Calculate allocation basis totals
  const basisTotals = computeBasisTotals(input.localBasis, ruleVersion);

  // Allocate to each local
  const lines = input.localBasis.map((local) => {
    const share = computeLocalShare(local, basisTotals, ruleVersion);
    const allocatedAmount = multiplyMoney(fromCents(totalCostCents), share);

    return {
      localId: local.localId,
      localName: local.localName,
      method: ruleVersion.method,
      basisValue: getBasisValueForMethod(local, ruleVersion.method).toFixed(4),
      weight: (share * 100).toFixed(2),
      allocatedAmount,
      costType: 'base_subscription' as const,
    };
  });

  // Reconciliation: ensure allocations sum to total (distribute rounding to largest)
  const allocatedSumCents = lines.reduce((s, l) => s + toCents(l.allocatedAmount), 0);
  const roundingCents = totalCostCents - allocatedSumCents;
  if (Math.abs(roundingCents) > 0 && lines.length > 0) {
    // Apply rounding difference to largest allocation
    const maxLine = lines.reduce((a, b) =>
      compareMoney(a.allocatedAmount, b.allocatedAmount) >= 0 ? a : b,
    );
    maxLine.allocatedAmount = fromCents(toCents(maxLine.allocatedAmount) + roundingCents);
  }

  // Persist
  const runId = uuidv4();

  await db.transaction(async (tx) => {
    await tx.insert(allocationRuns).values({
      id: runId,
      organizationId: input.organizationId,
      billingPeriodId: input.billingPeriodId,
      ruleVersionId: ruleVersion.id,
      status: input.isSimulation ? 'simulated' : 'posted',
      isSimulation: input.isSimulation ?? false,
      totalAmount: totalCost.toFixed(2),
      lineCount: lines.length,
      startedAt: new Date(),
      completedAt: new Date(),
      createdBy: input.createdBy,
    });

    // Snapshot basis data
    for (const local of input.localBasis) {
      await tx.insert(allocationBasisSnapshots).values({
        runId,
        localId: local.localId,
        memberCount: local.memberCount,
        activeUserCount: local.activeUserCount,
        caseVolume: local.caseVolume,
        remittanceSummary: local.remittanceSummary?.toFixed(2) ?? '0',
      });
    }

    // Insert allocation lines
    for (const line of lines) {
      await tx.insert(allocationRunLines).values({
        runId,
        localId: line.localId,
        localName: line.localName,
        method: line.method as AllocationRuleVersion['method'],
        basisValue: line.basisValue,
        weight: line.weight,
        allocatedAmount: line.allocatedAmount,
        costType: line.costType,
      });
    }

    // If not simulation, create ledger entries and chargebacks
    if (!input.isSimulation) {
      for (const line of lines) {
        const entryId = uuidv4();
        // We bypass the service to write inside the same transaction
        await tx.insert(platformCostLedgerEntries).values({
          id: entryId,
          organizationId: input.organizationId,
          localId: line.localId,
          billingPeriodId: input.billingPeriodId,
          costType: 'base_subscription',
          eventType: 'allocation_run',
          sourceType: 'allocation',
          sourceId: runId,
          quantity: '1',
          unitPriceCad: line.allocatedAmount,
          amountCad: line.allocatedAmount,
          allocationStatus: 'allocated',
          allocationRunId: runId,
          description: `Cost allocation to ${line.localName ?? line.localId}`,
          createdBy: input.createdBy,
          auditReference: `ALLOC-${runId.slice(0, 8)}`,
        });

        // Chargeback statement
        await tx.insert(chargebackStatements).values({
          organizationId: input.organizationId,
          localId: line.localId,
          billingPeriodId: input.billingPeriodId,
          allocationRunId: runId,
          totalAmount: line.allocatedAmount,
          currency: 'CAD',
          status: 'issued',
          issuedAt: new Date(),
          createdBy: input.createdBy,
        });
      }

      // Mark original ledger entries as allocated
      await tx
        .execute(sql`
          UPDATE platform_cost_ledger_entries
          SET allocation_status = 'allocated',
              allocation_run_id = ${runId}
          WHERE organization_id = ${input.organizationId}
            AND billing_period_id = ${input.billingPeriodId}
            AND allocation_status = 'unallocated'
            AND event_type != 'allocation_run'
        `);
    }
  });

  await auditLog({
    eventType: AuditEventType.DATA_CREATE,
    severity: AuditSeverity.CRITICAL,
    organizationId: input.organizationId,
    resource: 'allocation_run',
    resourceId: runId,
    action: input.isSimulation ? 'allocation_simulated' : 'allocation_posted',
    userId: input.createdBy,
    details: {
      totalAmount: totalCost.toFixed(2),
      lineCount: lines.length,
      method: ruleVersion.method,
    },
  });

  return {
    runId,
    isSimulation: input.isSimulation ?? false,
    totalAmount: totalCost.toFixed(2),
    lines,
  };
}

// ============================================================================
// Allocation Math
// ============================================================================

function computeBasisTotals(
  locals: LocalBasis[],
  ruleVersion: AllocationRuleVersion,
): Record<string, number> {
  const totals: Record<string, number> = {
    memberCount: 0,
    activeUserCount: 0,
    caseVolume: 0,
    localCount: locals.length,
  };

  for (const local of locals) {
    totals.memberCount += local.memberCount;
    totals.activeUserCount += local.activeUserCount;
    totals.caseVolume += local.caseVolume;
  }

  return totals;
}

function computeLocalShare(
  local: LocalBasis,
  totals: Record<string, number>,
  ruleVersion: AllocationRuleVersion,
): number {
  const method = ruleVersion.method;

  switch (method) {
    case 'per_member_count':
      return totals.memberCount > 0 ? local.memberCount / totals.memberCount : 0;

    case 'per_active_user':
      return totals.activeUserCount > 0 ? local.activeUserCount / totals.activeUserCount : 0;

    case 'per_case_volume':
      return totals.caseVolume > 0 ? local.caseVolume / totals.caseVolume : 0;

    case 'per_local_flat':
      return totals.localCount > 0 ? 1 / totals.localCount : 0;

    case 'weighted_hybrid': {
      const weights = (ruleVersion.weights ?? {}) as Record<string, number>;
      let share = 0;
      const totalWeight = Object.values(weights).reduce((s, w) => s + w, 0);
      if (totalWeight === 0) return 0;

      for (const [key, weight] of Object.entries(weights)) {
        const normalizedWeight = weight / totalWeight;
        const methodShare = computeLocalShare(
          local,
          totals,
          { ...ruleVersion, method: key as AllocationRuleVersion['method'] },
        );
        share += normalizedWeight * methodShare;
      }
      return share;
    }

    case 'manual_override':
      // For manual, weights contain direct percentages per localId
      return ((ruleVersion.weights ?? {})[local.localId] ?? 0) / 100;

    case 'subsidized':
      // Subsidized: equal split (subsidy reduces total before allocation)
      return totals.localCount > 0 ? 1 / totals.localCount : 0;

    default:
      return 0;
  }
}

function getBasisValueForMethod(local: LocalBasis, method: string): number {
  switch (method) {
    case 'per_member_count': return local.memberCount;
    case 'per_active_user': return local.activeUserCount;
    case 'per_case_volume': return local.caseVolume;
    case 'per_local_flat': return 1;
    default: return local.memberCount;
  }
}

// ============================================================================
// Queries
// ============================================================================

export async function getAllocationRun(runId: string) {
  const [run] = await db
    .select()
    .from(allocationRuns)
    .where(eq(allocationRuns.id, runId))
    .limit(1);

  if (!run) return null;

  const lines = await db
    .select()
    .from(allocationRunLines)
    .where(eq(allocationRunLines.runId, runId));

  const snapshots = await db
    .select()
    .from(allocationBasisSnapshots)
    .where(eq(allocationBasisSnapshots.runId, runId));

  return { ...run, lines, snapshots };
}

export async function getChargebacks(params: {
  organizationId: string;
  billingPeriodId?: string;
  localId?: string;
}) {
  const conditions = [
    eq(chargebackStatements.organizationId, params.organizationId),
  ];
  if (params.billingPeriodId) {
    conditions.push(eq(chargebackStatements.billingPeriodId, params.billingPeriodId));
  }
  if (params.localId) {
    conditions.push(eq(chargebackStatements.localId, params.localId));
  }

  return db
    .select()
    .from(chargebackStatements)
    .where(and(...conditions))
    .orderBy(desc(chargebackStatements.createdAt));
}
