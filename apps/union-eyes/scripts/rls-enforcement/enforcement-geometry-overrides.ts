/**
 * scripts/rls-enforcement/enforcement-geometry-overrides.ts
 *
 * Round 58C — CLOSE_ENFORCEMENT_GEOMETRY_AND_COMPLETE_CUTOVER_ARTIFACT.
 *
 * This registry is NOT a second authority manifest. It never makes a
 * privilege decision (privileges always come from
 * db/rls-storage-authority's own requiredRuntimePrivileges/
 * requiredSystemPrivileges) and it never overrides a classification. It
 * exists solely to tell the compiler HOW an already-approved authority
 * disposition is physically expressed in PostgreSQL, for the specific
 * tables where generic AST geometry derivation (derive-table-geometry.ts)
 * cannot — and, per Round 58C's own investigation, structurally SHOULD NOT
 * — infer it automatically (ambiguous multi-column FKs, tenant authority
 * reachable only through a parent, non-generic sharing models, etc.).
 *
 * Every entry cites the exact schema file(s) read during Round 58C's
 * investigation as its source evidence, so a future reviewer can verify the
 * claim without re-deriving it from scratch.
 */

export type EnforcementGeometryOverride =
  | {
      kind: "EXPLICIT_DIRECT_COLUMN_OVERRIDE";
      table: string;
      orgColumn: string;
      provenance: string;
    }
  | {
      kind: "USER_DIRECT_COLUMN_OVERRIDE";
      table: string;
      userColumn: string;
      provenance: string;
    }
  | {
      kind: "TENANT_VIA_PARENT";
      table: string;
      fkColumn: string;
      parentTable: string;
      provenance: string;
    }
  | {
      kind: "PARENT";
      table: string;
      fkColumn: string;
      parentTable: string;
      provenance: string;
    }
  | {
      kind: "PARENT_VIA_USER";
      table: string;
      fkColumn: string;
      parentTable: string;
      parentUserColumn: string;
      provenance: string;
    }
  | {
      kind: "MULTI_PARTY";
      table: string;
      orgColumnA: string;
      orgColumnB: string;
      provenance: string;
    }
  | {
      kind: "SHARED_LIBRARY_ROOT";
      table: string;
      orgColumn: string;
      sharingLevelColumn: string;
      sharedWithColumn: string;
      provenance: string;
    }
  | {
      kind: "SHARED_LIBRARY_CHILD";
      table: string;
      fkColumn: string;
      provenance: string;
    };

const ROUND_REF = "round58c";

