/**
 * CRUD collection route for tentativeAgreements
 *
 * tentativeAgreements has no organization_id column of its own — authority
 * is derived entirely through negotiation_id -> negotiations.organization_id.
 * lib/api/crud-factory.ts's orgScoped flag only filters a table's OWN
 * organizationId column; on a table without one (like this), orgScoped:true
 * silently becomes a no-op, exposing every organization's tentative
 * agreements to any authenticated member. Replaced with an explicit
 * parent-verified implementation.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { tentativeAgreements, negotiations, bargainingProposals } from '@/db/schema';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
import { assertOriginalClauseOwned } from '@/lib/clause-library/original-clause';
import { z } from 'zod';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

// Ratification, costing approval and sign-off are outcomes of their own processes and are never accepted at creation.
const createTentativeAgreementSchema = z.object({
  negotiationId: z.guid(),
  agreementNumber: z.string().min(1).max(50),
  title: z.string().min(1).max(500),
  clauseCategory: z.string().min(1).max(100),
  agreedLanguage: z.string().min(1),
  previousLanguage: z.string().optional(),
  relatedProposalIds: z.array(z.guid()).max(50).optional(),
  relatedClauseId: z.guid().optional(),
  requiresRatification: z.boolean().optional(),
  annualCost: z.string().optional(),
  implementationCost: z.string().optional(),
  agreedDate: z.coerce.date().optional(),
  effectiveDate: z.coerce.date().optional(),
});

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Bargaining'],
      summary: 'List tentativeAgreements',
      description: 'Returns a paginated list of tentativeAgreements for the organization.',
    },
  },
  async ({ request, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');

    const url = new URL(request.url);
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'));
    const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get('limit') || '50')));

    const whereClause = eq(negotiations.organizationId, organizationId);

    const [rows, totalResult] = await Promise.all([
      db
        .select({ tentativeAgreement: tentativeAgreements })
        .from(tentativeAgreements)
        .innerJoin(negotiations, eq(negotiations.id, tentativeAgreements.negotiationId))
        .where(whereClause)
        .orderBy(desc(tentativeAgreements.createdAt))
        .limit(limit)
        .offset((page - 1) * limit),
      db
        .select({ total: sql<number>`count(*)::int` })
        .from(tentativeAgreements)
        .innerJoin(negotiations, eq(negotiations.id, tentativeAgreements.negotiationId))
        .where(whereClause),
    ]);

    const total = totalResult[0]?.total ?? 0;

    return {
      data: rows.map((r) => r.tentativeAgreement),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Bargaining'],
      summary: 'Create tentativeAgreement',
      description: 'Creates a new tentativeAgreement record.',
    },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');

    const parsed = createTentativeAgreementSchema.safeParse(body);
    if (!parsed.success) {
      throw ApiError.badRequest(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '));
    }
    const { negotiationId, ...fields } = parsed.data;

    return withRLSContext({ organizationId }, async (tx) => {
      const [negotiation] = await tx
        .select({ id: negotiations.id })
        .from(negotiations)
        .where(and(eq(negotiations.id, negotiationId), eq(negotiations.organizationId, organizationId)));
      if (!negotiation) {
        throw ApiError.notFound('Negotiation', negotiationId);
      }

      // A reference names a row of this negotiation (proposals) or of the organization (clause), never another one's.
      const proposalIds = [...new Set(fields.relatedProposalIds ?? [])];
      if (proposalIds.length > 0) {
        const found = await tx
          .select({ id: bargainingProposals.id })
          .from(bargainingProposals)
          .where(and(inArray(bargainingProposals.id, proposalIds), eq(bargainingProposals.negotiationId, negotiationId)));
        if (found.length !== proposalIds.length) throw ApiError.notFound('relatedProposalIds');
      }
      await assertOriginalClauseOwned(tx, fields.relatedClauseId, organizationId);

      const [row] = await tx
        .insert(tentativeAgreements)
        .values({ ...fields, negotiationId, createdBy: userId, lastModifiedBy: userId })
        .returning();

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'bargaining.tentative_agreement.create',
        resourceType: 'tentative_agreements',
        resourceId: row.id,
        details: { negotiationId, agreementNumber: row.agreementNumber },
      });
      return { data: row };
    });
  },
);

