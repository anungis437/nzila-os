/**
 * POST /api/health-safety/hazards/[id]/transition — resolve or close a hazard report and record the date.
 *
 * The generic PATCH may not set a status or a date, so this is the workflow that does. `resolve` moves a reported, assessed or
 * assigned hazard to resolved and stamps the resolution date; `close` moves any open hazard to closed, stamps the closed date and fills
 * a missing resolution date. Dates come from the server clock and the transition is audited in the same transaction.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { hazardReports } from '@/db/schema';

export const dynamic = 'force-dynamic';

const transitionSchema = z.object({ action: z.enum(['resolve', 'close']) }).strict();

const FROM: Record<'resolve' | 'close', string[]> = {
  resolve: ['reported', 'assessed', 'assigned'],
  close: ['reported', 'assessed', 'assigned', 'resolved'],
};

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    body: transitionSchema,
    openapi: {
      tags: ['Health-safety'],
      summary: 'Resolve or close a hazard report',
      description: 'Moves an open hazard to resolved or closed and records the date.',
    },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');
    const to = body.action === 'resolve' ? 'resolved' : 'closed';

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [changed] = await tx
        .update(hazardReports)
        .set({
          status: to,
          resolutionDate: sql`coalesce(${hazardReports.resolutionDate}, now())`,
          ...(body.action === 'close' ? { closedDate: sql`now()` } : {}),
          updatedAt: sql`now()`,
        })
        .where(and(eq(hazardReports.id, params.id), eq(hazardReports.organizationId, organizationId), inArray(hazardReports.status, FROM[body.action])))
        .returning({ id: hazardReports.id, status: hazardReports.status, resolutionDate: hazardReports.resolutionDate, closedDate: hazardReports.closedDate });

      if (!changed) {
        const [existing] = await tx
          .select({ status: hazardReports.status })
          .from(hazardReports)
          .where(and(eq(hazardReports.id, params.id), eq(hazardReports.organizationId, organizationId)))
          .limit(1);
        if (!existing || existing.status === 'archived') throw ApiError.notFound('Hazard report');
        throw ApiError.conflict(`A hazard that is ${existing.status} cannot be ${to}`);
      }

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'hazard_reports',
        action: `hazard.${body.action}`,
        resourceId: changed.id,
        details: { to },
      });
      return changed;
    });
  },
);
