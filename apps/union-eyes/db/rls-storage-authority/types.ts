/**
 * db/rls-storage-authority/types.ts
 *
 * Shared types + constants for THE CANONICAL UNION EYES STORAGE AUTHORITY
 * REGISTRY: the durable, source-controlled, per-table authority
 * disposition (invocation authority, DB execution principal, tenant/system
 * DML privileges, RLS policy shape) intended to eventually cover EVERY
 * table in the public schema relevant to a union_eyes_runtime or
 * union_eyes_system GRANT or an RLS policy — not merely "tenant-shaped
 * tables outside 0108's protected set" (that was this registry's
 * original, narrower scope; see the round-7 scope-expansion note below
 * for why it changed).
 *
 * PR #752 round 9: this file (plus the domain-partitioned entry files
 * under db/rls-storage-authority/) replaces the single-file
 * db/rls-storage-authority-manifest.ts, which had grown to 8009 lines and
 * violated the repository's 8000-line hard cap
 * (tooling/contract-tests/file-size-enforcement.test.ts). The old path is
 * kept as a thin compatibility facade (db/rls-storage-authority-manifest.ts
 * now just re-exports from ./rls-storage-authority) — every existing
 * import of that path keeps working unchanged.
 *
 * WHY THIS REGISTRY EXISTS: 0108 grants union_eyes_runtime/union_eyes_system
 * DML on ALL current public tables (GRANT ... ON ALL TABLES IN SCHEMA
 * public), but only enables RLS on a deliberately-scoped subset (24
 * tables, now themselves first-class entries here — see round 6). This
 * registry is what makes "every table reachable by union_eyes_runtime is
 * protected or explicitly dispositioned" checkable, and
 * scripts/rls-verify.ts FAILS CLOSED (not report-only) against it: see
 * checkOrphanedTenantTables and checkBaselineTablesHaveManifestDisposition.
 *
 * SCOPE EXPANSION (PR #752 round 7): this registry's original scope
 * ("tenant-shaped tables not already covered by 0108") could not honestly
 * support the eventual explicit-GRANT generator this registry is meant to
 * drive — a non-tenant-shaped but operational table (global reference
 * data, a queue/state table, a lookup table) that never qualified for the
 * tenant-column scan would silently lose its runtime grant the moment a
 * blanket `GRANT ... ON ALL TABLES IN SCHEMA public` is replaced with
 * explicit per-table grants derived only from this registry. Round 7's
 * scripts/generate-public-schema-grant-census.ts measures the real gap
 * against scripts/schema-duplicate-table-scan.ts's canonical schema scan
 * (the same scanner used for schema-conflict analysis, not a second
 * independent table list) — see
 * reports/union-eyes-public-schema-grant-census.{json,md} for the current
 * count of public-schema tables still missing an entry here. FINAL TARGET
 * INVARIANT: every canonical public-schema table has exactly ONE entry in
 * this registry (LATENT_UNREACHABLE is a valid, explicit entry — "no
 * entry at all" is not).
 *
 * Classifications:
 *   TENANT_RLS_REQUIRED        — org-scoped, reachable by tenant-facing
 *                                 code; needs the same ue_create_direct_org_rls_policy
 *                                 treatment as the 0108 protected set.
 *   USER_RLS_REQUIRED          — scoped by user rather than org; needs a
 *                                 dedicated user-scoped RLS policy design.
 *   PARENT_OWNED_RLS_REQUIRED  — no direct org column; scopes through a
 *                                 parent table's organization_id (like
 *                                 message_threads' children in 0108).
 *   MIXED_GLOBAL_TENANT_RLS_REQUIRED — a single nullable organization_id
 *                                 column distinguishes shared/global rows
 *                                 (NULL) from tenant-owned override rows
 *                                 (non-NULL); reads need global-OR-own-org
 *                                 visibility and writes must never let a
 *                                 tenant author/mutate a global row or
 *                                 reassign ownership class. Needs its own
 *                                 Postgres RLS policy shape (not yet built
 *                                 as a ue_create_*_rls_policy helper) —
 *                                 see billing/isolation.py's
 *                                 GlobalPlusTenantIsolationMixin for the
 *                                 proven application-layer equivalent
 *                                 (PR #752 round 33).
 *   MULTI_PARTY_RLS_REQUIRED   — two independent FK columns each denote a
 *                                 legitimate owning organization (e.g. a
 *                                 remitter and a receiver); either party
 *                                 may read, writes require a genuinely
 *                                 separate system/platform authority not
 *                                 assumed from ordinary tenant
 *                                 authentication. Needs its own Postgres
 *                                 RLS policy shape (not yet built) — see
 *                                 billing/isolation.py's
 *                                 MultiPartyIsolationMixin for the proven
 *                                 application-layer equivalent (PR #752
 *                                 round 33).
 *   SYSTEM_ONLY                — only ever queried by withSystemContext()/
 *                                 background jobs; should carry a
 *                                 union_eyes_system-only policy (or no
 *                                 tenant policy at all, cross_org_access_log
 *                                 style) and NEVER be reachable by ordinary
 *                                 tenant-scoped request handling.
 *   GLOBAL_REFERENCE_DATA      — not tenant-partitioned data at all despite
 *                                 the column name (e.g. a nullable
 *                                 cross-reference/lookup column), OR a
 *                                 genuinely global/shared table with no
 *                                 tenant-shaped column at all (config,
 *                                 lookup, taxonomy); no RLS needed, but the
 *                                 table's actual semantics must be
 *                                 documented here, not assumed.
 *   APP_SCOPED_NON_SENSITIVE   — tenant-shaped column exists but the data
 *                                 is not sensitive/cross-tenant-exploitable
 *                                 (judgment call — must state why).
 *   SEPARATE_DATABASE_BOUNDARY — table belongs to a different package's
 *                                 database boundary, not this schema's RLS
 *                                 remit (mirrors 0108's own scope note for
 *                                 root-level /migrations/ tables).
 *   LATENT_UNREACHABLE         — no known application code path (route,
 *                                 action, service, lib) queries this table
 *                                 today. Evidence-backed via git grep for
 *                                 the table's Drizzle export name across
 *                                 app/, actions/, lib/, services/ (excludes
 *                                 db/schema/**, __tests__/**, .test./.spec./
 *                                 .stories. files, and migrations) — AND
 *                                 (round 7) a check for RAW SQL references
 *                                 to the physical table name (db.execute(sql`...`),
 *                                 quoted schema/table strings, repository
 *                                 helpers) since a table can have zero
 *                                 Drizzle-symbol callers but a live raw-SQL
 *                                 caller. If raw-SQL usage cannot be ruled
 *                                 out with confidence, use NEEDS_REVIEW
 *                                 (or UNKNOWN_REQUIRES_REVIEW in spirit —
 *                                 this registry reuses NEEDS_REVIEW for
 *                                 that rather than adding a fifth "TBD-like"
 *                                 classification), not LATENT_UNREACHABLE.
 *                                 NOT a permanent disposition — if code
 *                                 starts querying it, this entry must be
 *                                 revisited before that code ships.
 *   CONTAINED_NO_AUTHORITY     — (round 38) the code/route physically
 *                                 exists and IS reachable (unlike
 *                                 LATENT_UNREACHABLE), but it is
 *                                 unconditionally denied all database
 *                                 authority and no legitimate consumer
 *                                 exists. The paradigm case is a
 *                                 router-registered, generated Django
 *                                 ModelViewSet whose permission_classes is
 *                                 an unconditional deny-all (e.g.
 *                                 DenyAllPermission — see ai_budgets,
 *                                 round 35, and the round-36/37 rewards/
 *                                 social_accounts precedents) with zero
 *                                 real consumers anywhere. Distinct from
 *                                 LATENT_UNREACHABLE (no route exists at
 *                                 all) and distinct from ordinary
 *                                 NEEDS_REVIEW (reachable but unresolved) —
 *                                 this is "reachable, but mechanically
 *                                 proven to grant nothing to anyone."
 *                                 STRICT SEMANTICS (permanent invariant,
 *                                 see db/__tests__/rls-storage-authority-
 *                                 manifest-invariants.test.ts):
 *                                 requiredRuntimePrivileges=[],
 *                                 requiredSystemPrivileges=[],
 *                                 invocationAuthority=NONE,
 *                                 dbExecutionPrincipal=NONE,
 *                                 reviewPriority=NONE. Only valid when a
 *                                 mechanical ratchet proves BOTH (a) the
 *                                 reachable surface is unconditionally
 *                                 fail-closed (deny-all permission class,
 *                                 not merely IsAuthenticated) and (b) no
 *                                 legitimate consumer exists (git-grep
 *                                 census across TS+Python finds none).
 *                                 AUTOMATICALLY INVALIDATED (must revert
 *                                 to NEEDS_REVIEW before shipping) if any
 *                                 of: the deny-all permission is removed
 *                                 or weakened; a new production consumer
 *                                 appears; a new direct SQL/ORM operation
 *                                 appears against the table; a new
 *                                 alternate route/ViewSet appears; a
 *                                 system/worker consumer appears.
 *   NEEDS_REVIEW               — real, non-test code references this table
 *                                 (see supportingCapability for the exact
 *                                 files) but the full HTTP-reachability /
 *                                 auth-boundary trace required to assign a
 *                                 final disposition has not been completed.
 *                                 THIS IS A FAILING CLASSIFICATION — see
 *                                 scripts/rls-verify.ts. It exists so this
 *                                 registry can honestly represent a
 *                                 large-scale gap that could not be fully
 *                                 traced in a single review pass, without
 *                                 silently passing the parts that have not
 *                                 actually been verified.
 *
 * reviewPriority: HIGH entries have at least one reference under an
 * app/api/.../route.ts, actions/, cron, or webhook path (a runtime-reachable
 * hint from the scan) — review these NEEDS_REVIEW entries first. NORMAL
 * entries have real non-test code references but no such hint (likely
 * internal-library-only, but not yet confirmed). NONE is used for
 * LATENT_UNREACHABLE entries.
 *
 * DO NOT regenerate the domain entry files with the throwaway scan
 * scripts without diffing first — that would discard the hand-classified
 * entries.
 */

