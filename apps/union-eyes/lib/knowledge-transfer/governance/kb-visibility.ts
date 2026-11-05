import { and, eq, or, sql, type SQL } from 'drizzle-orm';
import { knowledgeBase } from '@/db/schema';

/**
 * Which knowledge-base rows an organization may read. Its own rows are its own. A parent organization's row is visible only when that
 * row is public or names the reading organization in its allowed list: the access columns of the table decide, so a row the parent kept
 * private is not served to its children just because the parent is in the lookup.
 */
export function knowledgeBaseOrganizationCondition(orgId: string, parentId: string | undefined): SQL {
  const own = eq(knowledgeBase.organizationId, orgId);
  if (!parentId) return own;
  return or(own, knowledgeBaseParentSharedCondition(orgId, parentId))!;
}

/**
 * The parent's rows that were shared with the organization, and only those: public, or naming the organization in the allowed list. A row made from
 * an exit interview is never one of them: an interview's copy stays with the organization that owns the interview.
 *
 * Row-level security shows a tenant only its own organization's rows, so a child reads these through a gated system read (the knowledge suite
 * entitlement and the hierarchy's own record of the parent), not in its tenant transaction.
 */
export function knowledgeBaseParentSharedCondition(orgId: string, parentId: string): SQL {
  return and(
    eq(knowledgeBase.organizationId, parentId),
    or(eq(knowledgeBase.isPublic, true), sql`${knowledgeBase.allowedOrganizations} @> ${JSON.stringify([orgId])}::jsonb`),
    sql`coalesce(${knowledgeBase.sourceType}, '') <> 'exit_interview'`,
  )!;
}

