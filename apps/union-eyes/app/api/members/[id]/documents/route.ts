/**
 * CRUD item route for documents
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { documents } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: documents,
  pk: 'id',
  tags: ["Content"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  writableFields: ['title', 'category', 'description', 'tags', 'documentType', 'privacyLabel'],
});
export { GET, PATCH, DELETE };
