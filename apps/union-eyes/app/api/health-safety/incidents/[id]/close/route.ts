/**
 * POST /api/health-safety/incidents/[id]/close — close an incident and record when it was closed.
 *
 * The generic PATCH may not set a status or a date (the workflow that closes a record does), so this is the route that does: it moves a
 * reported or investigating incident to closed, stamps the closed date and the investigation completion with the server clock, and
 * records the transition in the same transaction. The resolution time the statistics report is measured from these dates.
 */

import { and, eq, inArray, sql } from 'drizzle-orm';
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { workplaceIncidents } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    openapi: {
      tags: ['Health-safety'],
      summary: 'Close a workplace incident',
      description: 'Moves a reported or investigating incident to closed and records the closing date.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Organization context required');

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [closed] = await tx
        .update(workplaceIncidents)
        .set({
          status: 'closed',
          closedDate: sql`now()`,
          investigationCompletedDate: sql`coalesce(${workplaceIncidents.investigationCompletedDate}, now())`,
          updatedAt: sql`now()`,
        })
        .where(
          and(
            eq(workplaceIncidents.id, params.id),
            eq(workplaceIncidents.organizationId, organizationId),
            inArray(workplaceIncidents.status, ['reported', 'investigating']),
          ),
        )
        .returning({ id: workplaceIncidents.id, status: workplaceIncidents.status, closedDate: workplaceIncidents.closedDate });

      if (!closed) {
        const [existing] = await tx
          .select({ status: workplaceIncidents.status })
          .from(workplaceIncidents)
          .where(and(eq(workplaceIncidents.id, params.id), eq(workplaceIncidents.organizationId, organizationId)))
          .limit(1);
        if (!existing || existing.status === 'archived') throw ApiError.notFound('Incident');
        throw ApiError.conflict(`An incident that is ${existing.status} cannot be closed`);
      }

      await persistAtomicAudit(tx, {
        userId,
        organizationId,
        resourceType: 'workplace_incidents',
        action: 'incident.close',
        resourceId: closed.id,
        details: { to: 'closed' },
      });
      return closed;
    });
  },
);
