/**
 * GET /api/deadlines/overdue
 * The organization's pending deadlines that are past their due date, oldest first. (It used to be the whole deadline collection under another name,
 * and its POST created a deadline: creation is POST /api/deadlines.)
 */
import { and, eq, lt, sql } from 'drizzle-orm';
import { crudRoutes } from '@/lib/api/crud-factory';
import { deadlines } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET } = crudRoutes({
  table: deadlines,
  pk: 'id',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  readCondition: and(eq(deadlines.status, 'pending'), lt(deadlines.dueDate, sql`now()`))!,
  orderBy: 'dueDate',
  orderDirection: 'asc',
});
export { GET };
