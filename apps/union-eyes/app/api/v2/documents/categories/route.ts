/**
 * CRUD collection route for documents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { documents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: documents,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
