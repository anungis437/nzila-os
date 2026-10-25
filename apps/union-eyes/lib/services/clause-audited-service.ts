/**
 * Organization-scoped clause access. Reads and writes look a clause up by id AND organization (a clause in another
 * organization is simply not found), and every write commits with its audit record in the same transaction.
 */
import { and, asc, eq, inArray, sql } from 'drizzle-orm';
import { cbaClause, clauseComparisons } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { compareClauses, type Clause, type ClauseComparisonResult } from '@/lib/services/clause-service';

export interface ClauseScope {
  organizationId: string;
  userId: string;
}

/** The only fields a caller may change; ownership (organization, agreement, id) is never writable. */
export type ClauseUpdateInput = Partial<
  Pick<
    typeof cbaClause.$inferInsert,
    | 'clauseNumber'
    | 'clauseType'
    | 'title'
    | 'content'
    | 'contentPlainText'
    | 'pageNumber'
    | 'articleNumber'
    | 'sectionHierarchy'
    | 'orderIndex'
    | 'keyTerms'
    | 'interpretationNotes'
  >
>;

export async function getClauseForOrganization(
  organizationId: string,
  id: string,
  options: { countView?: boolean } = {},
): Promise<Clause | null> {
  return withRLSContext({ organizationId }, async (tx) => {
    const inOrganization = and(eq(cbaClause.id, id), eq(cbaClause.organizationId, organizationId));
    const [clause] = await tx.select().from(cbaClause).where(inOrganization).limit(1);
    if (!clause) return null;
    if (options.countView) {
      await tx
        .update(cbaClause)
        .set({ viewCount: sql`${cbaClause.viewCount} + 1` })
        .where(inOrganization);
    }
    return clause;
  });
}

export async function getClauseHierarchyForOrganization(organizationId: string, id: string) {
  return withRLSContext({ organizationId }, async (tx) => {
    const [clause] = await tx
      .select()
      .from(cbaClause)
      .where(and(eq(cbaClause.id, id), eq(cbaClause.organizationId, organizationId)))
      .limit(1);
    if (!clause) return null;

    let parent: Clause | null = null;
    if (clause.parentClauseId) {
      const [found] = await tx
        .select()
        .from(cbaClause)
        .where(and(eq(cbaClause.id, clause.parentClauseId), eq(cbaClause.organizationId, organizationId)))
        .limit(1);
      parent = found ?? null;
    }
    const children = await tx
      .select()
      .from(cbaClause)
      .where(and(eq(cbaClause.parentClauseId, id), eq(cbaClause.organizationId, organizationId)))
      .orderBy(asc(cbaClause.orderIndex));
    return { parent, clause, children };
  });
}

/** Null when the clause is not in the organization; nothing is written or audited in that case. */
export async function updateClauseAudited(scope: ClauseScope, id: string, data: ClauseUpdateInput): Promise<Clause | null> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    const [updated] = await tx
      .update(cbaClause)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(cbaClause.id, id), eq(cbaClause.organizationId, scope.organizationId)))
      .returning();
    if (!updated) return null;
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'clause.update',
      resourceType: 'cba_clauses',
      resourceId: id,
      details: { fields: Object.keys(data), cbaId: updated.cbaId },
    });
    return updated;
  });
}

export async function deleteClauseAudited(scope: ClauseScope, id: string): Promise<boolean> {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    const [deleted] = await tx
      .delete(cbaClause)
      .where(and(eq(cbaClause.id, id), eq(cbaClause.organizationId, scope.organizationId)))
      .returning({ id: cbaClause.id, cbaId: cbaClause.cbaId, clauseNumber: cbaClause.clauseNumber });
    if (!deleted) return false;
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'clause.delete',
      resourceType: 'cba_clauses',
      resourceId: id,
      details: { cbaId: deleted.cbaId, clauseNumber: deleted.clauseNumber },
    });
    return true;
  });
}

/** Null when any requested clause is not in the organization. */
export async function compareClausesInOrganization(
  organizationId: string,
  request: { clauseIds: string[]; analysisType: 'similarities' | 'differences' | 'best_practices' | 'all' },
): Promise<ClauseComparisonResult | null> {
  const ids = [...new Set(request.clauseIds)];
  const found = await withRLSContext({ organizationId }, async (tx) =>
    tx
      .select({ id: cbaClause.id })
      .from(cbaClause)
      .where(and(inArray(cbaClause.id, ids), eq(cbaClause.organizationId, organizationId))),
  );
  if (found.length !== ids.length) return null;
  return withRLSContext({ organizationId }, async () => compareClauses({ ...request, clauseIds: ids, organizationId }));
}

export async function saveClauseComparisonAudited(
  scope: ClauseScope,
  input: {
    comparisonName: string;
    clauseType: string;
    clauseIds: string[];
    analysisResults: (typeof clauseComparisons.$inferInsert)['analysisResults'];
  },
) {
  return withRLSContext({ organizationId: scope.organizationId }, async (tx) => {
    const [comparison] = await tx
      .insert(clauseComparisons)
      .values({
        comparisonName: input.comparisonName,
        clauseType: input.clauseType as (typeof clauseComparisons.$inferInsert)['clauseType'],
        clauseIds: input.clauseIds,
        organizationId: scope.organizationId,
        createdBy: scope.userId,
        analysisResults: input.analysisResults,
      })
      .returning();
    await persistAtomicAudit(tx, {
      organizationId: scope.organizationId,
      userId: scope.userId,
      action: 'clause.comparison.save',
      resourceType: 'clause_comparisons',
      resourceId: comparison.id,
      details: { comparisonName: input.comparisonName, clauseCount: input.clauseIds.length },
    });
    return comparison;
  });
}
