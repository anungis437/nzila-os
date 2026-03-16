/**
 * CRUD collection route for cmsPages
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { cmsPages } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: cmsPages,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