export type StorageAuthorityClassification =
  | 'TENANT_RLS_REQUIRED'
  | 'USER_RLS_REQUIRED'
  | 'PARENT_OWNED_RLS_REQUIRED'
  | 'MIXED_GLOBAL_TENANT_RLS_REQUIRED'
  | 'MULTI_PARTY_RLS_REQUIRED'
  | 'SYSTEM_ONLY'
  | 'GLOBAL_REFERENCE_DATA'
  | 'APP_SCOPED_NON_SENSITIVE'
  | 'SEPARATE_DATABASE_BOUNDARY'
  | 'LATENT_UNREACHABLE'
  | 'CONTAINED_NO_AUTHORITY'
  | 'NEEDS_REVIEW'

export type StorageAuthorityReviewPriority = 'HIGH' | 'NORMAL' | 'NONE'

/**
 * A single PostgreSQL DML operation. Deliberately a set of atomic
 * operations, not a coarse enum (SELECT_INSERT/FULL_DML etc.) — a coarse
 * enum forces over-granting (e.g. FULL_DML for a table that only ever
 * needs SELECT+UPDATE) and cannot be mechanically turned into an explicit
 * `GRANT ... ON TABLE` statement.
 */
export type RuntimeOperation = 'SELECT' | 'INSERT' | 'UPDATE' | 'DELETE'

