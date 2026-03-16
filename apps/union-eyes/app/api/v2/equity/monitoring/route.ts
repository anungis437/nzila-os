/**
 * CRUD collection route for memberSegments
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberSegments } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: memberSegments,
  pk: 'id',
  tags: ["Members"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
