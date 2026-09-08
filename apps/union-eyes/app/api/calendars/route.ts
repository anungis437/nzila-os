/**
 * CRUD collection route for calendars
 *
 * round 53 (FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, CALENDAR_AND_SCHEDULING
 * family): calendars.isPersonal + calendars.ownerId exist precisely to
 * distinguish a caller's own private calendar from an org-shared one, but
 * the generic crud-factory only understands org-wide scoping — it has no
 * primitive for "visible if shared OR mine". GET is therefore hand-written
 * to filter out other members' personal calendars (previously any 'member'
 * could list every other member's personal calendar in the org). POST
 * keeps crud-factory but forces ownerId to the caller's own id via
 * beforeCreate — ownerId has no dedicated auto-set path in crud-factory
 * (only a column literally named createdBy is auto-set), so it was
 * previously a fully client-controllable field on create.
 */
import { and, asc, eq, or } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { calendars } from '@/db/schema';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Scheduling'], summary: 'List calendars', description: 'Returns calendars visible to the caller: shared/org calendars plus the caller\'s own personal calendars.' },
  },
  async ({ organizationId, userId }) => {
    const conditions = [eq(calendars.organizationId, organizationId!)];
    conditions.push(userId ? or(eq(calendars.isPersonal, false), eq(calendars.ownerId, userId))! : eq(calendars.isPersonal, false));

    const rows = await db.select().from(calendars).where(and(...conditions)).orderBy(asc(calendars.name));
    return { data: rows };
  },
);

const { POST } = crudRoutes({
  table: calendars,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  beforeCreate: (values, ctx) => ({ ...values, ownerId: ctx.userId }),
});
export { POST };