/**
 * "Who authorized/invoked this operation" — a request-facing/human-facing
 * question. This is INTENTIONALLY a different axis from
 * `DbExecutionPrincipal` ("which Postgres role actually executes the
 * operation"). Collapsing the two into one field (as an earlier revision
 * of this registry did with `executionAuthority`) hid real cases like
 * organization_billing_config, where a PLATFORM_ADMIN invokes an operation
 * that must still execute entirely as SYSTEM_RUNTIME — a single enum
 * cannot express "PLATFORM_ADMIN authorizes -> SYSTEM_RUNTIME executes"
 * without conflating the two questions.
 *
 *   TENANT_USER     — an authenticated org member/steward/etc., acting
 *                      within their own organization.
 *   PLATFORM_ADMIN  — an authenticated platform-level staff/admin role
 *                      (platform_lead, clc_staff, etc.).
 *   SYSTEM_SCHEDULE — a cron/background job, no human request in the loop.
 *   WEBHOOK         — an external system callback (e.g. Stripe), gated by
 *                      signature verification rather than a user session.
 *   WORKER          — an async queue/background worker process.
 *   MIXED           — more than one of the above genuinely invokes
 *                      operations against this table (state the specific
 *                      paths in `reason`).
 *   NONE            — LATENT_UNREACHABLE; nothing invokes it today.
 *   TBD             — not yet determined.
 */
export type InvocationAuthority =
  | 'TENANT_USER'
  | 'PLATFORM_ADMIN'
  | 'SYSTEM_SCHEDULE'
  | 'WEBHOOK'
  | 'WORKER'
  | 'MIXED'
  | 'NONE'
  | 'TBD'

