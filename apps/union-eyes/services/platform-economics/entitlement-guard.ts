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
  UNION_KNOWLEDGE_SUITE: 'union_knowledge_suite',
} as const;

export type PlatformModuleKey = (typeof PLATFORM_MODULES)[keyof typeof PLATFORM_MODULES];

// ============================================================================
// Module Display Layer (Workstream B5)
// ============================================================================
//
// Identifiers above (e.g. 'governance_suite', 'ai_advanced_insights') remain
// the canonical wire format used by entitlements, contracts, audit logs, and
// API responses. They MUST stay stable.
//
// The display layer below is the institutional naming surface — what staff,
// executives, and members read in dashboards, settings panes, and contract
// summaries. Each module gets:
//   - displayName: short institutional title
//   - narrativeTagline: one-line statement of what the module delivers, in
//     procedural, member-outcomes-oriented language (no founder-optics, no
//     marketing flourish).
//

export interface ModuleDisplay {
  displayName: string;
  narrativeTagline: string;
  /**
   * Institutional framing — what role this capability plays in the
   * institution's governance/continuity posture. Optional; consumers
   * fall back to `narrativeTagline` when absent.
   */
  institutionalDescription?: string;
  /**
   * Operational framing — what stewards/representatives actually do
   * with this capability day to day. Optional.
   */
  operationalDescription?: string;
  /**
   * AI / decisioning framing — only populated for capabilities that
   * involve reasoning support. Always asserts reviewer-led, governed,
   * non-autonomous posture.
   */
  aiSafetyDescription?: string;
}

