/**
 * shared_clause_library sharing authority — OWNER_PLUS_EXPLICIT_SHARING_AUTHORITY
 * (round 55).
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
 */
import { and, eq, inArray, or, sql, type SQL } from 'drizzle-orm';
import { db } from '@/db/db';
import { organizations, congressMemberships } from '@/db/schema';
import { sharedClauseLibrary } from '@/db/schema/domains/agreements/shared-library';

export interface ClauseSharingRow {
  sourceOrganizationId: string;
  sharingLevel: string | null;
  sharedWithOrgIds?: string[] | null;
}

/**
 * Nearest ancestor (or self) of organizationType 'federation', derived from
 * the org's materialized `hierarchyPath` (root-to-self ancestor id array).
 * Returns null if the org has no federation ancestor (e.g. a bare congress
 * root, or an org outside any federation).
 */
export async function getFederationAncestorId(orgId: string): Promise<string | null> {
  const [org] = await db
    .select({
      id: organizations.id,
      organizationType: organizations.organizationType,
      hierarchyPath: organizations.hierarchyPath,
    })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return null;
  if (org.organizationType === 'federation') return org.id;

  const ancestorIds = org.hierarchyPath ?? [];
  if (ancestorIds.length === 0) return null;

  const ancestors = await db
    .select({ id: organizations.id, organizationType: organizations.organizationType })
    .from(organizations)
    .where(inArray(organizations.id, ancestorIds));
  return ancestors.find((a) => a.organizationType === 'federation')?.id ?? null;
}

/**
 * Congress-level sharing requires the organization to be CLC-affiliated AND
 * hold an active congress_memberships row — matches
 * lib/auth/hierarchy-access-control.ts's validateSharingLevel congress check.
 */
export async function isOrgCongressEligible(orgId: string): Promise<boolean> {
  const [org] = await db
    .select({ clcAffiliated: organizations.clcAffiliated })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org?.clcAffiliated) return false;

  const [membership] = await db
    .select({ id: congressMemberships.id })
    .from(congressMemberships)
    .where(and(eq(congressMemberships.organizationId, orgId), eq(congressMemberships.status, 'active')))
    .limit(1);
  return !!membership;
}

/**
 * Item-level READ authorization: true if callerOrgId may see this specific
 * clause row's full content. Owner always reads regardless of sharingLevel.
 * Unknown/unrecognized sharingLevel values fail closed (return false).
 */
export async function canReadSharedClause(callerOrgId: string, clause: ClauseSharingRow): Promise<boolean> {
  if (clause.sourceOrganizationId === callerOrgId) return true;

  switch (clause.sharingLevel) {
    case 'public':
      return true;
    case 'private':
      return (clause.sharedWithOrgIds ?? []).includes(callerOrgId);
    case 'federation': {
      // Sequential (not Promise.all): keeps call ordering deterministic
      // for callers and tests alike; both lookups are cheap indexed reads.
      const callerFed = await getFederationAncestorId(callerOrgId);
      if (!callerFed) return false;
      const ownerFed = await getFederationAncestorId(clause.sourceOrganizationId);
      return callerFed === ownerFed;
    }
    case 'congress': {
      const callerEligible = await isOrgCongressEligible(callerOrgId);
      if (!callerEligible) return false;
      const ownerEligible = await isOrgCongressEligible(clause.sourceOrganizationId);
      return ownerEligible;
    }
    default:
      return false;
  }
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

/**
 * SQL WHERE condition equivalent to `canReadSharedClause` evaluated per row,
 * for LIST/SEARCH/COMPARE queries — avoids fetch-then-filter (which would
 * both leak unauthorized rows into application memory and break pagination
 * totals). The caller's own federation ancestor + congress eligibility are
 * resolved ONCE per request, not per row.
 *
 * REQUIRES the query to already `leftJoin(organizations, eq(sharedClauseLibrary.sourceOrganizationId, organizations.id))`
 * (the existing pattern in these routes, for `organizationName`) AND
 * `leftJoin(congressMemberships, and(eq(congressMemberships.organizationId, sharedClauseLibrary.sourceOrganizationId), eq(congressMemberships.status, 'active')))`
 * so the federation/congress predicates can reference the joined source
 * org's `hierarchyPath` / `clcAffiliated` and the joined active membership
 * row in SQL.
 */
export async function buildClauseVisibilityCondition(callerOrgId: string): Promise<SQL> {
  const callerFederationId = await getFederationAncestorId(callerOrgId);
  const callerCongressEligible = await isOrgCongressEligible(callerOrgId);

  const conditions: SQL[] = [
    eq(sharedClauseLibrary.sourceOrganizationId, callerOrgId),
    eq(sharedClauseLibrary.sharingLevel, 'public'),
    sql`(${sharedClauseLibrary.sharingLevel} = 'private' AND ${callerOrgId} = ANY(${sharedClauseLibrary.sharedWithOrgIds}))`,
  ];

  if (callerFederationId) {
    conditions.push(
      sql`(${sharedClauseLibrary.sharingLevel} = 'federation' AND (${sharedClauseLibrary.sourceOrganizationId} = ${callerFederationId} OR ${callerFederationId} = ANY(${organizations.hierarchyPath})))`,
    );
  }

  if (callerCongressEligible) {
    conditions.push(
      sql`(${sharedClauseLibrary.sharingLevel} = 'congress' AND ${organizations.clcAffiliated} = true AND ${congressMemberships.id} IS NOT NULL)`,
    );
  }

  return or(...conditions)!;
}
