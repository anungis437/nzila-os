/**
 * CLC Labour Intelligence — Governance & Consent Model
 *
 * Consent-aware cross-union analytics governance for the Canadian Labour Congress.
 * Extends the base data-governance policy (NZ-RISK-017) with opt-in participation,
 * minimum-cohort thresholds, and governed aggregation execution.
 *
 * @module lib/clc/governance
 */

import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';
import { getUserContext } from '@/lib/api-auth-guard';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

// ── Types ───────────────────────────────────────────────────────────────────

/**
 * Lightweight actor context for governance operations.
 * Built from `withApi`'s ApiContext via `resolveGovernanceContext()`.
 */
export interface GovernanceActorContext {
  userId: string;
  organizationId: string | null;
  /** Check whether the actor has a specific permission */
  hasPermission: (permission: string) => boolean;
}

/**
 * Participation dimensions an affiliate can opt into.
 * Each dimension is independently toggleable.
 */
export interface AffiliateDataParticipation {
  organizationId: string;
  organizationName: string;

  /** Opt-in to cross-union analytics (clauses, precedents, activity) */
  participatesInCrossUnionAnalytics: boolean;
  /** Opt-in to sector-level benchmarks */
  participatesInSectorBenchmarks: boolean;
  /** Opt-in to national signal aggregation (trends, emerging issues) */
  participatesInNationalSignals: boolean;

  /** When consent was granted */
  effectiveDate: string; // ISO-8601
  /** When consent was revoked (null = still active) */
  revokedAt: string | null;
  /** Free-text restrictions placed on data sharing */
  restrictions: string | null;
  /** Who/what granted this consent */
  consentSource: 'affiliate_admin' | 'federation_admin' | 'clc_agreement' | 'system_migration';
}

/**
 * Options for a governed cross-union aggregation operation.
 */
export interface GovernedAggregationOptions {
  /** The actor's governance context (permission checks + audit) */
  context: GovernanceActorContext;
  /** Required permission to run this aggregation */
  requiredPermission: string;
  /** Human label for audit log (e.g. "clause-stats", "sector-signals") */
  operationLabel: string;
  /** Participation dimension filter — only include orgs that consented to this */
  participationDimension: 'crossUnionAnalytics' | 'sectorBenchmarks' | 'nationalSignals';
  /** Minimum number of consented orgs to proceed (defaults to MIN_COHORT_THRESHOLD) */
  minCohort?: number;
}

/**
 * Result of a governed aggregation pre-check.
 */
export interface GovernanceCheckResult {
  allowed: boolean;
  reason: string;
  /** Org IDs that have consented to the requested dimension */
  consentedOrgIds: string[];
  /** Total number of participating orgs */
  cohortSize: number;
}

// ── Constants ───────────────────────────────────────────────────────────────

/**
 * Minimum number of consenting organizations required before cross-union
 * aggregation can proceed. Prevents de-anonymization for small cohorts.
 */
export const MIN_COHORT_THRESHOLD = 5;

// ── In-memory consent registry ──────────────────────────────────────────────
// In production this lives in the DB table `affiliate_data_participation`.
// The initial implementation reads from an in-memory registry that is populated
// by DB queries in the loader function below.

let _participationRegistry: AffiliateDataParticipation[] = [];

/**
 * Load participation records (called from data products or API routes).
 * In production this queries the DB. Accepts a loader to decouple from schema.
 */
export function setParticipationRegistry(records: AffiliateDataParticipation[]): void {
  _participationRegistry = records;
}

export function getParticipationRegistry(): ReadonlyArray<AffiliateDataParticipation> {
  return _participationRegistry;
}

/**
 * Load participation records from the `affiliate_data_participation` DB table.
 * Falls back to the in-memory registry if the table does not exist yet.
 */
export async function loadParticipationFromDB(): Promise<ReadonlyArray<AffiliateDataParticipation>> {
  try {
    const rows = await withSystemContext(() =>
      db.execute(sql`
        SELECT
          organization_id,
          organization_name,
          participates_in_cross_union_analytics,
          participates_in_sector_benchmarks,
          participates_in_national_signals,
          effective_date,
          revoked_at,
          restrictions,
          consent_source
        FROM affiliate_data_participation
        ORDER BY effective_date DESC
      `),
    );

    const records: AffiliateDataParticipation[] = (rows as Record<string, unknown>[]).map((r) => ({
      organizationId: String(r.organization_id),
      organizationName: String(r.organization_name),
      participatesInCrossUnionAnalytics: Boolean(r.participates_in_cross_union_analytics),
      participatesInSectorBenchmarks: Boolean(r.participates_in_sector_benchmarks),
      participatesInNationalSignals: Boolean(r.participates_in_national_signals),
      effectiveDate: String(r.effective_date),
      revokedAt: r.revoked_at ? String(r.revoked_at) : null,
      restrictions: r.restrictions ? String(r.restrictions) : null,
      consentSource: String(r.consent_source) as AffiliateDataParticipation['consentSource'],
    }));

    // Update in-memory registry with DB results
    _participationRegistry = records;
    return records;
  } catch {
    // Table may not exist yet — fall back to in-memory registry
    return _participationRegistry;
  }
}

// ── Core governance logic ───────────────────────────────────────────────────

/**
 * Get org IDs that have opted-in for a specific participation dimension and
 * have not revoked their consent.
 */