export const ENFORCEMENT_GEOMETRY_OVERRIDES: EnforcementGeometryOverride[] = [
  // ---- EXPLICIT_DIRECT_COLUMN_OVERRIDE ------------------------------------
  {
    kind: "EXPLICIT_DIRECT_COLUMN_OVERRIDE",
    table: "geofences",
    orgColumn: "union_local_id",
    provenance:
      `[${ROUND_REF}] db/schema/domains/compliance/geofence.ts (also duplicated verbatim in ` +
      `db/schema/geofence-privacy-schema.ts): geofences has no organization_id/org_id column and ` +
      `union_local_id has no FK constraint at all (no "union_locals" table exists anywhere in the ` +
      `schema). db/rls-storage-authority/reference-latent.ts's own CLOSED round-52 evidence for this ` +
      `table states outright: "unionLocalId is the real tenant boundary (a 'union local' is this ` +
      `domain's organization)" and documents that services/geofence-privacy-service.ts's createGeofence ` +
      `now always resolves unionLocalId server-side via getOrganizationIdForUser(caller) — i.e. the ` +
      `column literally stores the caller's own organizationId under a domain-specific name.`,
  },
  {
    kind: "EXPLICIT_DIRECT_COLUMN_OVERRIDE",
    table: "platform_cost_ledger_entries",
    orgColumn: "organization_id",
    provenance:
      `[${ROUND_REF}] db/schema/domains/finance/platform-ledger.ts: table has BOTH organization_id ` +
      `and parent_organization_id (commented "-- Org hierarchy", a nullable rollup/parent-org reference ` +
      `for reporting, not a second equal access party). The manifest classifies this table ` +
      `TENANT_RLS_REQUIRED (not MULTI_PARTY_RLS_REQUIRED), confirming organization_id alone is the ` +
      `intended sole authority column; parent_organization_id is metadata, not a second RLS party.`,
  },

  // ---- USER_DIRECT_COLUMN_OVERRIDE ----------------------------------------
  {
    kind: "USER_DIRECT_COLUMN_OVERRIDE",
    table: "workbooks",
    userColumn: "claimed_by_user_id",
    provenance:
      `[${ROUND_REF}] db/schema/workbook-schema.ts: workbooks has no user_id column at all. It models ` +
      `an anonymous pre-claim / claimed post-claim lifecycle (claimEmail/claimToken before claim, ` +
      `claimedByUserId/claimedOrgId set once an authenticated user claims it). USER_RLS_REQUIRED's real ` +
      `physical ownership column is claimed_by_user_id (nullable — unclaimed workbooks have no owner and ` +
      `are correctly invisible to ordinary tenant-runtime queries; the public claim-token verification ` +
      `flow is assumed — NOT verified this round — to run under a system/service context, carried ` +
      `forward as a Round 59 verification item, see round58c report).`,
  },

  // ---- TENANT_VIA_PARENT (classified TENANT_RLS_REQUIRED, no direct column,
  //      single-hop parent carries the real organization_id) --------------
  {
    kind: "TENANT_VIA_PARENT",
    table: "bargaining_proposals",
    fkColumn: "negotiation_id",
    parentTable: "negotiations",
    provenance:
      `[${ROUND_REF}] db/schema/bargaining-negotiations-schema.ts: bargaining_proposals has no direct ` +
      `org column; negotiation_id is its sole FK, referencing negotiations (HIGH_CONFIDENCE_DIRECT ` +
      `organization_id, confirmed via reports/union-eyes-rls-geometry.json).`,
  },
  {
    kind: "TENANT_VIA_PARENT",
    table: "claim_updates",
    fkColumn: "claim_id",
    parentTable: "claims",
    provenance:
      `[${ROUND_REF}] db/schema/claims-schema.ts: claim_updates has no direct org column; claim_id is ` +
      `its sole FK, referencing claims.claimId (claims is a BASELINE_0108_TABLES entry, already ` +
      `HIGH_CONFIDENCE_DIRECT organization_id).`,
  },
  {
    kind: "TENANT_VIA_PARENT",
    table: "grievance_events",
    fkColumn: "grievance_id",
    parentTable: "grievances",
    provenance:
      `[${ROUND_REF}] db/schema/domains/claims/grievance-lifecycle.ts: grievance_events has no direct ` +
      `org column; grievance_id is its sole FK, referencing grievances (BASELINE_0108_TABLES, ` +
      `HIGH_CONFIDENCE_DIRECT organization_id).`,
  },
  {
    kind: "TENANT_VIA_PARENT",
    table: "grievance_timeline",
    fkColumn: "grievance_id",
    parentTable: "grievances",
    provenance:
      `[${ROUND_REF}] db/schema/domains/claims/grievances.ts: grievance_timeline has no direct org ` +
      `column; grievance_id is its sole FK, referencing grievances (BASELINE_0108_TABLES, ` +
      `HIGH_CONFIDENCE_DIRECT organization_id).`,
  },
  {
    kind: "TENANT_VIA_PARENT",
    table: "reconciliation_matches",
    fkColumn: "run_id",
    parentTable: "reconciliation_runs",
    provenance:
      `[${ROUND_REF}] db/schema/domains/finance/reconciliation.ts: reconciliation_matches has no ` +
      `direct org column; its only real FK is run_id -> reconciliation_runs (HIGH_CONFIDENCE_DIRECT ` +
      `organization_id). sourceId/targetId are polymorphic (sourceType/targetType-keyed) references, ` +
      `not real foreign keys, and are not tenant authority candidates.`,
  },

  // ---- PARENT (classified PARENT_OWNED_RLS_REQUIRED, AMBIGUOUS_PARENT_
  //      CANDIDATES — pick the real administrative/tenant root, not the
  //      attendee/actor/subject column) ------------------------------------
  {
    kind: "PARENT",
    table: "newsletter_list_subscribers",
    fkColumn: "list_id",
    parentTable: "newsletter_distribution_lists",
    provenance:
      `[${ROUND_REF}] db/schema/domains/communications/newsletters.ts: candidates were list_id and ` +
      `profile_id. newsletter_distribution_lists is HIGH_CONFIDENCE_DIRECT organization_id (the ` +
      `administrative list); profile_id identifies the subscriber (subject), not the tenant root.`,
  },
  {
    kind: "PARENT",
    table: "newsletter_recipients",
    fkColumn: "campaign_id",
    parentTable: "newsletter_campaigns",
    provenance:
      `[${ROUND_REF}] db/schema/domains/communications/newsletters.ts: candidates were campaign_id and ` +
      `profile_id. newsletter_campaigns is HIGH_CONFIDENCE_DIRECT organization_id (the administrative ` +
      `campaign); profile_id identifies the recipient (subject), not the tenant root.`,
  },
  {
    kind: "PARENT",
    table: "employer_payroll_run_items",
    fkColumn: "payroll_run_id",
    parentTable: "employer_payroll_runs",
    provenance:
      `[${ROUND_REF}] db/schema/domains/employer-execution/employer-payroll-runs.ts: candidates were ` +
      `payroll_run_id, member_employment_id, timesheet_entry_id. The manifest's own reason (finance.ts) ` +
      `states the app authorizes "both gated on the parent run's org" (app/api/employer-execution/` +
      `payroll-runs/[id]/route.ts) — payroll_run_id -> employer_payroll_runs (HIGH_CONFIDENCE_DIRECT ` +
      `organization_id) is the real, app-verified root; member_employment_id/timesheet_entry_id are ` +
      `secondary line-item references, not the authorization root.`,
  },
  {
    kind: "PARENT",
    table: "payment_allocations",
    fkColumn: "payment_id",
    parentTable: "platform_payments",
    provenance:
      `[${ROUND_REF}] db/schema/domains/finance/platform-billing.ts: candidates were payment_id and ` +
      `invoice_id, both ON DELETE RESTRICT (both platform_payments and platform_invoices are ` +
      `HIGH_CONFIDENCE_DIRECT organization_id). payment_id is the canonical transaction parent for an ` +
      `allocation row. Cross-parent tenant-consistency (payment.org == invoice.org) is a separate, ` +
      `pre-existing application/constraint concern not touched this round.`,
  },
  {
    kind: "PARENT",
    table: "committee_meeting_attendees",
    fkColumn: "meeting_id",
    parentTable: "committee_meetings",
    provenance:
      `[${ROUND_REF}] db/schema/committee-workspace-schema.ts: candidates were meeting_id and ` +
      `member_id. committee_meetings is HIGH_CONFIDENCE_DIRECT organization_id (the administrative ` +
      `root); member_id references profiles.userId — the attendee subject, not the tenant root.`,
  },
  {
    kind: "PARENT",
    table: "ai_safety_filters",
    fkColumn: "session_id",
    parentTable: "chat_sessions",
    provenance:
      `[${ROUND_REF}] db/schema/domains/ml/chatbot.ts: candidates were session_id and message_id ` +
      `(both nullable FKs). chat_sessions is HIGH_CONFIDENCE_DIRECT organization_id + ` +
      `HIGH_CONFIDENCE_USER user_id; it is the more proximate real container (messages themselves ` +
      `belong to a session).`,
  },
  {
    kind: "PARENT",
    table: "correspondence_audit_trail",
    fkColumn: "correspondence_id",
    parentTable: "correspondence",
    provenance:
      `[${ROUND_REF}] db/schema/domains/documents/correspondence.ts: candidates were ` +
      `correspondence_id and actor_user_id. correspondence is already CLOSED TENANT_RLS_REQUIRED; ` +
      `actor_user_id ("Who performed the action") is append-only audit metadata, not the tenant root.`,
  },
  {
    kind: "TENANT_VIA_PARENT",
    table: "signature_audit_trail",
    fkColumn: "document_id",
    parentTable: "signature_documents",
    provenance:
      `[${ROUND_REF}] db/schema/domains/documents/signatures.ts: signature_audit_trail has no direct ` +
      `org column; candidates were document_id and signer_id. signature_documents is ` +
      `HIGH_CONFIDENCE_DIRECT organization_id; signer_id (nullable, references documentSigners) is a ` +
      `secondary participant reference, not the tenant root.`,
  },
  {
    kind: "PARENT",
    table: "voter_eligibility",
    fkColumn: "session_id",
    parentTable: "voting_sessions",
    provenance:
      `[${ROUND_REF}] db/schema/domains/governance/voting.ts: candidates were session_id and ` +
      `member_id. voting_sessions is HIGH_CONFIDENCE_DIRECT organization_id; member_id (references ` +
      `organization_members) is the subject being assessed for eligibility, not the tenant root.`,
  },
  {
    kind: "PARENT",
    table: "votes",
    fkColumn: "session_id",
    parentTable: "voting_sessions",
    provenance:
      `[${ROUND_REF}] db/schema/domains/governance/voting.ts: candidates were session_id and ` +
      `option_id. voting_sessions is HIGH_CONFIDENCE_DIRECT organization_id; option_id references ` +
      `votingOptions and is a ballot-consistency reference only (the DB already enforces one-vote-per` +
      `-voter-per-session via a uniqueIndex on (session_id, voter_id)), not the tenant root. Ballot ` +
      `secrecy is preserved: no policy references voter_id/voter identity.`,
  },

  // ---- PARENT_VIA_USER (workbook children — parent authority is a USER
  //      column, not an org column) ----------------------------------------
  {
    kind: "PARENT_VIA_USER",
    table: "workbook_modules",
    fkColumn: "workbook_id",
    parentTable: "workbooks",
    parentUserColumn: "claimed_by_user_id",
    provenance: `[${ROUND_REF}] db/schema/workbook-schema.ts: sole FK is workbook_id -> workbooks.`,
  },
  {
    kind: "PARENT_VIA_USER",
    table: "workbook_memory_holders",
    fkColumn: "workbook_id",
    parentTable: "workbooks",
    parentUserColumn: "claimed_by_user_id",
    provenance: `[${ROUND_REF}] db/schema/workbook-schema.ts: sole FK is workbook_id -> workbooks.`,
  },
  {
    kind: "PARENT_VIA_USER",
    table: "workbook_purchases",
    fkColumn: "workbook_id",
    parentTable: "workbooks",
    parentUserColumn: "claimed_by_user_id",
    provenance: `[${ROUND_REF}] db/schema/workbook-schema.ts: sole FK is workbook_id -> workbooks.`,
  },
  {
    kind: "PARENT_VIA_USER",
    table: "workbook_governance_lineage_entries",
    fkColumn: "workbook_id",
    parentTable: "workbooks",
    parentUserColumn: "claimed_by_user_id",
    provenance:
      `[${ROUND_REF}] db/schema/workbook-schema.ts: candidates were workbook_id and ` +
      `originating_holder_id. workbook_id -> workbooks is the real tenant/user root (see workbooks' ` +
      `own USER_DIRECT_COLUMN_OVERRIDE above); originating_holder_id (nullable, references a sibling ` +
      `child table workbook_memory_holders, ON DELETE SET NULL) is provenance metadata, not the root.`,
  },

  // ---- MULTI_PARTY (real two-party columns, not a generic 2-org guess) ---
  {
    kind: "MULTI_PARTY",
    table: "per_capita_remittances",
    orgColumnA: "from_organization_id",
    orgColumnB: "to_organization_id",
    provenance:
      `[${ROUND_REF}] db/schema/clc-per-capita-schema.ts: organization_id is explicitly commented ` +
      `"Submitting organization (alias for fromOrganizationId for compatibility)" — the real two ` +
      `parties, both FK-constrained to organizations via a table-level foreignKey() builder (a 3rd ` +
      `Drizzle FK-declaration style derive-table-geometry.ts's AST walk does not yet parse — a real, ` +
      `narrow parser-coverage gap, worked around here via override rather than a broader parser change ` +
      `since only this one table is affected), are from_organization_id and to_organization_id.`,
  },

  // ---- SHARED_CLAUSE_LIBRARY sharing model (not a generic 2-org multi-party) ----
  {
    kind: "SHARED_LIBRARY_ROOT",
    table: "shared_clause_library",
    orgColumn: "source_organization_id",
    sharingLevelColumn: "sharing_level",
    sharedWithColumn: "shared_with_org_ids",
    provenance:
      `[${ROUND_REF}] db/schema/domains/agreements/shared-library.ts: real shape is ` +
      `source_organization_id (owner org, NOT NULL FK) + sharing_level (varchar: private/federation/` +
      `congress/public, default 'private') + shared_with_org_ids (uuid array) — not a simple two-column ` +
      `multi-party table. No federation/congress-membership table exists anywhere in the schema found ` +
      `this round, so those two sharing levels are conservatively treated as NOT expanding visibility ` +
      `beyond owner + explicit shared_with_org_ids + public (safe, under-permissive default; carried ` +
      `forward to Round 59 if a federation/congress hierarchy table is later identified).`,
  },
  {
    kind: "SHARED_LIBRARY_CHILD",
    table: "clause_library_tags",
    fkColumn: "clause_id",
    provenance:
      `[${ROUND_REF}] db/schema/domains/agreements/shared-library.ts: clause_library_tags.clause_id ` +
      `-> shared_clause_library.id is its sole FK. Tag visibility/mutation must mirror the parent ` +
      `clause's OWN sharing predicate (owner/shared-with/public), not a simple parent-org-column match ` +
      `— the generic PARENT helper does not apply since the parent itself has no single org column.`,
  },
];
