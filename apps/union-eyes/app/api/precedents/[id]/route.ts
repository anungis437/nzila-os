/**
 * GET PATCH DELETE /api/precedents/[id] — one arbitration precedent in the shared library.
 *
 * A precedent is owned by `source_organization_id`; the table has no organization_id, so a generic tenant filter never
 * applied and any precedent of any organization could be read, rewritten or deleted by id. Authority is now explicit:
 * - GET reads a precedent the caller's organization owns. The deployed row-level policy admits only the owner's rows, so a
 *   precedent another organization shared reads as not found until a reviewed multi-party policy admits it; when it does,
 *   canReadSharedClause (public, an explicit grant, the same federation/congress) decides and a non-owner gets a projection
 *   without the owner's document location, grant list or author.
 * - PATCH and DELETE are owner-only, run under the caller's tenant RLS context, name the owner in their own WHERE
 *   clause, and are audited in the same transaction. Sharing changes are checked against the owner's standing.
 */
import { and, eq } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { arbitrationPrecedents } from '@/db/schema/arbitration-precedents-schema';
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
    // The read runs in the caller's tenant context, so the deployed policy on arbitration_precedents (owner only) is the
    // first gate; canReadSharedClause is the second, for the day a multi-party policy admits shared rows. The system role
    // holds no privilege on this table, and none is granted here: cross-organization sharing needs its own reviewed policy.
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
        details: { caseNumber: existing.caseNumber, sharingLevel: existing.sharingLevel },
      });
      return { success: true };
    });
  },
);
