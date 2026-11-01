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
  const sharedFromParent = and(
    eq(knowledgeBase.organizationId, parentId),
    or(eq(knowledgeBase.isPublic, true), sql`${knowledgeBase.allowedOrganizations} @> ${JSON.stringify([orgId])}::jsonb`),
  )!;
  return or(own, sharedFromParent)!;
}

