/**
 * GET PATCH DELETE /api/precedents/[id] — one arbitration precedent in the shared library.
 *
 * A precedent is owned by `source_organization_id`; the table has no organization_id, so a generic tenant filter never
 * applied and any precedent of any organization could be read, rewritten or deleted by id. Authority is now explicit:
 * - GET reads a precedent the caller's organization owns, or one shared with it. Cache migration 0030 admits, at the database,
 *   rows with an explicit grant to the caller's organization or sharing_level = 'public'; federation and congress levels stay
 *   owner-only there until their own reviewed design exists. canReadSharedClause is the second gate, and a non-owner gets a
 *   projection without the owner's document location, grant list or author.
 * - PATCH and DELETE are owner-only, run under the caller's tenant RLS context, name the owner in their own WHERE
 *   clause, and are audited in the same transaction. Sharing changes are checked against the owner's standing.
 */
import { and, count, eq } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { arbitrationPrecedents, precedentCitations, precedentTags } from '@/db/schema/arbitration-precedents-schema';
import { withRLSContext, withSystemContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { canReadSharedClause, isSharedClauseOwner, sharingChangeDenial } from '@/lib/clause-library/sharing-authority';
import { PRECEDENT_EDITABLE_FIELDS, toReaderView } from '@/lib/precedents/precedent-access';

export const dynamic = 'force-dynamic';

const idSchema = z.guid();

const patchSchema = z
  .object({
    caseNumber: z.string().max(100).nullable(),
    caseTitle: z.string().min(1).max(500),
    decisionDate: z.string().min(1),
    isPartiesAnonymized: z.boolean(),
    unionName: z.string().max(200).nullable(),
    employerName: z.string().max(200).nullable(),
    arbitratorName: z.string().min(1).max(200),
    jurisdiction: z.string().min(1).max(50),
    grievanceType: z.string().min(1).max(100),
    issueSummary: z.string().min(1),
    unionPosition: z.string().nullable(),
    employerPosition: z.string().nullable(),
    outcome: z.string().min(1).max(50),
    decisionSummary: z.string().min(1),
    reasoning: z.string().nullable(),
    precedentialValue: z.string().max(20),
    keyPrinciples: z.array(z.string()).max(100),
    relatedLegislation: z.string().nullable(),
    sector: z.string().max(100).nullable(),
    province: z.string().max(2).nullable(),
    sharingLevel: z.string(),
    sharedWithOrgIds: z.array(z.string()).nullable(),
  })
  .partial()
  .strict();

async function readPrecedent(id: string, executor: RLSTx) {
  const [row] = await executor.select().from(arbitrationPrecedents).where(eq(arbitrationPrecedents.id, id)).limit(1);
  return row ?? null;
}

function requireIds(params: Record<string, string> | undefined, organizationId: string | null, userId: string | null) {
  if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
  const id = params?.id;
  if (!idSchema.safeParse(id).success) throw ApiError.badRequest('id must be a valid identifier');
  return { id: id as string, organizationId, userId };
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Bargaining'], summary: 'Get one arbitration precedent' },
  },
  async ({ params, organizationId, userId }) => {
    const ctx = requireIds(params, organizationId, userId);
    // The read runs in the caller's tenant context, so the deployed policies on arbitration_precedents (owner, plus 0030's
    // explicit-grant and public read) are the first gate; canReadSharedClause is the second. The system role holds no
    // privilege on this table, and none is granted here.
    return withRLSContext({ organizationId: ctx.organizationId, userId: ctx.userId }, async (tx) => {
      const row = await readPrecedent(ctx.id, tx);
      if (!row || !(await canReadSharedClause(ctx.organizationId, row))) {
        throw ApiError.notFound('precedent', ctx.id);
      }
      return { data: toReaderView(row, ctx.organizationId) };
    });
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Bargaining'], summary: 'Update an owned arbitration precedent' },
  },
  async ({ params, request, organizationId, userId }) => {
    const ctx = requireIds(params, organizationId, userId);
    const parsed = patchSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) throw ApiError.badRequest('Invalid precedent update');
    const changes = parsed.data;
    const fields = (PRECEDENT_EDITABLE_FIELDS as readonly string[]).filter((f) => f in changes);
    if (fields.length === 0) throw ApiError.badRequest('No editable fields supplied');

    const denial = await withSystemContext(() => sharingChangeDenial(ctx.organizationId, changes));
    if (denial) throw denial.status === 403 ? ApiError.forbidden(denial.message) : ApiError.badRequest(denial.message);

    return withRLSContext({ organizationId: ctx.organizationId, userId: ctx.userId }, async (tx) => {
      const existing = await readPrecedent(ctx.id, tx);
      // A missing row and a row of another organization answer identically.
      if (!existing || !isSharedClauseOwner(ctx.organizationId, { sourceOrganizationId: existing.sourceOrganizationId })) {
        throw ApiError.notFound('precedent', ctx.id);
      }
      const [updated] = await tx
        .update(arbitrationPrecedents)
        .set({ ...changes, updatedAt: new Date() } as never)
        .where(and(eq(arbitrationPrecedents.id, ctx.id), eq(arbitrationPrecedents.sourceOrganizationId, ctx.organizationId)))
        .returning();
      if (!updated) throw ApiError.notFound('precedent', ctx.id);

      await persistAtomicAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'precedent.update',
        resourceType: 'arbitration_precedents',
        resourceId: ctx.id,
        details: {
          fields,
          ...('sharingLevel' in changes ? { fromSharingLevel: existing.sharingLevel, toSharingLevel: changes.sharingLevel } : {}),
        },
      });
      return { data: toReaderView(updated, ctx.organizationId) };
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: { tags: ['Bargaining'], summary: 'Delete an owned arbitration precedent' },
  },
  async ({ params, organizationId, userId }) => {
    const ctx = requireIds(params, organizationId, userId);
    return withRLSContext({ organizationId: ctx.organizationId, userId: ctx.userId }, async (tx) => {
      const existing = await readPrecedent(ctx.id, tx);
      if (!existing || !isSharedClauseOwner(ctx.organizationId, { sourceOrganizationId: existing.sourceOrganizationId })) {
        throw ApiError.notFound('precedent', ctx.id);
      }
      // The tags and the citation history cascade with the row. A precedent that has been cited is part of other records' reasoning, so
      // it is retained: withdraw it from sharing (sharingLevel) instead. One that was never cited is removed with an audit that keeps
      // what identified it.
      const [{ n: citations }] = await tx.select({ n: count() }).from(precedentCitations).where(eq(precedentCitations.precedentId, ctx.id));
      if (Number(citations) > 0) {
        throw ApiError.conflict('This precedent has citation history and is retained. Withdraw it from sharing instead of deleting it.');
      }
      const [{ n: tags }] = await tx.select({ n: count() }).from(precedentTags).where(eq(precedentTags.precedentId, ctx.id));
      const [deleted] = await tx
        .delete(arbitrationPrecedents)
        .where(and(eq(arbitrationPrecedents.id, ctx.id), eq(arbitrationPrecedents.sourceOrganizationId, ctx.organizationId)))
        .returning({ id: arbitrationPrecedents.id });
      if (!deleted) throw ApiError.notFound('precedent', ctx.id);

      await persistAtomicAudit(tx, {
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'precedent.delete',
        resourceType: 'arbitration_precedents',
        resourceId: ctx.id,
        details: {
          caseNumber: existing.caseNumber,
          caseTitle: existing.caseTitle,
          jurisdiction: existing.jurisdiction,
          sharingLevel: existing.sharingLevel,
          removedTagCount: Number(tags),
        },
      });
      return { success: true };
    });
  },
);
