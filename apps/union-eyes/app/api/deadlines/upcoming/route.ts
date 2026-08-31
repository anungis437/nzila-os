/**
 * CRUD collection route for deadlines
 */
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
});

export const GET = crud.GET;
export const POST = crud.POST;
