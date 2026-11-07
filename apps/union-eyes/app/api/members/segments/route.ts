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
  // A segment's definition. Execution counts and times are the server's; isActive/isPublic are not set by any screen.
  writableFields: ['name', 'description', 'filters'],
  writeRole: 'steward',
});
export { GET, POST };
