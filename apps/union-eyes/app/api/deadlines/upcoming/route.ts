/**
 * GET /api/deadlines/upcoming
 * The organization's pending deadlines that fall due within the next 30 days, soonest first. (It used to be the whole deadline collection under another name,
 * and its POST created a deadline: creation is POST /api/deadlines.)
 */
import { and, eq, gte, lt, sql } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { deadlines } from '@/db/schema';

export const dynamic = 'force-dynamic';

const crud = crudRoutes({
  table: deadlines,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  readCondition: and(eq(deadlines.status, 'pending'), gte(deadlines.dueDate, sql`now()`), lt(deadlines.dueDate, sql`now() + interval '30 days'`))!,
  orderBy: 'dueDate',
  orderDirection: 'asc',
});

export const GET = crud.GET;
