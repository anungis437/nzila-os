/**
 * CRUD collection route for cmsMediaLibrary
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cmsMediaLibrary } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: cmsMediaLibrary,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
