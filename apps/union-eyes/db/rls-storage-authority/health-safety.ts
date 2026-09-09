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
    classification: "TENANT_RLS_REQUIRED",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): direct NOT NULL organization_id column (migrations/0045_union_eyes_deadline_engine.sql), append-only ENFORCED AT THE DB LAYER by a trigger (trg_deadline_audit_events_immutable, per migrations/0045 and confirmed applied in reports/phase0/wave-1-phase-a/migration-0045-apply.log \u2014 rejects UPDATE/DELETE unconditionally, independent of application code). REAL, LIVE REACHABILITY (the manifest's automated scan found only a single doc-string mention in lib/reality/capability-registry.ts and missed the actual call graph): lib/deadline-engine/audit.ts's writeDeadlineAuditEvent() is called from lib/deadline-engine/reminder-scheduler.ts, reminder-worker.ts, assignment-sync.ts, app/api/cron/deadline-overdue/route.ts (cron, auth:{cron:true}), and app/api/cron/deadline-reminders/route.ts (cron) \u2014 MIXED invocation authority: also reachable via app/api/admin/dues/send-reminders/route.ts, a TENANT_USER-invoked admin action. organizationId provenance is always trusted (resolved server-side from the deadline/grievance row, e.g. `resolution.organizationId`), never client-supplied. SYSTEM-PRINCIPAL DEFECT FOUND AND PARTIALLY FIXED: app/api/cron/deadline-overdue/route.ts called writeDeadlineAuditEvent() OUTSIDE its own withSystemContext() SELECT block, meaning the audit INSERT ran on the ambient/default pooled connection rather than union_eyes_system, despite being a genuinely system-initiated write (round-46 'system job -> plain tenant db import' anti-pattern). Fixed for this call site: writeDeadlineAuditEvent() now accepts an optional `tx` parameter (falls back to the ambient `db` import when omitted, non-breaking for the ~12 other call sites), and the cron route now wraps the write in `withSystemContext((tx) => writeDeadlineAuditEvent({...}, tx))` (explicit-tx style, does not add to the no-arg ratchet). NOT YET FIXED (documented, out of this round's bounded scope \u2014 SYSTEM_PRINCIPAL_MISMATCH): app/api/cron/deadline-reminders/route.ts's runDeadlineReminderWorker() (reminder-worker.ts, 6 call sites) and reminder-scheduler.ts's 6 call sites (shared by both the cron path and the tenant-admin dues-reminders path) still run via the ambient db import with no explicit system-context wrapping when invoked from cron \u2014 a full fix requires distinguishing cron-vs-tenant-admin invocation context per call site, which is a larger refactor than this round's bounded-defect scope; not a tenant-crossing vulnerability today since organizationId attribution is always correct and RLS enforcement for this table is not yet deployed (platform-wide policy debt, tracked separately).",
    supportingCapability: ["lib/deadline-engine/audit.ts","lib/deadline-engine/__tests__/audit.test.ts","lib/deadline-engine/reminder-scheduler.ts","lib/deadline-engine/reminder-worker.ts","lib/deadline-engine/assignment-sync.ts","app/api/cron/deadline-overdue/route.ts","app/api/cron/deadline-reminders/route.ts","app/api/admin/dues/send-reminders/route.ts"],
    requiredRuntimePrivileges: ["SELECT","INSERT"],
    requiredSystemPrivileges: ["INSERT"],
    invocationAuthority: "MIXED",
    dbExecutionPrincipal: "MIXED",
    reviewPriority: "NONE",
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
    classification: "PARENT_OWNED_RLS_REQUIRED",
    reason: "CLOSED round 54 (final non-voting parent-owned authority convergence): no organization_id column; nullable sessionId FK -> chatSessions, CLOSED round 45 TENANT_RLS_REQUIRED (organization_id NOT NULL, session ownership verified). RESOLVED_PARENT_READY: the sole reachable write path is lib/ai/chatbot-service.ts's checkContentSafety(), called only from sendMessage() (app/api/chatbot/messages/route.ts, app/api/chatbot/sessions/[sessionId]/messages/route.ts) AFTER sendMessage() has already verified session.userId===caller.userId && session.organizationId===caller.organizationId (round-45 fix) \u2014 so every reachable insert occurs inside an already tenant-verified context. SECURITY/AUDIT DEFECT FOUND AND FIXED this round: checkContentSafety() inserted flagged-content rows WITHOUT the already-available sessionId, leaving every audit row orphaned (no traceable link back to the tenant/session that produced it, undermining the table's purpose as a safety audit trail). Fixed: checkContentSafety(content, sessionId) now stamps sessionId on every flagged insert; lib/ai/__tests__/chatbot-service.test.ts extended with a regression assertion (20/20 passing). No SELECT/UPDATE/DELETE path exists anywhere \u2014 write-only audit log. Django AiSafetyFiltersViewSet (backend/ai_core/views.py) was IsAuthenticated-only with queryset=Model.objects.all() (no org filter, and this table can contain sensitive flagged chat content) \u2014 contained via DenyAllPermission this round; no legitimate consumer found.",
    supportingCapability: ["lib/ai/chatbot-service.ts","app/api/chatbot/messages/route.ts","app/api/chatbot/sessions/[sessionId]/messages/route.ts","backend/ai_core/views.py"],
    requiredRuntimePrivileges: ["INSERT"],
    requiredSystemPrivileges: [],
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    reviewPriority: "NONE",
  },
  {
    table: "certification_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): services/certification-management-service.ts's CertificationManagementService (TS side) has zero callers anywhere in app/, actions/, lib/, services/ — fully dead code; its only apparent caller lib/api/certification-management-service-api.ts is itself an unused generated Django-HTTP-client fetch wrapper (zero callers of its own). DJANGO SIDE IS REAL AND REACHABLE: services/api/certification_management_service_views.py's CertificationManagementServiceViewSet is router-registered at 'certification-management-service' and applies ZERO organization_id filtering on ANY of its 7 models (CertificationTypes/StaffCertifications/ContinuingEducation/LicenseRenewals/CertificationAlerts/CertificationComplianceReports/CertificationAuditLog all use `.objects.all()`), and its CertificationAuditLog.objects.create() calls set ONLY action_type (no actor/subject/organization attribution at all — an already-broken audit trail even before the scoping gap). No legitimate consumer found on either side. CONTAINED: this ViewSet's permission_classes changed to a new local DenyAllPermission; the separate generated compliance/views.py CertificationAuditLogViewSet (also IsAuthenticated-only, unscoped) was contained too.",
    supportingCapability: ["services/certification-management-service.ts","services/api/certification_management_service_views.py","backend/compliance/views.py","backend/compliance/tests_round49_evidence_containment.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "conflict_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): services/founder-conflict-service.ts has zero callers anywhere in app/, actions/, lib/, services/ — fully dead TS code. DJANGO SIDE IS REAL AND REACHABLE: services/api/founder_conflict_service_views.py's FounderConflictServiceViewSet is router-registered at 'founder-conflict-service' and its read-only audit_log action IS correctly org-scoped (`ConflictAuditLog.objects.filter(organization_id=request.user.organization_id)`), but has ZERO frontend consumers anywhere (verified by exhaustive grep for 'founder-conflict-service'/'founder_conflict'). No legitimate consumer found on either side despite the Django surface being well-built. CONTAINED: FounderConflictServiceViewSet's permission_classes changed to a new local DenyAllPermission; the separate generated compliance/views.py ConflictAuditLogViewSet (IsAuthenticated-only, unscoped, no org filter at all) was contained too.",
    supportingCapability: ["services/founder-conflict-service.ts","services/api/founder_conflict_service_views.py","backend/compliance/views.py","backend/compliance/tests_round49_evidence_containment.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "correspondence_audit_trail",
    classification: "PARENT_OWNED_RLS_REQUIRED",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): no direct organization_id column; authority derived through correspondenceId -> correspondence (closed, TENANT_RLS_REQUIRED). Tamper-evident design: a hash-chain column (SHA-256 of the previous hash + event data) makes this a real hash-chained append-only log. Real, live routes app/api/correspondence/[id]/{sign,approve,dispatch,cancel,revision,submit}/route.ts (all withApi(), tenant org-scoped roles) ALL apply the identical cross-parent-consistency guard `if (!existing || existing.organizationId !== organizationId) { ... }` BEFORE calling lib/services/correspondence-service.ts's appendAuditEntry(), and all pass `actorUserId: userId!` sourced from withApi's trusted auth context, never client body-supplied — the caller cannot attach an audit event to another tenant's correspondence, and cannot forge another user's actor identity. No defect found; this is a well-built reference implementation of the round's parent-chain + actor-provenance doctrine. No Django exposure exists for this table.",
    supportingCapability: ["lib/services/correspondence-service.ts","app/api/correspondence/[id]/sign/route.ts","app/api/correspondence/[id]/approve/route.ts","app/api/correspondence/[id]/dispatch/route.ts","app/api/correspondence/[id]/cancel/route.ts","app/api/correspondence/[id]/revision/route.ts","app/api/correspondence/[id]/submit/route.ts"],
    requiredRuntimePrivileges: ["SELECT","INSERT"],
    requiredSystemPrivileges: [],
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    reviewPriority: "NONE",
  },
    {
    table: "currency_enforcement_audit",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 57: same dead TransferPricingService class as bank_of_canada_rates (zero real instantiations). SECURITY DEFECT FOUND AND FIXED THIS ROUND: billing.CurrencyEnforcementAuditViewSet was IsAuthenticated-only with no organization filter — contained via SharedDenyAllPermission. No legitimate consumer exists. Satisfies CONTAINED_NO_AUTHORITY.",
    supportingCapability: ["services/transfer-pricing-service.ts","backend/billing/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "firewall_compliance_audit",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): db/schema/employer-non-interference-schema.ts declares NO organization_id column on this table (platform-wide-by-design or an unaddressed tenant-isolation gap — either way, moot given reachability below). services/employer-non-interference-service.ts's EmployerNonInterferenceService (TS side) has zero callers anywhere. DJANGO SIDE IS REAL AND REACHABLE: services/api/employer_non_interference_service_views.py's EmployerNonInterferenceServiceViewSet is router-registered at 'employer-non-interference-service'; its compliance_audit GET action IS correctly org-scoped, and its check_access/submit_justification/report_violation POST actions correctly derive organization_id from request.user.organization_id (client-supplied organization_id explicitly stripped) — but those same actions accept FULLY CLIENT-CONTROLLED outcome/actor fields (e.g. check_access lets the caller set accessGranted/flaggedForReview/reviewedBy directly, with no server-side firewall-rule evaluation at all) — a self-authored security-evidence defect. Zero frontend consumers found anywhere for this whole ViewSet — no legitimate consumer found on either side. CONTAINED: EmployerNonInterferenceServiceViewSet's permission_classes changed to a new local DenyAllPermission (collaterally also protects its firewall_access_rules/firewall_violations/union_only_data_tags actions, out of this round's direct scope); the separate generated compliance/views.py FirewallComplianceAuditViewSet (IsAuthenticated-only, unscoped) was contained too.",
    supportingCapability: ["services/employer-non-interference-service.ts","services/api/employer_non_interference_service_views.py","backend/compliance/views.py","backend/compliance/tests_round49_evidence_containment.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "fmv_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 51 (GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY, no-org candidate universe): sole TS consumer(s) services/joint-trust-fmv-service.ts have zero production importers anywhere in app/, actions/, lib/, services/ outside their own test files (git-grep confirmed) — dead TS code, no legitimate consumer on the TypeScript side. The generated Django ViewSet(s) in backend/billing/views.py exposed queryset=Model.objects.all() + IsAuthenticated-only with NO organization filter of any kind. Contained this round via SharedDenyAllPermission in backend/billing/views.py. Satisfies CONTAINED_NO_AUTHORITY: reachable-but-denied Django, dead TS, no legitimate consumer.",
    supportingCapability: ["services/joint-trust-fmv-service.ts","backend/billing/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
    {
    table: "fx_rate_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 57: same dead TransferPricingService class as bank_of_canada_rates. SECURITY DEFECT FOUND AND FIXED THIS ROUND: billing.FxRateAuditLogViewSet was IsAuthenticated-only with no organization filter — contained via SharedDenyAllPermission. No legitimate consumer exists. Satisfies CONTAINED_NO_AUTHORITY.",
    supportingCapability: ["services/transfer-pricing-service.ts","backend/billing/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "location_tracking_audit",
    classification: "USER_RLS_REQUIRED",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): db/schema/domains/compliance/geofence.ts declares NO organization_id column — userId-keyed (real-time strike/picket location tracking consent is an individual opt-in under Quebec Law 25, matching round 17's member_location_consent precedent in this same subsystem). APPEND-ONLY: services/geofence-privacy-service.ts's logAuditAction() only ever INSERTs (consent_granted/consent_revoked events); zero SELECT/UPDATE/DELETE against this table exist anywhere in the TS codebase (it currently has no in-app reader at all). ACTOR=SUBJECT (self-service only): both writers (requestLocationConsent/revokeLocationConsent, reached via app/api/location/consent/route.ts's POST/DELETE) already derive userId exclusively from getCurrentUser() per round 17's fix — confirmed unchanged. RELATED DEFECT FOUND AND FIXED (same subsystem, different table): app/api/location/track/route.ts's POST took `userId` directly from the client body (the one route round 17 did not fix), letting any authenticated caller submit fabricated GPS coordinates attributed to another consenting member's identity; fixed to derive userId from getCurrentUser() exclusively, matching the consent route's established pattern; regression tests added (app/api/__tests__/location-track.route.test.ts). DJANGO SIDE IS REAL AND REACHABLE: compliance/views.py's LocationTrackingAuditViewSet (IsAuthenticated-only, filterable by ?user_id= — letting any authenticated user of any organization browse ANY other user's location-tracking consent history) would be the ONLY reader of this table; no legitimate Django consumer found — contained via DenyAllPermission.",
    supportingCapability: ["services/geofence-privacy-service.ts","app/api/location/consent/route.ts","app/api/location/track/route.ts","app/api/__tests__/location-track.route.test.ts","app/api/__tests__/location-consent.route.test.ts","backend/compliance/views.py"],
    requiredRuntimePrivileges: ["INSERT"],
    requiredSystemPrivileges: [],
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    reviewPriority: "NONE",
  },
  {
    table: "signature_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): lib/services/signature-workflow-service.ts's SignatureWorkflowService has zero callers anywhere in app/, actions/, lib/ (lib/services/index.ts explicitly documents 'signature-workflow-service exports default, not named export - import directly from file' rather than re-exporting it — confirmed no direct importer exists either; the manifest's financial-service supportingCapability citations are that service's own independent dual-schema declaration, not a caller of this table). Reuses round 45's established signature-document-authority doctrine without reopening it. DJANGO SIDE IS REAL AND REACHABLE: content/views.py's SignatureAuditLogViewSet is router-registered, unscoped (IsAuthenticated-only). No legitimate consumer found on either side; contained via DenyAllPermission.",
    supportingCapability: ["lib/services/signature-workflow-service.ts","backend/content/views.py","backend/compliance/tests_round49_evidence_containment.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "signature_audit_trail",
    classification: "TENANT_RLS_REQUIRED",
    reason: "CLOSED (round 49, immutable security and audit evidence authority cohort): lib/signature/signature-service.ts's AuditTrailService is genuinely reachable via app/api/signatures/audit/[documentId]/route.ts, app/api/signatures/documents/route.ts, app/api/signatures/documents/[id]/route.ts, and app/api/signatures/sign/route.ts — the manifest's automated scan undercounted this (cited only 1 reference). SEVERE CROSS-TENANT DEFECT FOUND AND FIXED: app/api/signatures/audit/[documentId]/route.ts's GET handler took `documentId` from the URL path with ONLY an authentication check (getCurrentUser()) and no ownership verification at all, letting ANY authenticated user of ANY organization read ANY OTHER organization's signature document's full audit trail (signer identities, IPs, timestamps) by guessing/enumerating a documentId — while the sibling app/api/signatures/documents/[id]/route.ts already had the correct fix ('SECURITY FIX: Verify user has access to this document (prevent IDOR)' via SignatureService.verifyDocumentAccess()) applied in a prior round, this audit route was missed. Fixed by adding the identical verifyDocumentAccess(documentId, user.id) check before returning any audit data; 3 regression tests added (app/api/signatures/audit/[documentId]/__tests__/route.test.ts). DJANGO SIDE: content/views.py's SignatureAuditTrailViewSet (unscoped, IsAuthenticated-only) would provide unrestricted redundant access to the same data — no legitimate Django consumer found; contained via DenyAllPermission.",
    supportingCapability: ["lib/signature/signature-service.ts","app/api/signatures/audit/[documentId]/route.ts","app/api/signatures/audit/[documentId]/__tests__/route.test.ts","app/api/signatures/documents/route.ts","app/api/signatures/documents/[id]/route.ts","app/api/signatures/sign/route.ts","backend/content/views.py"],
    requiredRuntimePrivileges: ["SELECT","INSERT"],
    requiredSystemPrivileges: [],
    invocationAuthority: "TENANT_USER",
    dbExecutionPrincipal: "TENANT_RUNTIME",
    reviewPriority: "NONE",
  },
  {
    table: "strike_fund_payment_audit",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 51 (GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY, no-org candidate universe): sole TS consumer(s) services/whiplash-prevention-service.ts have zero production importers anywhere in app/, actions/, lib/, services/ outside their own test files (git-grep confirmed) — dead TS code, no legitimate consumer on the TypeScript side. The generated Django ViewSet(s) in backend/billing/views.py exposed queryset=Model.objects.all() + IsAuthenticated-only with NO organization filter of any kind. Contained this round via SharedDenyAllPermission in backend/billing/views.py. Satisfies CONTAINED_NO_AUTHORITY: reachable-but-denied Django, dead TS, no legitimate consumer.",
    supportingCapability: ["services/whiplash-prevention-service.ts","backend/billing/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "voting_audit_log",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 44 (RESOLVED_PARENT_ROOT candidate; parent voting_sessions is closed TENANT_RLS_REQUIRED, but the child itself has no real consumer): lib/services/voting-crypto-service.ts's createVotingAuditLog (sole INSERT writer) and verifyElectionIntegrity (sole SELECT reader + UPDATE) have zero real callers anywhere in app/, actions/, lib/, services/, components/ (git-grep-confirmed round 44). DEFECT FOUND AND FIXED THIS ROUND: VotingAuditLogViewSet (backend/unions/views.py) was router-registered with queryset=Model.objects.all() + IsAuthenticated-only and NO organization filter \u2014 contained via DenyAllPermission. Satisfies CONTAINED_NO_AUTHORITY: reachable-but-denied Django, dead TS, no legitimate consumer.",
    supportingCapability: ["lib/services/voting-crypto-service.ts","backend/unions/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
  {
    table: "whiplash_prevention_audit",
    classification: "CONTAINED_NO_AUTHORITY",
    reason: "CLOSED round 44 (same whiplash cluster as round 42's account_balance_reconciliation/payment_routing_rules/separated_payment_transactions): services/whiplash-prevention-service.ts's WhiplashPreventionService class (the sole writer of whiplashPreventionAudit) has ZERO real instantiations anywhere in app/, actions/, lib/, services/ outside its own test file (git-grep-confirmed round 44 for 'WhiplashPreventionService' and 'new WhiplashPrevention') — dead code. No raw-SQL reference to the physical table name exists outside db/schema/**, db/migrations/**, and this manifest. DEFECT FOUND AND FIXED THIS ROUND: WhiplashPreventionAuditViewSet (backend/billing/views.py) was router-registered with queryset=Model.objects.all() + IsAuthenticated-only — contained via SharedDenyAllPermission (the same mixin used for the round-42 whiplash entries). Satisfies CONTAINED_NO_AUTHORITY: reachable-but-denied Django, dead TS, no legitimate consumer.",
    supportingCapability: ["services/whiplash-prevention-service.ts","backend/billing/views.py"],
    requiredRuntimePrivileges: [],
    requiredSystemPrivileges: [],
    invocationAuthority: "NONE",
    dbExecutionPrincipal: "NONE",
    reviewPriority: "NONE",
  },
]
