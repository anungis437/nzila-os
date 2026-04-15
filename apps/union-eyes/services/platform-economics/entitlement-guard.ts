/**
 * Entitlement Guard
 *
 * Server-side middleware that enforces contract-based module access.
 * Routes and API handlers call these guards to verify the requesting
 * org has an active entitlement for the required feature/module.
 *
 * Usage:
 *   import { requireEntitlement, withEntitlement } from '@/services/platform-economics/entitlement-guard';
 *
 *   // In withApi handler:
 *   await requireEntitlement(organizationId, 'governance_suite');
 *
 *   // As route wrapper:
 *   export const GET = withEntitlement('governance_suite', handler);
 *
 * @domain platform-economics
 * @layer 7 — Contract-Aware Runtime Enforcement
 */

import { db } from '@/db';
import {
  orgEntitlements,
  contractCoveredOrgs,
} from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { NextResponse } from 'next/server';

// ============================================================================
// Module Keys (canonical feature identifiers)
// ============================================================================

export const PLATFORM_MODULES = {
  GOVERNANCE_SUITE: 'governance_suite',
  GRIEVANCE_CASE_SUITE: 'grievance_case_suite',
  FINANCIAL_INTELLIGENCE_SUITE: 'financial_intelligence_suite',
  AI_ADVANCED_INSIGHTS: 'ai_advanced_insights',
  ALLOCATION_ENGINE: 'allocation_engine',
  TRANSACTION_FEES: 'transaction_fees',
  COMMERCIAL_REPORTING: 'commercial_reporting',
  EXPORT_SUITE: 'export_suite',
  HEALTH_SAFETY: 'health_safety',
  PERFORMANCE_TARGETS: 'performance_targets',
  EMPLOYER_EXECUTION: 'employer_execution',
  EMPLOYER_TIMESHEET_INGEST: 'employer_timesheet_ingest',
  EMPLOYER_PAYROLL_PREVIEW: 'employer_payroll_preview',
  EMPLOYER_PAYROLL_OFFICIAL: 'employer_payroll_official',
  EMPLOYER_REMITTANCE_GENERATION: 'employer_remittance_generation',
  EMPLOYER_EXECUTION_REPLAY: 'employer_execution_replay',
  EMPLOYER_EXECUTION_COMPLIANCE: 'employer_execution_compliance',
} as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULES)[keyof typeof PLATFORM_MODULES];

// ============================================================================
// Entitlement Check Result
// ============================================================================

export interface EntitlementCheckResult {
  allowed: boolean;
  featureKey: string;
  reason: string;
  entitlementId?: string;
  currentUsage?: number;
  usageLimit?: number;
  contractId?: string;
  expiresAt?: Date;
}

// ============================================================================
// Core Entitlement Check
// ============================================================================

/**
 * Check whether an org has an active entitlement for a feature key.
 * Also verifies the backing contract is active and not expired.
 */
export async function checkModuleEntitlement(
  organizationId: string,
  featureKey: string,
): Promise<EntitlementCheckResult> {
  // 1. Look up active entitlement
  const [entitlement] = await db
    .select()
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.organizationId, organizationId),
        eq(orgEntitlements.featureKey, featureKey),
        eq(orgEntitlements.status, 'active'),
      ),
    )
    .limit(1);

  if (!entitlement) {
    return {
      allowed: false,
      featureKey,
      reason: `No active entitlement for module '${featureKey}'`,
    };
  }

  // 2. Check expiration
  if (entitlement.expiresAt && entitlement.expiresAt < new Date()) {
    return {
      allowed: false,
      featureKey,
      reason: `Entitlement for '${featureKey}' expired at ${entitlement.expiresAt.toISOString()}`,
      entitlementId: entitlement.id,
      expiresAt: entitlement.expiresAt,
    };
  }

  // 3. Check usage limit
  if (
    entitlement.usageLimit !== null &&
    entitlement.usageLimit !== undefined &&
    entitlement.currentUsage !== null &&
    entitlement.currentUsage !== undefined &&
    entitlement.currentUsage >= entitlement.usageLimit
  ) {
    return {
      allowed: false,
      featureKey,
      reason: `Usage limit reached for '${featureKey}' (${entitlement.currentUsage}/${entitlement.usageLimit})`,
      entitlementId: entitlement.id,
      currentUsage: entitlement.currentUsage,
      usageLimit: entitlement.usageLimit,
    };
  }

  // 4. Verify backing contract is active (if linked)
  if (entitlement.contractLineItemId) {
    const contractCheck = await verifyBackingContract(entitlement.contractLineItemId);
    if (!contractCheck.valid) {
      return {
        allowed: false,
        featureKey,
        reason: contractCheck.reason,
        entitlementId: entitlement.id,
      };
    }
  }

  return {
    allowed: true,
    featureKey,
    reason: 'Entitlement active',
    entitlementId: entitlement.id,
    currentUsage: entitlement.currentUsage ?? undefined,
    usageLimit: entitlement.usageLimit ?? undefined,
    expiresAt: entitlement.expiresAt ?? undefined,
  };
}

