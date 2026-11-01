/**
 * shared_clause_library sharing authority — OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY
 * (round 55), enforced by the database since cache 0048.
 *
 * The table has NO organization-scoped RLS-style single-owner model: a row
 * has one OWNER (`sourceOrganizationId`) plus a `sharingLevel` that may grant
 * READ to other organizations (`private` + explicit `sharedWithOrgIds`,
 * `federation`, `congress`, or `public`). Cross-org READ access must never
 * imply WRITE access — mutation (content, sharing settings, tags, delete)
 * remains owner-only regardless of sharingLevel, matching
 * ClauseSharingControls.tsx's documented levels (private/federation/
 * congress/public) and the org hierarchy already modeled in
 * db/schema-organizations.ts (organizationType, hierarchyPath, clcAffiliated)
 * and db/schema/congress-memberships-schema.ts.
 *
 * The rule is ONE database function, public.ue_clause_readable_by
 * (db/migrations-cache/0048_clause_library_sharing_rls.sql). The tenant policy
 * on the table admits federation and congress rows through it, and this module
 * asks the same function, so the list, search, compare and item reads run as the
 * tenant (never the system role) and cannot disagree with each other or with the
 * policy. The function is the only place that reads other organizations'
 * hierarchy and congress membership.
 */
import { sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/db';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';

export interface ClauseSharingRow {
  sourceOrganizationId: string;
  sharingLevel: string | null;
  sharedWithOrgIds?: string[] | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A raw query answers an array on the production driver and { rows } on others; both are rows. */
const rowsOf = <T,>(result: unknown): T[] =>
  Array.isArray(result) ? (result as T[]) : ((result as { rows?: T[] } | null)?.rows ?? []);

/** A uuid[] literal built only from well-formed ids, so a stored value can never change the statement. */
const uuidArray = (ids: readonly string[] | null | undefined): SQL => {
  const clean = (ids ?? []).filter((id) => UUID_RE.test(id));
  return sql`${`{${clean.join(',')}}`}::uuid[]`;
};

/**
 * Nearest federation (or the organization itself when it is one): the deepest
 * federation on the org's materialized `hierarchyPath`. Null if the org has no
 * federation ancestor (e.g. a bare congress root, or an org outside any federation).
 */
export async function getFederationAncestorId(orgId: string): Promise<string | null> {
  const rows = rowsOf<{ id: string | null }>(await db.execute(sql`SELECT public.ue_clause_federation_ancestor(${orgId}::uuid)::text AS id`));
  return rows[0]?.id ?? null;
}

/**
 * Congress-level sharing requires the organization to be CLC-affiliated AND
 * hold an active congress_memberships row — matches
 * lib/auth/hierarchy-access-control.ts's validateSharingLevel congress check.
 */
export async function isOrgCongressEligible(orgId: string): Promise<boolean> {
  const rows = rowsOf<{ eligible: boolean | null }>(await db.execute(sql`SELECT public.ue_clause_congress_eligible(${orgId}::uuid) AS eligible`));
  return rows[0]?.eligible === true;
}

/**
 * Item-level READ authorization: true if callerOrgId may see this specific
 * clause row's full content. Owner always reads regardless of sharingLevel.
 * Unknown/unrecognized sharingLevel values fail closed (return false). The
 * answer is the database function's, the same one the tenant policy and the
 * list predicate use.
 */
export async function canReadSharedClause(callerOrgId: string, clause: ClauseSharingRow): Promise<boolean> {
  if (!UUID_RE.test(callerOrgId) || !UUID_RE.test(clause.sourceOrganizationId)) return false;
  const rows = rowsOf<{ readable: boolean | null }>(
    await db.execute(
      sql`SELECT public.ue_clause_readable_by(${clause.sourceOrganizationId}::uuid, ${clause.sharingLevel}::text, ${uuidArray(clause.sharedWithOrgIds)}, ${callerOrgId}::uuid) AS readable`,
    ),
  );
  return rows[0]?.readable === true;
}

/**
 * Owner-only mutation authority. Broad reader visibility (federation,
 * congress, public, or an explicit private grant) never implies write:
 * only the source organization may change content, sharing settings, tags,
 * or delete the row.
 */
export function isSharedClauseOwner(callerOrgId: string, clause: { sourceOrganizationId: string }): boolean {
  return clause.sourceOrganizationId === callerOrgId;
}

export const SHARING_LEVELS = ['private', 'federation', 'congress', 'public'] as const;
const MAX_EXPLICIT_GRANTS = 200;

/**
 * Whether the owner organization may set this sharing configuration. A level the organization does not qualify for
 * (federation without a federation ancestor, congress without an active CLC membership) is refused instead of stored,
 * so a clause can never be shared at a scope the owner has no standing in. The checks read the organization hierarchy
 * across tenants through the database functions, which a tenant transaction may call.
 */
export async function sharingChangeDenial(
  ownerOrgId: string,
  change: { sharingLevel?: unknown; sharedWithOrgIds?: unknown },
): Promise<{ status: 400 | 403; message: string } | null> {
  if (change.sharingLevel !== undefined) {
    if (typeof change.sharingLevel !== 'string' || !(SHARING_LEVELS as readonly string[]).includes(change.sharingLevel)) {
      return { status: 400, message: `sharingLevel must be one of ${SHARING_LEVELS.join(', ')}` };
    }
    if (change.sharingLevel === 'federation' && !(await getFederationAncestorId(ownerOrgId))) {
      return { status: 403, message: 'Federation sharing requires membership of a federation' };
    }
    if (change.sharingLevel === 'congress' && !(await isOrgCongressEligible(ownerOrgId))) {
      return { status: 403, message: 'Congress sharing requires an active congress membership' };
    }
  }
  if (change.sharedWithOrgIds !== undefined && change.sharedWithOrgIds !== null) {
    const ids = change.sharedWithOrgIds;
    if (
      !Array.isArray(ids) ||
      ids.length > MAX_EXPLICIT_GRANTS ||
      !ids.every((id) => typeof id === 'string' && UUID_RE.test(id))
    ) {
      return { status: 400, message: 'sharedWithOrgIds must be a list of organization ids' };
    }
  }
  return null;
}

/**
 * SQL WHERE condition equal to `canReadSharedClause` for each row, for
 * LIST/SEARCH/COMPARE queries — avoids fetch-then-filter (which would both
 * leak unauthorized rows into application memory and break pagination
 * totals). It is the database function itself, so no join against
 * organizations or congress_memberships is needed to evaluate it.
 */
export async function buildClauseVisibilityCondition(callerOrgId: string): Promise<SQL> {
  if (!UUID_RE.test(callerOrgId)) return sql`false`;
  return sql`public.ue_clause_readable_by(${sharedClauseLibrary.sourceOrganizationId}, ${sharedClauseLibrary.sharingLevel}, ${sharedClauseLibrary.sharedWithOrgIds}, ${callerOrgId}::uuid)`;
}

/** The owner's name as the database discloses it: only for a clause the caller's bound organization may read. */
export const clauseSourceName = (): SQL<string | null> => sql<string | null>`public.ue_clause_source_name(${sharedClauseLibrary.id})`;
