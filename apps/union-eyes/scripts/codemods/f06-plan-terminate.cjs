const fs = require('fs')
const f = 'app/api/pension/plans/[id]/route.ts'
let s = fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')
const start = s.indexOf('export const DELETE = withApi(')
if (start < 0) throw new Error('no DELETE')
s = s.slice(0, start) + `/**
 * DELETE ends a plan; it does not remove the row. A plan carries enrolments, contributions and benefit claims, so deleting it would
 * orphan or cascade that history. The plan is marked terminated, with the time, and stays readable to the administrators; a plan
 * that is already terminated answers 409.
 */
export const DELETE = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Terminate pension plan', description: 'Marks a pension plan terminated; the record and its history are kept' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    return withRLSContext({ organizationId }, async (tx) => {
      const [plan] = await tx
        .update(pensionPlans)
        .set({ status: 'terminated', updatedAt: new Date() })
        .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId), ne(pensionPlans.status, 'terminated')))
        .returning();
      if (!plan) {
        const [existing] = await tx
          .select({ id: pensionPlans.id })
          .from(pensionPlans)
          .where(and(eq(pensionPlans.id, id), eq(pensionPlans.organizationId, organizationId)))
          .limit(1);
        if (!existing) throw ApiError.notFound('Pension plan');
        throw ApiError.conflict('The pension plan is already terminated');
      }
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.plan.terminate',
        resourceType: 'pension_plans',
        resourceId: id,
        details: { planName: plan.planName },
      });
      return plan;
    });
  },
);
`
s = s.replace("import { eq, and } from 'drizzle-orm';", "import { eq, and, ne } from 'drizzle-orm';")
fs.writeFileSync(f, s)
console.log('ok')
