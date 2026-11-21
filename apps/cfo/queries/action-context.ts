import { and, asc, eq } from 'drizzle-orm'
import { platformDb } from '@nzila/db/platform'
import { orgMembers, orgs } from '@nzila/db/schema'

/** Preserve CFO's actual platform connection. No product database fallback,
 * role switching, membership creation or additional grants are introduced. */
export type CfoActionDb = Pick<
  typeof platformDb,
  'select' | 'insert' | 'update' | 'delete' | 'execute'
>
export function withCfoActionTransaction<T>(
  operation: (tx: CfoActionDb) => Promise<T>,
): Promise<T> {
  return platformDb.transaction(operation)
}

export function lockCfoMemberships(tx: CfoActionDb, userId: string) {
  return tx
    .select({
      organizationId: orgMembers.orgId,
      membershipId: orgMembers.id,
      role: orgMembers.role,
    })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(
      and(
        eq(orgMembers.userId, userId),
        eq(orgMembers.status, 'active'),
        eq(orgs.status, 'active'),
      ),
    )
    .orderBy(asc(orgMembers.orgId))
    .for('share')
}

export async function lockCfoOrganization(tx: CfoActionDb, organizationId: string) {
  const [row] = await tx
    .select({ id: orgs.id })
    .from(orgs)
    .where(eq(orgs.id, organizationId))
    .limit(1)
    .for('share')
  return row ?? null
}

/** postgres-js returns rows directly; SQL-engine component fixtures may use
 * the node-postgres rows envelope. Unknown transport shapes fail explicitly. */
export function cfoRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('CFO_QUERY_RESULT_UNAVAILABLE')
}