export function getConsentedOrgIds(
  dimension: GovernedAggregationOptions['participationDimension'],
  registry: ReadonlyArray<AffiliateDataParticipation> = _participationRegistry,
): string[] {
  return registry
    .filter((p) => {
      if (p.revokedAt !== null) return false;
      switch (dimension) {
        case 'crossUnionAnalytics':
          return p.participatesInCrossUnionAnalytics;
        case 'sectorBenchmarks':
          return p.participatesInSectorBenchmarks;
        case 'nationalSignals':
          return p.participatesInNationalSignals;
        default:
          return false;
      }
    })
    .map((p) => p.organizationId);
}

/**
 * Pre-check whether a governed cross-union aggregation is permitted.
 * Does NOT execute anything — just returns the governance decision.
 */
export function checkGovernedAggregation(
  opts: GovernedAggregationOptions,
  registry: ReadonlyArray<AffiliateDataParticipation> = _participationRegistry,
): GovernanceCheckResult {
  const consentedOrgIds = getConsentedOrgIds(opts.participationDimension, registry);
  const minCohort = opts.minCohort ?? MIN_COHORT_THRESHOLD;

  if (consentedOrgIds.length === 0) {
    return {
      allowed: false,
      reason: 'No affiliates have opted into this data dimension.',
      consentedOrgIds: [],
      cohortSize: 0,
    };
  }

  if (consentedOrgIds.length < minCohort) {
    return {
      allowed: false,
      reason:
        `Cohort too small: ${consentedOrgIds.length} consenting affiliates, ` +
        `but minimum ${minCohort} required to prevent de-anonymization.`,
      consentedOrgIds,
      cohortSize: consentedOrgIds.length,
    };
  }

  return {
    allowed: true,
    reason: `${consentedOrgIds.length} affiliates consented — cohort threshold met.`,
    consentedOrgIds,
    cohortSize: consentedOrgIds.length,
  };
}

// ── Governed execution wrapper ──────────────────────────────────────────────

/**
 * Execute a cross-union aggregation within full governance guardrails:
 *
 * 1. Permission check (requires specific permission on the actor)
 * 2. Consent check (only includes orgs that opted-in)
 * 3. Minimum cohort check (at least N orgs)
 * 4. Audit log (records who ran what, with which consented orgs)
 * 5. System context execution (bypasses RLS since this is multi-org)
 *
 * @returns The result of the aggregation function, or throws on governance violation
 */
export async function runGovernedCrossUnionAggregation<T>(
  opts: GovernedAggregationOptions,
  aggregationFn: (consentedOrgIds: string[]) => Promise<T>,
): Promise<T> {
  // 1. Permission check — throws if the actor lacks the required permission
  if (!opts.context.hasPermission(opts.requiredPermission)) {
    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.MEDIUM,
      userId: opts.context.userId,
      organizationId: opts.context.organizationId ?? undefined,
      resource: 'clc-intelligence',
      action: opts.operationLabel,
      outcome: 'denied',
      details: {
        reason: `Missing permission: ${opts.requiredPermission}`,
        dimension: opts.participationDimension,
      },
    });
    throw new Error(`Permission required: ${opts.requiredPermission}`);
  }

  // 2-3. Consent + cohort check
  const check = checkGovernedAggregation(opts);
  if (!check.allowed) {
    await auditLog({
      eventType: AuditEventType.DATA_ACCESS,
      severity: AuditSeverity.MEDIUM,
      userId: opts.context.userId,
      organizationId: opts.context.organizationId ?? undefined,
      resource: 'clc-intelligence',
      action: opts.operationLabel,
      outcome: 'denied',
      details: {
        reason: check.reason,
        dimension: opts.participationDimension,
        cohortSize: check.cohortSize,
      },
    });
    throw new Error(
      `[CLC-GOV] Cross-union aggregation denied for "${opts.operationLabel}": ${check.reason}`,
    );
  }

  // 4. Audit log — record successful access
  await auditLog({
    eventType: AuditEventType.DATA_ACCESS,
    severity: AuditSeverity.LOW,
    userId: opts.context.userId,
    organizationId: opts.context.organizationId ?? undefined,
    resource: 'clc-intelligence',
    action: opts.operationLabel,
    outcome: 'success',
    details: {
      dimension: opts.participationDimension,
      cohortSize: check.cohortSize,
      consentedOrgCount: check.consentedOrgIds.length,
    },
  });

  // 5. Execute within system context (cross-org needs RLS bypass)
  return withSystemContext(() => aggregationFn(check.consentedOrgIds));
}

// ── Context resolver ────────────────────────────────────────────────────────

/**
 * Build a GovernanceActorContext from withApi's userId/organizationId.
 *
 * Resolves the actor's effective permissions via the same DB lookup path used
 * by `withEnhancedRoleAuth`, ensuring defense-in-depth permission checks
 * inside the governance wrapper even though `withApi` already enforces minRole.
 */
export async function resolveGovernanceContext(
  userId: string,
  organizationId: string | null,
): Promise<GovernanceActorContext> {
  let permissions: string[] = [];
  try {
    const userCtx = await getUserContext();
    if (userCtx) {
      permissions = userCtx.permissions ?? [];
    }
  } catch {
    // Fail-closed: empty permissions = no cross-union access
  }

  return {
    userId,
    organizationId,
    hasPermission: (p: string) => permissions.includes(p) || permissions.includes('*'),
  };
}
