/**
 * Contract & Entitlement Service
 *
 * Manages commercial contracts, derives runtime entitlements from
 * contract line items, and enforces usage limits.
 *
 * @domain platform-economics
 * @layer 1.5 — Contracts & Entitlements
 */

import { db } from '@/db';
import {
  commercialContracts,
  contractLineItems,
  orgEntitlements,
  entitlementUsageLog,
  type NewCommercialContract,
  type NewContractLineItem,
  type NewOrgEntitlement,
  type ContractLineItem,
  type OrgEntitlement,
} from '@/db/schema';
import { eq, and, lte, gte, isNull, or, sql, desc, inArray } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { v4 as uuidv4 } from 'uuid';

// ============================================================================
// Types
// ============================================================================

export interface CreateContractInput {
  organizationId: string;
  billingAccountId: string;
  subscriptionId?: string;
  name: string;
  description?: string;
  effectiveDate: Date;
  expirationDate: Date;
  autoRenew?: boolean;
  renewalTermMonths?: number;
  terminationNoticeDays?: number;
  totalContractValue?: string;
  lineItems?: CreateContractLineInput[];
  createdBy?: string;
}

export interface CreateContractLineInput {
  lineType: NewContractLineItem['lineType'];
  featureKey: string;
  description: string;
  quantity?: number;
  unitPrice?: string;
  totalPrice?: string;
  usageLimit?: number;
  usagePeriod?: string;
  slaTarget?: string;
  effectiveDate: Date;
  expirationDate?: Date;
}

export interface EntitlementCheckResult {
  allowed: boolean;
  featureKey: string;
  reason?: string;
  currentUsage?: number;
  usageLimit?: number;
}

// ============================================================================
// Contract Management
// ============================================================================

function generateContractNumber(): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = uuidv4().slice(0, 6).toUpperCase();
  return `CTR-${ts}-${rand}`;
}

/**
 * Create a commercial contract with optional line items.
 * Entitlements are provisioned from each line item.
 */
export async function createContract(
  input: CreateContractInput,
) {
  const contractId = uuidv4();
  const contractNumber = generateContractNumber();

  return await db.transaction(async (tx) => {
    // Insert contract
    const [contract] = await tx
      .insert(commercialContracts)
      .values({
        id: contractId,
        organizationId: input.organizationId,
        billingAccountId: input.billingAccountId,
        subscriptionId: input.subscriptionId,
        contractNumber,
        name: input.name,
        description: input.description,
        status: 'draft',
        effectiveDate: input.effectiveDate,
        expirationDate: input.expirationDate,
        autoRenew: input.autoRenew ?? false,
        renewalTermMonths: input.renewalTermMonths ?? 12,
        terminationNoticeDays: input.terminationNoticeDays ?? 30,
        totalContractValue: input.totalContractValue,
        createdBy: input.createdBy,
      })
      .returning();

    // Insert line items + provision entitlements
    const lines: ContractLineItem[] = [];
    if (input.lineItems?.length) {
      for (const line of input.lineItems) {
        const [inserted] = await tx
          .insert(contractLineItems)
          .values({
            contractId,
            lineType: line.lineType,
            featureKey: line.featureKey,
            description: line.description,
            quantity: line.quantity ?? 1,
            unitPrice: line.unitPrice,
            totalPrice: line.totalPrice,
            usageLimit: line.usageLimit,
            usagePeriod: line.usagePeriod,
            slaTarget: line.slaTarget,
            effectiveDate: line.effectiveDate,
            expirationDate: line.expirationDate,
          })
          .returning();
        lines.push(inserted);
      }
    }

    await auditLog({
      eventType: AuditEventType.DATA_CREATE,
      severity: AuditSeverity.HIGH,
      organizationId: input.organizationId,
      resource: 'commercial_contract',
      resourceId: contractId,
      action: 'contract_created',
      userId: input.createdBy,
      metadata: { contractNumber, lineCount: lines.length },
    });

    return { contract, lineItems: lines };
  });
}

