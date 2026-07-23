/**
 * Foundational paths — Phase 0B.2 §11
 *
 * The **only** call sites where `resolvePlatformTenantId` is wired during
 * Phase 0B.2. Any additional integration is deferred to a later phase and
 * is explicitly out of scope for the foundational slice.
 *
 * This module is imported by:
 *
 *   * `packages/db/src/foundational-runtime/*` — read-side asserts
 *   * `tooling/checks/*` — validators that grep for imports
 *   * Section-14 composition proof — asserts the resolver is imported by
 *     each foundational path.
 */

export const FOUNDATIONAL_PATHS = Object.freeze({
  /**
   * Path 1: Pilot definitions writes.
   *
   * When a caller inserts into `public.pilot_definitions`, the `org_id`
   * column MUST be resolved via `resolvePlatformTenantId`. This path is
   * the earliest platform-side artefact created for a pilot and thus the
   * anchor of the tenant contract at pilot boot time.
   */
  PILOT_DEFINITIONS_WRITE: 'pilot_definitions.write',

  /**
   * Path 2: Pilot metric event writes.
   *
   * Every write to `public.pilot_metric_events` and the derived
   * `public.pilot_metric_rollups` MUST be tenant-tagged with the platform
   * tenant id. Reads MAY use a resolved id but SHOULD NOT re-resolve if
   * a tenant id is already in the request context (avoids double-round-trip).
   */
  PILOT_METRIC_EVENTS_WRITE: 'pilot_metric_events.write',

  /**
   * Path 3: KPI snapshot org ownership.
   *
   * `union_eyes.ue_kpi_snapshots.organization_id` MUST equal
   * `resolvePlatformTenantId(ctx)`. The KPI database migration
   * (Section 12, `packages/db/drizzle/0039_ue_cognition_text_id_promotion.sql`)
   * relies on this to guarantee that legacy uuid rows and new text-id rows
   * share the same tenant identity.
   */
  KPI_SNAPSHOT_ORG_OWNERSHIP: 'ue_kpi_snapshots.org_ownership',

  /**
   * Path 4: RLS session context.
   *
   * Before any tenant-scoped query, callers MUST issue
   *   SET LOCAL app.current_org_id = <resolvePlatformTenantId(ctx)>
   * within the connection's transaction. Row-Level-Security policies on
   * both `public.*` and `union_eyes.*` tables reference the session
   * variable and fail closed if it is unset.
   */
  RLS_SESSION_CONTEXT: 'rls.session.current_org_id',

  /**
   * Path 5: Audit event writes.
   *
   * Inserts into `public.audit_events` MUST supply `org_id =
   * resolvePlatformTenantId(ctx)`. Audit writes are the strongest evidence
   * of a governance decision and any drift here corrupts the CUPE
   * evidence bundle.
   */
  AUDIT_EVENT_WRITE: 'audit_events.write',
} as const);

export type FoundationalPathKey = keyof typeof FOUNDATIONAL_PATHS;
export type FoundationalPathValue = (typeof FOUNDATIONAL_PATHS)[FoundationalPathKey];

/**
 * The canonical list of foundational path values. Validators use this to
 * check that no additional path names have been added without amending
 * the ownership manifest.
 */
export const FOUNDATIONAL_PATH_VALUES: readonly FoundationalPathValue[] =
  Object.freeze(Object.values(FOUNDATIONAL_PATHS));
