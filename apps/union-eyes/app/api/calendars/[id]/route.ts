/**
 * CRUD item route for calendars
 *
 * round 53 (FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, CALENDAR_AND_SCHEDULING
 * family): GET is hand-written to 404 a personal calendar that belongs to
 * another org member (previously any 'member' could fetch any org
 * calendar by id regardless of isPersonal/ownerId). PATCH/DELETE keep
 * crud-factory but add lockedAuthCheck to reject the same case on the
 * locked, guaranteed-fresh row (previously any 'steward' could edit/delete
 * another member's personal calendar).
 */
import { and, eq } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { calendars } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Scheduling'], summary: 'Get calendar by ID', description: 'Returns a single calendar record.' },
  },
  async ({ params, organizationId, userId }) => {
    const [row] = await db.select().from(calendars).where(and(eq(calendars.id, params.id), eq(calendars.organizationId, organizationId!)));
    if (!row) throw ApiError.notFound('calendar');
    if (row.isPersonal && row.ownerId !== userId) throw ApiError.notFound('calendar');
    return { data: row };
  },
);

const { PATCH, DELETE } = crudRoutes({
  table: calendars,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  lockedAuthCheck: async (existing, ctx) => {
    if (existing.isPersonal && existing.ownerId !== ctx.userId) {
      return { ok: false, status: 403 };
    }
    return { ok: true };
  },
});
export { PATCH, DELETE };