/**
 * Activate a contract and provision org_entitlements for each line item.
 */
export async function activateContract(
  contractId: string,
  approvedBy: string,
) {
  return await db.transaction(async (tx) => {
    // Update contract status
    const [contract] = await tx
      .update(commercialContracts)
      .set({
        status: 'active',
        approvedBy,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commercialContracts.id, contractId),
          eq(commercialContracts.status, 'draft'),
        ),
      )
      .returning();

    if (!contract) {
      throw new Error(`Contract ${contractId} not found or not in draft status`);
    }

    // Fetch line items
    const lines = await tx
      .select()
      .from(contractLineItems)
      .where(eq(contractLineItems.contractId, contractId));

    // Provision entitlements (upsert pattern)
    const entitlements: OrgEntitlement[] = [];
    for (const line of lines) {
      const [ent] = await tx
        .insert(orgEntitlements)
        .values({
          organizationId: contract.organizationId,
          contractLineItemId: line.id,
          featureKey: line.featureKey,
          status: 'active',
          grantedAt: new Date(),
          expiresAt: line.expirationDate ?? contract.expirationDate,
          usageLimit: line.usageLimit,
          usagePeriod: line.usagePeriod,
          currentUsage: 0,
          usagePeriodStart: new Date(),
          grantedBy: approvedBy,
        })
        .onConflictDoUpdate({
          target: [orgEntitlements.organizationId, orgEntitlements.featureKey],
          set: {
            contractLineItemId: line.id,
            status: 'active',
            expiresAt: line.expirationDate ?? contract.expirationDate,
            usageLimit: line.usageLimit,
            usagePeriod: line.usagePeriod,
            currentUsage: 0,
            usagePeriodStart: new Date(),
            grantedBy: approvedBy,
            updatedAt: new Date(),
          },
        })
        .returning();
      entitlements.push(ent);
    }

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.HIGH,
      organizationId: contract.organizationId,
      resource: 'commercial_contract',
      resourceId: contractId,
      action: 'contract_activated',
      userId: approvedBy,
      metadata: { entitlementCount: entitlements.length },
    });

    return { contract, entitlements };
  });
}

/**
 * Terminate a contract and revoke its entitlements.
 */
export async function terminateContract(
  contractId: string,
  terminatedBy: string,
  reason?: string,
) {
  return await db.transaction(async (tx) => {
    const [contract] = await tx
      .update(commercialContracts)
      .set({
        status: 'terminated',
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(commercialContracts.id, contractId),
          eq(commercialContracts.status, 'active'),
        ),
      )
      .returning();

    if (!contract) {
      throw new Error(`Contract ${contractId} not found or not active`);
    }

    // Fetch line item IDs for this contract
    const lines = await tx
      .select({ id: contractLineItems.id })
      .from(contractLineItems)
      .where(eq(contractLineItems.contractId, contractId));

    const lineIds = lines.map((l) => l.id);

    // Revoke entitlements linked to these line items
    if (lineIds.length > 0) {
      await tx
        .update(orgEntitlements)
        .set({
          status: 'revoked',
          revokedBy: terminatedBy,
          revokedAt: new Date(),
          revokeReason: reason ?? 'Contract terminated',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(orgEntitlements.organizationId, contract.organizationId),
            inArray(orgEntitlements.contractLineItemId, lineIds),
          ),
        );
    }

    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.CRITICAL,
      organizationId: contract.organizationId,
      resource: 'commercial_contract',
      resourceId: contractId,
      action: 'contract_terminated',
      userId: terminatedBy,
      metadata: { reason },
    });

    return contract;
  });
}

/**
 * Get the active contract for an org, if any.
 */
export async function getActiveContract(organizationId: string) {
  const [contract] = await db
    .select()
    .from(commercialContracts)
    .where(
      and(
        eq(commercialContracts.organizationId, organizationId),
        eq(commercialContracts.status, 'active'),
        lte(commercialContracts.effectiveDate, new Date()),
        gte(commercialContracts.expirationDate, new Date()),
      ),
    )
    .orderBy(desc(commercialContracts.effectiveDate))
    .limit(1);

  return contract ?? null;
}

