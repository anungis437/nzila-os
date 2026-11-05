/**
 * shared_clause_library sharing authority — OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY (round 55), enforced by the database.
 *
 * The table has NO organization-scoped RLS-style single-owner model: a row has one OWNER (`sourceOrganizationId`) plus a `sharingLevel` that may
 * grant READ to other organizations. Cross-org READ access must never imply WRITE access — mutation (content, sharing settings, tags, delete)
 * remains owner-only regardless of sharingLevel.
 *
 * What the tenant role can read is the policy of cache 0011/0012 and nothing more: the owner, an organization named in the explicit grant list of a
 * `private` clause, and everyone for a `public` clause. This module states the same rule for the item read and for the list predicate, so the list,
 * search, compare and item reads run as the tenant (never the system role) and cannot disagree with each other or with the policy.
 *
 * The `federation` and `congress` levels are NOT readable by another organization. Evaluating them means reading other organizations' hierarchy and
 * congress membership, which a tenant policy cannot see, and the only way found to do it was a SECURITY DEFINER function executable by the runtime
 * role — which the catalog admission contract refuses (cache 0048 was retired by 0050 for that reason). A clause shared at those levels is therefore
 * readable by its owner only (fail closed) until an approved way to evaluate the hierarchy exists, and the share routes refuse to set them.
 */
import { sql, inArray, type SQL } from 'drizzle-orm';
import { organizations } from '@/db/schema-organizations';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';
import { clauseSourceProjection } from '@/lib/clause-library/source-projection';

export interface ClauseSharingRow {
  sourceOrganizationId: string;
  sharingLevel: string | null;
  sharedWithOrgIds?: string[] | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Whether a value is a UUID, for ids that arrive as free text (such as the entries of an organization hierarchy path). */
export const isUuid = (value: string): boolean => UUID_RE.test(value);

/**
 * Item-level READ authorization: true if callerOrgId may see this specific clause row's full content. Owner always reads regardless of
 * sharingLevel. An unrecognized sharingLevel, and the federation and congress levels, fail closed (false for anyone but the owner). This is the
 * rule of the tenant policy, so a row the policy admitted is a row this admits.
 */
export async function canReadSharedClause(callerOrgId: string, clause: ClauseSharingRow): Promise<boolean> {
  if (!UUID_RE.test(callerOrgId) || !UUID_RE.test(clause.sourceOrganizationId)) return false;
  const caller = callerOrgId.toLowerCase();
  if (clause.sourceOrganizationId.toLowerCase() === caller) return true;
  if (clause.sharingLevel === 'public') return true;
  if (clause.sharingLevel === 'private') return (clause.sharedWithOrgIds ?? []).some((id) => typeof id === 'string' && id.toLowerCase() === caller);
  return false;
}

/**
 * Owner-only mutation authority. Broad reader visibility (public, or an explicit private grant) never implies write: only the source organization
 * may change content, sharing settings, tags, or delete the row.
 */
export function isSharedClauseOwner(callerOrgId: string, clause: { sourceOrganizationId: string }): boolean {
  return clause.sourceOrganizationId === callerOrgId;
}

export const SHARING_LEVELS = ['private', 'federation', 'congress', 'public'] as const;
const MAX_EXPLICIT_GRANTS = 200;

/** The levels another organization cannot read yet (see the header). */
export const UNAVAILABLE_SHARING_LEVELS: readonly string[] = ['federation', 'congress'];

/**
 * Whether the owner organization may set this sharing configuration. A level that no other organization could read (federation and congress) is
 * refused instead of stored, so a clause is never marked as shared with a group that cannot see it. Sending the level the clause already has is
 * not a change (`currentSharingLevel`), so a clause stored at one of those levels before they were withdrawn stays editable.
 */
export async function sharingChangeDenial(
  _ownerOrgId: string,
  change: { sharingLevel?: unknown; sharedWithOrgIds?: unknown },
  currentSharingLevel?: string | null,
): Promise<{ status: 400 | 403; message: string } | null> {
  if (change.sharingLevel !== undefined) {
    if (typeof change.sharingLevel !== 'string' || !(SHARING_LEVELS as readonly string[]).includes(change.sharingLevel)) {
      return { status: 400, message: `sharingLevel must be one of ${SHARING_LEVELS.join(', ')}` };
    }
    if (UNAVAILABLE_SHARING_LEVELS.includes(change.sharingLevel) && change.sharingLevel !== currentSharingLevel) {
      return {
        status: 403,
        message: `Sharing at the ${change.sharingLevel} level is not available: another organization's hierarchy cannot be evaluated safely yet, so only private, public and explicit grants are offered`,
      };
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
 * SQL WHERE condition equal to `canReadSharedClause` for each row, for LIST/SEARCH/COMPARE queries — avoids fetch-then-filter (which would both
 * leak unauthorized rows into application memory and break pagination totals). The tenant policy admits the same rows, so this is the explicit
 * statement of a rule the database also enforces.
 */
export async function buildClauseVisibilityCondition(callerOrgId: string): Promise<SQL> {
  if (!UUID_RE.test(callerOrgId)) return sql`false`;
  return sql`(${sharedClauseLibrary.sourceOrganizationId} = ${callerOrgId}::uuid
    OR ${sharedClauseLibrary.sharingLevel} = 'public'
    OR (${sharedClauseLibrary.sharingLevel} = 'private' AND ${callerOrgId}::uuid = ANY (COALESCE(${sharedClauseLibrary.sharedWithOrgIds}, '{}'::uuid[]))))`;
}

/**
 * The owning organization's name, for the clauses a caller has already been admitted to read and whose source the projection may disclose (not an
 * anonymized clause of another organization). A tenant cannot read another organization's row, so the names are read by id on the system role,
 * which can read organizations; the ids come only from rows the tenant policy returned, so this is never a directory of organizations.
 */
export async function sourceNamesFor(
  rows: ReadonlyArray<{ sourceOrganizationId: string; isAnonymized?: boolean | null }>,
  callerOrgId: string,
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(rows.filter((row) => clauseSourceProjection({ sourceOrganizationId: row.sourceOrganizationId, isAnonymized: row.isAnonymized }, callerOrgId)).map((row) => row.sourceOrganizationId)),
  ].filter((id) => UUID_RE.test(id));
  if (ids.length === 0) return new Map();
  const found = await withSystemContext((tx) => tx.select({ id: organizations.id, name: organizations.name }).from(organizations).where(inArray(organizations.id, ids)));
  return new Map(found.map((organization) => [organization.id, organization.name] as [string, string]));
}
