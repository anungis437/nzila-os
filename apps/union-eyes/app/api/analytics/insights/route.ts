/**
 * GET PATCH /api/analytics/insights — the organization's insight records and their triage.
 *
 * An insight is produced by an analysis job (the weekly summary, a model run), so a person cannot create one here: the old
 * generic POST let a steward store a row with any AI reference id, confidence score and data source, which then read as a
 * model result. POST now answers 501. The only change a person makes is the triage of an existing insight: acknowledge,
 * start, complete or dismiss it, stamped with their identity and the server's clock and audited with the change.
 */
import { and, eq } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { insightRecommendations } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: insightRecommendations,
  pk: 'id',
  tags: ["Analytics"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET };

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Analytics'], summary: 'Create an insight (not implemented)', description: 'Not implemented: insights are produced by analysis jobs.' },
  },
  async () => {
    throw ApiError.notImplemented('Insights are produced by the analysis jobs; one cannot be created through this route.');
  },
);

// What each status may follow. A finished or dismissed insight is not reopened here.
const TRANSITIONS: Record<string, readonly string[]> = {
  new: ['acknowledged', 'in_progress', 'completed', 'dismissed'],
  acknowledged: ['in_progress', 'completed', 'dismissed'],
  in_progress: ['completed', 'dismissed'],
};

const triageSchema = z.object({
  insightId: z.guid(),
  status: z.enum(['acknowledged', 'in_progress', 'completed', 'dismissed']),
  notes: z.string().max(2000).optional(),
  dismissalReason: z.string().trim().min(1).max(500).optional(),
}).strict();

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    body: triageSchema,
    openapi: { tags: ['Analytics'], summary: 'Triage an insight' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    if (body.status === 'dismissed' && !body.dismissalReason) throw ApiError.badRequest('A dismissal needs a reason');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [existing] = await tx
        .select({ id: insightRecommendations.id, status: insightRecommendations.status })
        .from(insightRecommendations)
        .where(and(eq(insightRecommendations.id, body.insightId), eq(insightRecommendations.organizationId, organizationId)))
        .for('update')
        .limit(1);
      if (!existing) throw ApiError.notFound('Insight');

      const current = existing.status ?? 'new';
      if (!(TRANSITIONS[current] ?? []).includes(body.status)) {
        throw ApiError.conflict(`An insight that is ${current} cannot become ${body.status}`);
      }

      const now = new Date();
      const [updated] = await tx
        .update(insightRecommendations)
        .set({
          status: body.status,
          notes: body.notes ?? undefined,
          updatedAt: now,
          ...(body.status === 'acknowledged' ? { acknowledgedBy: userId, acknowledgedAt: now } : {}),
          ...(body.status === 'completed' ? { completedAt: now } : {}),
          ...(body.status === 'dismissed' ? { dismissedBy: userId, dismissedAt: now, dismissalReason: body.dismissalReason } : {}),
        })
        .where(and(eq(insightRecommendations.id, body.insightId), eq(insightRecommendations.organizationId, organizationId), eq(insightRecommendations.status, current)))
        .returning();
      if (!updated) throw ApiError.conflict('The insight changed while it was being updated');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'insight.triage',
        resourceType: 'insight_recommendations',
        resourceId: body.insightId,
        details: { from: current, to: body.status },
      });
      return { success: true, data: updated };
    });
  },
);
