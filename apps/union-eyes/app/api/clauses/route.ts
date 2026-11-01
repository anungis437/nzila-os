/**
 * CRUD collection route for cbaClause
 *
 * A clause belongs to one agreement of one organization. The factory only forces the clause's own organization, so a body could name
 * the agreement id of another organization (or a parent clause of another agreement) and file the clause under it. The agreement
 * and the parent clause are now checked against the caller's organization before the row is written, and the body may carry only
 * the fields an author types: the embedding, hash, confidence, extracted entities and usage counters come from processing.
 */
import { and, eq } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { cbaClause, collectiveAgreements } from '@/db/schema';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function verifyClauseReferences(
  values: Record<string, unknown>,
  organizationId: string | null | undefined,
): Promise<Record<string, unknown>> {
  if (!organizationId) throw ApiError.forbidden('Organization context required');
  const cbaId = values.cbaId;
  if (typeof cbaId !== 'string' || !UUID.test(cbaId)) throw ApiError.badRequest('A valid agreement id is required');

  const [agreement] = await db
    .select({ id: collectiveAgreements.id })
    .from(collectiveAgreements)
    .where(and(eq(collectiveAgreements.id, cbaId), eq(collectiveAgreements.organizationId, organizationId)))
    .limit(1);
  if (!agreement) throw ApiError.notFound('Agreement');

  const parentId = values.parentClauseId;
  if (parentId !== undefined && parentId !== null) {
    if (typeof parentId !== 'string' || !UUID.test(parentId)) throw ApiError.badRequest('Invalid parent clause id');
    const [parent] = await db
      .select({ id: cbaClause.id })
      .from(cbaClause)
      .where(and(eq(cbaClause.id, parentId), eq(cbaClause.cbaId, cbaId), eq(cbaClause.organizationId, organizationId)))
      .limit(1);
    if (!parent) throw ApiError.badRequest('The parent clause is not a clause of this agreement');
  }
  return values;
}

const { GET, POST } = crudRoutes({
  table: cbaClause,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  writableFields: [
    'cbaId', 'clauseNumber', 'clauseType', 'title', 'content', 'contentPlainText', 'pageNumber', 'articleNumber',
    'sectionHierarchy', 'parentClauseId', 'orderIndex', 'keyTerms', 'interpretationNotes',
  ],
  beforeCreate: (values, { organizationId }) => verifyClauseReferences(values, organizationId),
});
export { GET, POST };