/**
 * Check if an org is covered by a specific contract (for pilot scoping).
 */
export async function checkCoveredOrg(
  organizationId: string,
  contractId: string,
): Promise<boolean> {
  const [covered] = await db
    .select()
    .from(contractCoveredOrgs)
    .where(
      and(
        eq(contractCoveredOrgs.contractId, contractId),
        eq(contractCoveredOrgs.organizationId, organizationId),
      ),
    )
    .limit(1);

  return !!covered && !covered.deactivatedAt;
}

/**
 * Get all active entitlements for an org.
 */
export async function listOrgEntitlements(
  organizationId: string,
): Promise<EntitlementCheckResult[]> {
  const entitlements = await db
    .select()
    .from(orgEntitlements)
    .where(
      and(
        eq(orgEntitlements.organizationId, organizationId),
        eq(orgEntitlements.status, 'active'),
      ),
    );

  return entitlements.map((e) => ({
    allowed: !(e.expiresAt && e.expiresAt < new Date()),
    featureKey: e.featureKey,
    reason: e.expiresAt && e.expiresAt < new Date() ? 'Expired' : 'Active',
    entitlementId: e.id,
    currentUsage: e.currentUsage ?? undefined,
    usageLimit: e.usageLimit ?? undefined,
    expiresAt: e.expiresAt ?? undefined,
  }));
}

// ============================================================================
// Guards (throwing)
// ============================================================================

/**
 * Require an active entitlement. Throws if not entitled.
 * Use in server actions / API handlers.
 */
export async function requireEntitlement(
  organizationId: string,
  featureKey: string,
  userId?: string,
): Promise<EntitlementCheckResult> {
  const result = await checkModuleEntitlement(organizationId, featureKey);

  if (!result.allowed) {
    await auditLog({
      eventType: AuditEventType.SYSTEM_SECURITY_ALERT,
      severity: AuditSeverity.HIGH,
      organizationId,
      userId,
      resource: 'entitlement',
      resourceId: result.entitlementId,
      action: 'entitlement_check_failed',
      outcome: 'denied',
      metadata: {
        featureKey,
        reason: result.reason,
      },
    });

    throw new EntitlementError(featureKey, result.reason);
  }

  return result;
}

/**
 * API route wrapper that enforces module entitlement before
 * delegating to the handler. Compatible with Next.js App Router.
 */
export function withEntitlement(
  featureKey: string,
  handler: (request: Request, context: Record<string, unknown>) => Promise<Response>,
) {
  return async (request: Request, context: Record<string, unknown>) => {
    // Extract organizationId from headers or context
    const orgId =
      (context as { organizationId?: string }).organizationId ??
      request.headers.get('x-organization-id');

    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization context required for module access' },
        { status: 400 },
      );
    }

    const result = await checkModuleEntitlement(orgId, featureKey);

    if (!result.allowed) {
      const userId = request.headers.get('x-user-id') ?? undefined;
      await auditLog({
        eventType: AuditEventType.SYSTEM_SECURITY_ALERT,
        severity: AuditSeverity.HIGH,
        organizationId: orgId,
        userId,
        resource: 'entitlement',
        action: 'module_access_denied',
        outcome: 'denied',
        metadata: { featureKey, reason: result.reason },
      });

      return NextResponse.json(
        {
          error: 'Module access denied',
          code: 'ENTITLEMENT_REQUIRED',
          module: featureKey,
          reason: result.reason,
        },
        { status: 403 },
      );
    }

    return handler(request, context);
  };
}

// ============================================================================
// Helpers
// ============================================================================

async function verifyBackingContract(contractLineItemId: string): Promise<{
  valid: boolean;
  reason: string;
}> {
  // Query contract through line item → commercial_contracts
  const result = await db.execute(
    sql`
    SELECT cc.status, cc.expiration_date
    FROM commercial_contracts cc
    JOIN contract_line_items cli ON cli.contract_id = cc.id
    WHERE cli.id = ${contractLineItemId}
    LIMIT 1
  `,
  );

  const rows = Array.from(result);
  if (rows.length === 0) {
    return { valid: false, reason: 'Backing contract not found' };
  }

  const contract = rows[0] as { status: string; expiration_date: string };
  if (contract.status !== 'active') {
    return { valid: false, reason: `Backing contract is ${contract.status}` };
  }

  if (contract.expiration_date && new Date(contract.expiration_date) < new Date()) {
    return { valid: false, reason: 'Backing contract has expired' };
  }

  return { valid: true, reason: 'Contract active' };
}

// ============================================================================
// Error Class
// ============================================================================

export class EntitlementError extends Error {
  public readonly code = 'ENTITLEMENT_REQUIRED';
  public readonly featureKey: string;

  constructor(featureKey: string, reason: string) {
    super(`Entitlement required: ${featureKey} — ${reason}`);
    this.name = 'EntitlementError';
    this.featureKey = featureKey;
  }
}
