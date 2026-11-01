import { kpiConfigurations } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { withApi, ApiError, z } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

export const dynamic = 'force-dynamic';

export const PATCH = withApi(
  {
    auth: { minRole: 'officer' },
    body: z.object({
      isActive: z.boolean(),
    }),
  },
  async ({ body, organizationId, userId, params }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const { id } = params;
    // Reject malformed identifiers before constructing the UUID database predicate.
    // An invalid target reference is client input, not a database outage.
    if (!z.guid().safeParse(id).success) throw ApiError.badRequest('Invalid target id');

    return withRLSContext({ organizationId }, async (tx) => {
      const [updated] = await tx
        .update(kpiConfigurations)
        .set({
          isActive: body.isActive,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(kpiConfigurations.id, id),
            eq(kpiConfigurations.organizationId, organizationId),
          ),
        )
        .returning();

      if (!updated) {
        throw ApiError.notFound('Target');
      }

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: body.isActive ? 'target.activate' : 'target.deactivate',
        resourceType: 'kpi_configurations',
        resourceId: id,
        details: { isActive: body.isActive },
      });
      return updated;
    });
  },
);