export const PLATFORM_MODULE_DISPLAY: Record<PlatformModuleKey, ModuleDisplay> = {
  governance_suite: {
    displayName: 'Governance of Record',
    narrativeTagline:
      'Constitutional, by-law, and resolution records maintained as the institution’s authoritative governance trail.',
    institutionalDescription:
      'Establishes and preserves the institution’s governance trail across leadership transitions, with constitutional, by-law, and resolution records held as the authoritative reference.',
    operationalDescription:
      'Stewards file, version, and retrieve governance instruments under controlled approval, producing a defensible chronology for boards and member assemblies.',
  },
  grievance_case_suite: {
    displayName: 'Representation Case Suite',
    narrativeTagline:
      'End-to-end intake, casework, and resolution tracking for every member representation matter.',
    institutionalDescription:
      'Holds the institutional record for every representation matter — from intake through resolution — preserving continuity across stewards and representatives.',
    operationalDescription:
      'Representatives intake, advance, and close cases with chain-of-custody evidence handling and procedurally sound status transitions.',
  },
  financial_intelligence_suite: {
    displayName: 'Financial Stewardship Intelligence',
    narrativeTagline:
      'Continuous review of dues, allocations, and disbursements to support disciplined financial stewardship.',
    institutionalDescription:
      'Provides treasurers and finance committees with continuity-aware visibility into dues, allocations, and disbursements as a single audit-ready record.',
    operationalDescription:
      'Treasurers reconcile platform billing against internal ledgers and surface variance ahead of audit cadence.',
  },
  ai_advanced_insights: {
    displayName: 'Reviewer-Assisted Intelligence',
    narrativeTagline:
      'Reasoning support that surfaces patterns and prior precedent for human reviewers — never autonomous decisions.',
    institutionalDescription:
      'Supplies governed reasoning support — precedent surfacing, pattern indication, draft preparation — to assist representatives in producing defensible institutional decisions.',
    operationalDescription:
      'Representatives invoke reviewer-assisted prompts within entitlement-controlled budgets; every suggestion is reviewable, override-able, and audit-logged.',
    aiSafetyDescription:
      'Off by default. Activated only through the deployment contract. Never makes autonomous decisions; every output is attributed, reasoned, and subject to representative review and override.',
  },
  allocation_engine: {
    displayName: 'Allocation Engine',
    narrativeTagline:
      'Rule-based distribution of contributions and benefits across members and obligations with full audit lineage.',
    institutionalDescription:
      'Encodes the institution’s allocation rules so that contribution, benefit, and obligation distributions are reproducible and explainable.',
    operationalDescription:
      'Finance stewards configure allocation formulas; every run carries lineage from rule, to inputs, to output line items.',
  },
  transaction_fees: {
    displayName: 'Transaction Fee Ledger',
    narrativeTagline:
      'Transparent recording and reconciliation of platform transaction fees against contracted terms.',
    institutionalDescription:
      'Maintains a transparent ledger of platform transaction fees so that contracted terms can be verified at any point in the institution’s audit cycle.',
    operationalDescription:
      'Treasurers reconcile fee accruals against the deployment contract and flag drift before period close.',
  },
  commercial_reporting: {
    displayName: 'Institutional Reporting',
    narrativeTagline:
      'Periodic and on-demand institutional reports prepared for boards, regulators, and member assemblies.',
    institutionalDescription:
      'Produces the periodic and on-demand reports the institution owes to its boards, regulators, and member assemblies, with every figure traceable to source records.',
    operationalDescription:
      'Officers compose, review, and release reports against locked source data, with revision history retained.',
  },
  export_suite: {
    displayName: 'Records Export',
    narrativeTagline:
      'Authorised export of institutional records in regulator- and counterparty-ready formats with retention metadata.',
    institutionalDescription:
      'Releases institutional records to regulators, counterparties, and successor stewards in formats and with retention metadata appropriate to their use.',
    operationalDescription:
      'Authorised stewards request, review, and release exports — every release is logged with requester, scope, and purpose.',
  },
  health_safety: {
    displayName: 'Health & Safety Register',
    narrativeTagline:
      'Workplace health and safety incident intake, tracking, and follow-through under regulated cadence.',
    institutionalDescription:
      'Maintains the institution’s register of workplace health and safety incidents under regulated cadence so that follow-through can be evidenced.',
    operationalDescription:
      'Stewards intake incidents, monitor remediation commitments, and produce regulator-facing summaries.',
  },
  performance_targets: {
    displayName: 'Performance Commitments',
    narrativeTagline:
      'Service-level commitments and member outcome targets tracked against contracted thresholds.',
    institutionalDescription:
      'Holds the institution’s service-level commitments and member outcome targets as continuity benchmarks across reporting periods.',
    operationalDescription:
      'Officers track commitment attainment against contracted thresholds and explain variance with linked evidence.',
  },
  employer_execution: {
    displayName: 'Employer Execution',
    narrativeTagline:
      'Coordinated execution of employer-side payroll, remittance, and compliance obligations under union oversight.',
    institutionalDescription:
      'Coordinates the employer-side execution lifecycle — payroll, remittance, and compliance — under union oversight and contractual terms.',
    operationalDescription:
      'Designated execution stewards orchestrate the timesheet → payroll → remittance chain with controlled hand-offs.',
  },
  employer_timesheet_ingest: {
    displayName: 'Timesheet Intake',
    narrativeTagline:
      'Structured intake and validation of employer timesheets as the source record for downstream payroll preparation.',
    institutionalDescription:
      'Establishes employer timesheets as the validated source record from which all downstream payroll obligations are derived.',
    operationalDescription:
      'Stewards ingest, validate, and reconcile timesheet submissions against contractual schedules.',
  },
  employer_payroll_preview: {
    displayName: 'Payroll Preview',
    narrativeTagline:
      'Pre-finalisation review of computed payroll figures with reconciliation against contractual rates and deductions.',
    institutionalDescription:
      'Provides an institutional checkpoint before payroll is finalised, so that contractual rates, deductions, and exceptions are reviewable.',
    operationalDescription:
      'Officers review computed figures, raise exceptions, and authorise progression to the official run.',
  },
  employer_payroll_official: {
    displayName: 'Official Payroll Run',
    narrativeTagline:
      'Authorised, immutable payroll run of record, generating the binding employer obligation.',
    institutionalDescription:
      'Records the institution’s authoritative, immutable payroll run that constitutes the binding employer obligation for the period.',
    operationalDescription:
      'Authorised officers commit the official run; downstream remittances and statements derive from this single record.',
  },
  employer_remittance_generation: {
    displayName: 'Remittance Generation',
    narrativeTagline:
      'Generation of dues and statutory remittance instructions tied to the official payroll run.',
    institutionalDescription:
      'Produces dues and statutory remittance instructions that trace directly to the official payroll run of record.',
    operationalDescription:
      'Treasurers issue, dispatch, and reconcile remittances with full lineage to the originating payroll commit.',
  },
  employer_execution_replay: {
    displayName: 'Execution Replay',
    narrativeTagline:
      'Reconstruction of past payroll and remittance runs from source records for review, audit, and dispute resolution.',
    institutionalDescription:
      'Allows the institution to reconstruct past payroll and remittance runs from source records when reviewers, auditors, or disputes require it.',
    operationalDescription:
      'Authorised reviewers replay historical runs without mutating the original record-of-truth.',
  },
  employer_execution_compliance: {
    displayName: 'Execution Compliance',
    narrativeTagline:
      'Continuous compliance verification of employer execution against regulatory and contractual obligations.',
    institutionalDescription:
      'Continuously verifies employer execution against regulatory and contractual obligations so that drift is surfaced before it becomes a finding.',
    operationalDescription:
      'Compliance stewards monitor execution signals and produce attestations for regulators and counterparties.',
  },
  union_knowledge_suite: {
    displayName: 'Institutional Memory',
    narrativeTagline:
      'Curated institutional knowledge — by-laws, precedent, prior resolutions — kept retrievable across generations of stewards.',
    institutionalDescription:
      'Preserves the institution’s memory — by-laws, precedent, prior resolutions, decision rationale — as a continuity asset across generations of stewards.',
    operationalDescription:
      'Stewards curate and retrieve institutional knowledge to support consistent, defensible representation decisions.',
  },
};

/**
 * Resolve a feature-key to its institutional display surface.
 * Falls back to a humanised key + neutral tagline when the module is not
 * yet in the display registry, so new entitlements never break the UI.
 */
export function getModuleDisplay(featureKey: string): ModuleDisplay {
  const known = (PLATFORM_MODULE_DISPLAY as Record<string, ModuleDisplay | undefined>)[featureKey];
  if (known) return known;
  const humanised = featureKey
    .split('_')
    .map((part) => (part.length === 0 ? part : part[0].toUpperCase() + part.slice(1)))
    .join(' ');
  return {
    displayName: humanised,
    narrativeTagline: `Platform module ${humanised} — institutional capability registered for this organisation.`,
  };
}

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
      outcome: 'failure',
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
        outcome: 'failure',
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
