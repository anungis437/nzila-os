import { and, eq } from 'drizzle-orm'
import { ApiError } from '@/lib/api/errors'
import { collectiveAgreements } from '@/db/schema'
import { cbaClause } from '@/db/schema/domains/agreements/clauses'
import type { RLSTx } from '@/lib/db/with-rls-context'

/** A clause may cite only a clause of an agreement of the caller own organization. */
export async function assertOriginalClauseOwned(tx: RLSTx, originalClauseId: string | null | undefined, organizationId: string): Promise<void> {
  if (!originalClauseId) return
  const [row] = await tx
    .select({ id: cbaClause.id })
    .from(cbaClause)
    .innerJoin(collectiveAgreements, eq(cbaClause.cbaId, collectiveAgreements.id))
    .where(and(eq(cbaClause.id, originalClauseId), eq(collectiveAgreements.organizationId, organizationId)))
    .limit(1)
  if (!row) throw ApiError.notFound('originalClauseId')
}
