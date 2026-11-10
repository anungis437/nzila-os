/**
 * POST /api/cnesst/pay-equity/:id/transition — move a pay equity exercise one step through its lifecycle (officer+).
 *
 * The only writer of the exercise status and of the facts each step records (lib/pay-equity/pay-equity-lifecycle.ts). The row is locked, the
 * step is checked against the status it holds, and the change commits with its audit record, which keeps the step, the facts and, for a
 * deadline, the unconfirmed rule's proposal beside the date the officer stated. DEF-0B5-PAY-EQUITY-NO-STATE-MACHINE-OR-DEADLINES.
 */
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { payEquityExercises, payEquityStatusEnum } from '@/db/schema';
import { planTransition, type PayEquityStatus } from '@/lib/pay-equity/pay-equity-lifecycle';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A real calendar day: the shape, and a date that exists (2026-02-31 is refused). */
const isoDay = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Not a calendar date');

const transitionSchema = z.object({
  to: z.enum(payEquityStatusEnum.enumValues),
  committeeFormationDate: isoDay.optional(),
  totalAdjustmentAmount: z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'A non-negative amount with at most two decimals').optional(),
  resultsPostedDate: isoDay.optional(),
  contestDeadline: isoDay.optional(),
  contestedOn: isoDay.optional(),
  adjustmentsPaidDate: isoDay.optional(),
  nextMaintenanceDue: isoDay.optional(),
  maintenanceEvaluationDate: isoDay.optional(),
  reason: z.string().trim().max(2000).optional(),
}).strict();

export const POST = withApi(
  {
    rlsOrgContext: true,
    auth: { required: true, minRole: 'officer' },
    body: transitionSchema,
    openapi: { tags: ['CNESST', 'Pay Equity'], summary: 'Move a pay equity exercise one step through its lifecycle' },
  },
  async ({ body, params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden();
    const { id } = params as { id: string };
    if (typeof id !== 'string' || !UUID.test(id)) throw ApiError.badRequest('Invalid pay equity exercise id');
    const { to, ...facts } = body;

    return withRLSContext({ organizationId, userId }, async (tx) => {
      const scope = and(eq(payEquityExercises.id, id), eq(payEquityExercises.organizationId, organizationId));
      const [current] = await tx.select().from(payEquityExercises).where(scope).limit(1).for('update');
      if (!current) throw ApiError.notFound('Pay equity exercise not found');

      const from = current.status as PayEquityStatus;
      const plan = planTransition({
        status: from,
        resultsPostedDate: current.resultsPostedDate ?? null,
        contestDeadline: current.contestDeadline ?? null,
        adjustmentsPaidDate: current.adjustmentsPaidDate ?? null,
        maintenanceEvaluationDate: current.maintenanceEvaluationDate ?? null,
      }, to, facts);
      if (!plan.ok) throw plan.status === 409 ? ApiError.conflict(plan.message) : ApiError.badRequest(plan.message);

      // The status predicate makes the step and the status it was decided from one fact, whatever else ran in between.
      const [row] = await tx
        .update(payEquityExercises)
        .set({ ...plan.set, status: to, updatedAt: new Date() } as never)
        .where(and(
          eq(payEquityExercises.id, id),
          eq(payEquityExercises.organizationId, organizationId),
          eq(payEquityExercises.status, from),
        ))
        .returning();
      if (!row) throw ApiError.conflict('The exercise changed while this step was being recorded');

      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pay_equity.transition',
        resourceType: 'pay_equity_exercises',
        resourceId: row.id,
        details: {
          from,
          to,
          fields: Object.keys(plan.set),
          ...(facts.reason ? { reason: facts.reason } : {}),
          deadlines: plan.deadlines,
        },
      });
      return { data: row, deadlines: plan.deadlines };
    });
  },
);
