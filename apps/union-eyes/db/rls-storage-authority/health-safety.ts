/**
 * db/rls-storage-authority/health-safety.ts
 *
 * PR #752 round 9: extracted from the single-file
 * db/rls-storage-authority-manifest.ts (which exceeded the repository's
 * 8000-line hard cap at 8009 lines — see
 * tooling/contract-tests/file-size-enforcement.test.ts) into semantic
 * domain modules. This module owns: Health & Safety (incidents, hazards, inspections, audits).
 *
 * Domain boundaries were assigned mechanically by table-name keyword
 * matching against the entry's `table` field (see the one-time migration
 * script referenced in the round-9 commit message) — every entry's DATA
 * (classification, reason, privileges, authority) is unchanged from the
 * pre-split manifest; only its physical file location changed. Do not
 * hand-edit an entry's domain placement without also checking
 * db/__tests__/rls-storage-authority-registry-composition.test.ts, which
 * proves the composed registry is unaffected by which module an entry
 * lives in.
 *
 * Add NEW entries to whichever domain module most closely matches the
 * table's real subject matter; when genuinely ambiguous, prefer
 * reference-latent.ts (the catch-all) over forcing a bad fit elsewhere.
 */
import type { StorageAuthorityEntry } from './types';

export const healthSafetyEntries: StorageAuthorityEntry[] = [
  {
    table: "accessibility_audits",
    classification: "LATENT_UNREACHABLE",
    reason: "Manually verified 2026-09-02: direct NOT NULL organization_id column (db/schema/domains/infrastructure/accessibility.ts), but its sole non-test reference lib/accessibility/accessibility-service.ts has zero callers anywhere under app/, actions/, lib/, services/, scripts/ (verified by name-search).",
    supportingCapability: ["lib/accessibility/accessibility-service.ts"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "deadline_audit_events",
    classification: "NEEDS_REVIEW",
    reason: "RECLASSIFIED 2026-09-02 (round 7, raw-SQL LATENT-detection correction): this table was previously classified LATENT_UNREACHABLE based on a Drizzle-EXPORT-NAME-only reachability scan, which cannot find raw SQL references. A raw-SQL detection pass (see db/__tests__/rls-storage-authority-manifest-raw-sql-latent.test.ts for the detector/fixture) found real, direct raw-SQL table references (db.execute(sql`... FROM/INTO/UPDATE deadline_audit_events ...`) or an equivalent quoted-table-name repository reference) in the file(s) listed below. Full HTTP-reachability/auth-boundary trace not yet completed.",
    supportingCapability: ["lib/deadline-engine/audit.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "financial_audit_log",
    classification: "LATENT_UNREACHABLE",
    reason: "Manually verified 2026-09-02: sole non-test reference lib/services/audit-trail-service.ts has zero callers anywhere under app/, actions/, lib/, services/, scripts/ (verified by name-search).",
    supportingCapability: ["lib/services/audit-trail-service.ts"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "ai_safety_filters",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'aiSafetyFilters' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["lib/ai/chatbot-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "certification_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'certificationAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/certification-management-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "conflict_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'conflictAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/founder-conflict-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "correspondence_audit_trail",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'correspondenceAuditTrail' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["lib/services/correspondence-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "currency_enforcement_audit",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'currencyEnforcementAudit' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/transfer-pricing-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "firewall_compliance_audit",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'firewallComplianceAudit' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/employer-non-interference-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "fmv_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'fmvAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/joint-trust-fmv-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "fx_rate_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'fxRateAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/transfer-pricing-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "location_tracking_audit",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'locationTrackingAudit' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/geofence-privacy-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "signature_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "3 non-test reference(s) to 'signatureAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["lib/services/signature-workflow-service.ts","services/financial-service/drizzle/schema.ts","services/financial-service/src/db/schema.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "signature_audit_trail",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'signatureAuditTrail' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["lib/signature/signature-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "strike_fund_payment_audit",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'strikeFundPaymentAudit' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/whiplash-prevention-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "voting_audit_log",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'votingAuditLog' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["lib/services/voting-crypto-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
  {
    table: "whiplash_prevention_audit",
    classification: "NEEDS_REVIEW",
    reason: "1 non-test reference(s) to 'whiplashPreventionAudit' found (round-7 scope-expansion scan). No obvious HTTP-route/action/cron/webhook reference found in this scan; likely internal-library-only, but exact reachability not yet traced.",
    supportingCapability: ["services/whiplash-prevention-service.ts"],
    requiredRuntimePrivileges: "TBD",
    requiredSystemPrivileges: "TBD",
    invocationAuthority: "TBD",
    dbExecutionPrincipal: "TBD",
    reviewPriority: "NORMAL",
  },
]
