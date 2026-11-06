/**
 * Anti-Scab Violations — Item
 *
 * GET    /api/cnesst/anti-scab/:id   the violation, to the principal who filed it
 * PATCH  /api/cnesst/anti-scab/:id   by the principal who filed it; the author and the reporter are fixed
 * DELETE /api/cnesst/anti-scab/:id   refused: the record is retained
 *
 * Access fails closed to the author of the record (lib/services/anti-scab-access.ts): a steward role in the organization does not reach another
 * steward's filing. Anyone else gets the same answer as for a record that does not exist.
 */
import { and, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { antiScabViolations, antiScabViolationTypeEnum } from '@/db/schema';
import { antiScabAuthorCondition } from '@/lib/services/anti-scab-access';

export const dynamic = 'force-dynamic';

const { GET, DELETE } = crudRoutes({
  table: antiScabViolations,
  pk: 'id',
  tags: ['CNESST', 'Anti-Scab'],
  orgScoped: true,
  itemRoute: true,
  retainOnDelete: true,
  readRole: 'steward',
  writeRole: 'steward',
  readConditionFor: ({ userId }) => antiScabAuthorCondition(userId),
});

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// What the author may correct or add after filing. Authorship, the reporter and the organization are not here.
const patchSchema = z.object({
  strikeOrLockoutStartDate: isoDate.optional(),
  isStrike: z.boolean().optional(),
  bargainingUnitDescription: z.string().max(5000).nullable().optional(),
  violationType: z.enum(antiScabViolationTypeEnum.enumValues).optional(),
  violationDate: isoDate.optional(),
  description: z.string().min(1).max(20000).optional(),
  descriptionFr: z.string().max(20000).nullable().optional(),
  evidenceSummary: z.string().max(20000).nullable().optional(),
  replacementWorkerCount: z.number().int().nonnegative().nullable().optional(),
  tatComplaintFiled: z.boolean().optional(),
  tatComplaintDate: isoDate.nullable().optional(),
  tatFileNumber: z.string().max(100).nullable().optional(),
  injunctionRequested: z.boolean().optional(),
  // Tribunal outcomes (injunction granted and its date, penalty, resolution), the derived day count and attached documents are
  // not the filer's to set: they are recorded through the matter's own outcome workflow, not this correction route.
}).strict();

const PATCH = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'steward' },
    body: patchSchema,
    openapi: { tags: ['CNESST', 'Anti-Scab'], summary: 'Update an anti-scab violation the caller filed' },
  },
  async ({ body, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden();
    const { id } = params as { id: string };
    const fields = Object.keys(body);
    if (fields.length === 0) throw ApiError.badRequest('No field to update');

    // The change and its audit record commit together; the author condition is part of the update itself.
    return withRLSContext({ organizationId }, async (tx) => {
      const [row] = await tx
        .update(antiScabViolations)
        .set({ ...body, updatedAt: sql`now()` } as never)
        .where(and(eq(antiScabViolations.id, id), eq(antiScabViolations.organizationId, organizationId), antiScabAuthorCondition(userId)))
        .returning();
      if (!row) throw ApiError.notFound('Anti scab violation');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'crud.anti_scab_violations.update',
        resourceType: 'anti_scab_violations',
        resourceId: row.id,
        details: { fields, route: 'anti-scab-author' },
      });
      return { data: row };
    });
  },
);

export { GET, PATCH, DELETE };
