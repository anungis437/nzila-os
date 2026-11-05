import { and, eq, inArray } from 'drizzle-orm';
import { organizationMembers } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';

/**
 * The names of the people who filed documents, by user id, for the views that may show who filed what (a representative's).
 * Only members of the organization are named: someone who has left, or whose name is blank, is absent, and a view then shows
 * no name for them instead of their id.
 */
export async function loadUploaderNames(
  organizationId: string,
  userIds: ReadonlyArray<string | null | undefined>,
): Promise<Record<string, string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};

  return withRLSContext({ organizationId }, async (tx) => {
    const members = await tx
      .select({ userId: organizationMembers.userId, name: organizationMembers.name })
      .from(organizationMembers)
      .where(and(eq(organizationMembers.organizationId, organizationId), inArray(organizationMembers.userId, ids)));

    return Object.fromEntries(members.filter((member) => member.name).map((member) => [member.userId, member.name]));
  });
}