/**
 * List contract line items for a contract.
 */
export async function getContractLineItems(contractId: string) {
  return await db
    .select()
    .from(contractLineItems)
    .where(eq(contractLineItems.contractId, contractId));
}

// ============================================================================
// Entitlement Enforcement
// ============================================================================

/**
 * Check whether an org has an active entitlement for a feature key.
 * This is the contract-backed equivalent of checkEntitlement in entitlements.ts.
 */
export async function checkContractEntitlement(
  organizationId: string,
  featureKey: string,
): Promise<EntitlementCheckResult> {
  const [ent] = await db
    .select()
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.organizationId, organizationId),
        eq(orgEntitlements.featureKey, featureKey),
        eq(orgEntitlements.status, 'active'),
        or(
          isNull(orgEntitlements.expiresAt),
          gte(orgEntitlements.expiresAt, new Date()),
        ),
      ),
    )
    .limit(1);

  if (!ent) {
    return {
      allowed: false,
      featureKey,
      reason: 'No active entitlement for this feature',
    };
  }

  // Check usage limit if applicable
  if (ent.usageLimit !== null && ent.currentUsage >= ent.usageLimit) {
    return {
      allowed: false,
      featureKey,
      reason: 'Usage limit exceeded',
      currentUsage: ent.currentUsage,
      usageLimit: ent.usageLimit,
    };
  }

  return {
    allowed: true,
    featureKey,
    currentUsage: ent.currentUsage,
    usageLimit: ent.usageLimit ?? undefined,
  };
}

/**
 * Record one unit of usage against an entitlement and log the event.
 */
export async function recordEntitlementUsage(
  organizationId: string,
  featureKey: string,
  userId: string,
  quantity: number = 1,
  metadata?: Record<string, unknown>,
): Promise<{ newUsage: number; limit: number | null }> {
  return await db.transaction(async (tx) => {
    // Increment currentUsage atomically
    const [updated] = await tx
      .update(orgEntitlements)
      .set({
        currentUsage: sql`${orgEntitlements.currentUsage} + ${quantity}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orgEntitlements.organizationId, organizationId),
          eq(orgEntitlements.featureKey, featureKey),
          eq(orgEntitlements.status, 'active'),
        ),
      )
      .returning();

    if (!updated) {
      throw new Error(`No active entitlement for ${featureKey} in org ${organizationId}`);
    }

    // Append to immutable usage log
    await tx.insert(entitlementUsageLog).values({
      entitlementId: updated.id,
      organizationId,
      userId,
      featureKey,
      quantity,
      metadata,
    });

    return {
      newUsage: updated.currentUsage,
      limit: updated.usageLimit,
    };
  });
}

/**
 * Reset usage counters for all entitlements whose period has elapsed.
 * Called by a scheduled job (e.g. daily cron).
 */
export async function resetExpiredUsagePeriods(): Promise<number> {
  const now = new Date();

  const result = await db
    .update(orgEntitlements)
    .set({
      currentUsage: 0,
      usagePeriodStart: now,
      lastResetAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(orgEntitlements.status, 'active'),
        sql`${orgEntitlements.usagePeriod} IS NOT NULL`,
        sql`(
          (${orgEntitlements.usagePeriod} = 'monthly'  AND ${orgEntitlements.usagePeriodStart} < NOW() - INTERVAL '1 month') OR
          (${orgEntitlements.usagePeriod} = 'annual'   AND ${orgEntitlements.usagePeriodStart} < NOW() - INTERVAL '1 year')  OR
          (${orgEntitlements.usagePeriod} = 'daily'    AND ${orgEntitlements.usagePeriodStart} < NOW() - INTERVAL '1 day')
        )`,
      ),
    )
    .returning();

  return result.length;
}