/**
 * "Which Postgres role actually performs the DB operation" — the axis that
 * directly drives GRANT generation. TENANT_RUNTIME = union_eyes_runtime
 * (RLS-policy-gated, ordinary `db` import outside any withSystemContext).
 * SYSTEM_RUNTIME = union_eyes_system (bypasses tenant RLS by design, only
 * reachable via withSystemContext()/withPlatformAdminRLSContext()). MIXED
 * = genuinely both, on different code paths (state them in `reason`).
 *
 * PERMANENT INVARIANT: a SYSTEM_ONLY-classified table's dbExecutionPrincipal
 * must never be TENANT_RUNTIME, regardless of how privileged the
 * INVOKING caller is — invocationAuthority PLATFORM_ADMIN never justifies
 * dbExecutionPrincipal TENANT_RUNTIME for a SYSTEM_ONLY table. See
 * db/__tests__/rls-storage-authority-manifest-invariants.test.ts.
 */
export type DbExecutionPrincipal = 'TENANT_RUNTIME' | 'SYSTEM_RUNTIME' | 'MIXED' | 'NONE' | 'TBD'

/**
 * PR #752 round 8: classifies a manifest entry whose `table` name does NOT
 * resolve to a canonical DECLARED public-schema table (per the merged
 * scanSchemaDeclarations() + scanAdditionalDeclarationFiles() universe —
 * see scripts/generate-public-schema-grant-census.ts). Required whenever
 * such a mismatch exists, so the eventual explicit-GRANT generator never
 * silently emits `GRANT ... ON TABLE public.<name>` for a table that isn't
 * actually a live public-schema relation under that exact name.
 */
export type ScopeDisposition =
  | 'NON_PUBLIC_SCHEMA'
  | 'SEPARATE_DATABASE_BOUNDARY'
  | 'DECLARATION_STALE_OR_NONCANONICAL'
  | 'OTHER_EXPLICITLY_JUSTIFIED'

export interface StorageAuthorityEntry {
  /** Exact public schema table name. */
  table: string
  classification: StorageAuthorityClassification
  /** Why this classification was assigned — must cite real evidence, not a column-name guess. */
  reason: string
  /** File paths (relative to apps/union-eyes) that reference this table outside schema/tests, if any. */
  supportingCapability: string[]
  /**
   * The DML surface union_eyes_runtime (TENANT_RUNTIME) actually needs for
   * this table, once dispositioned. Empty array for LATENT_UNREACHABLE
   * tables, and for any SYSTEM_ONLY table (see DbExecutionPrincipal's
   * permanent invariant). 'TBD' for NEEDS_REVIEW entries and any entry not
   * yet individually re-reviewed at the per-operation level. This is the
   * input to explicit SQL GRANT generation for union_eyes_runtime.
   */
  requiredRuntimePrivileges: readonly RuntimeOperation[] | 'TBD'
  /**
   * The DML surface union_eyes_system (SYSTEM_RUNTIME) needs for this
   * table, if any operation is executed via withSystemContext(). Empty
   * array if no system-context path touches this table. 'TBD' if not yet
   * determined. Input to explicit SQL GRANT generation for
   * union_eyes_system.
   */
  requiredSystemPrivileges: readonly RuntimeOperation[] | 'TBD'
  /** Who/what invokes the operation — see InvocationAuthority. */
  invocationAuthority: InvocationAuthority
  /** Which Postgres role actually executes the operation — see DbExecutionPrincipal. */
  dbExecutionPrincipal: DbExecutionPrincipal
  /** Which NEEDS_REVIEW entries to triage first — see file header. */
  reviewPriority: StorageAuthorityReviewPriority
  /**
   * Set ONLY when `table` does not resolve to a canonical DECLARED
   * public-schema table — see ScopeDisposition. Absent/undefined means
   * this entry is a normal in-scope public-schema table.
   */
  scopeDisposition?: ScopeDisposition
}

/**
 * Classifications that are considered CLOSED (verifier does not fail on
 * these, provided the table's actual RLS/policy state matches what the
 * classification implies where applicable).
 */
export const CLOSED_CLASSIFICATIONS: readonly StorageAuthorityClassification[] = [
  'TENANT_RLS_REQUIRED',
  'USER_RLS_REQUIRED',
  'PARENT_OWNED_RLS_REQUIRED',
  'MIXED_GLOBAL_TENANT_RLS_REQUIRED',
  'MULTI_PARTY_RLS_REQUIRED',
  'SYSTEM_ONLY',
  'GLOBAL_REFERENCE_DATA',
  'APP_SCOPED_NON_SENSITIVE',
  'SEPARATE_DATABASE_BOUNDARY',
  'LATENT_UNREACHABLE',
  'CONTAINED_NO_AUTHORITY',
]
