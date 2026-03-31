/**
 * Member Breaks — Collection CRUD
 *
 * GET  /api/breaks — list break records for the org
 * POST /api/breaks — record a new break occurrence (member+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberBreaks } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: memberBreaks,
  pk: 'id',
  tags: ["Breaks"],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'member',
});
export { GET, POST };
