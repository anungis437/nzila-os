import { platformDb } from '@nzila/db/platform'
import { orgs, orgMembers } from '@nzila/db/schema'
import { and, eq, asc } from 'drizzle-orm'
export type ZongaActionDb = Pick<
  typeof platformDb,
  'select' | 'insert' | 'update' | 'delete' | 'execute'
>
export function withZongaTransaction<T>(operation: (db: ZongaActionDb) => Promise<T>) {
  return platformDb.transaction(operation)
}
export function activeZongaMemberships(db: ZongaActionDb, actorId: string) {
  return db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role })
    .from(orgMembers)
    .innerJoin(orgs, eq(orgs.id, orgMembers.orgId))
    .where(
      and(
        eq(orgMembers.userId, actorId),
        eq(orgMembers.status, 'active'),
        eq(orgs.status, 'active'),
      ),
    )
    .orderBy(asc(orgMembers.orgId))
    .for('share')
}
export function zongaRows<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[]
  if (result && typeof result === 'object' && 'rows' in result && Array.isArray(result.rows))
    return result.rows as T[]
  throw new Error('ZONGA_QUERY_RESULT_UNAVAILABLE')
}
