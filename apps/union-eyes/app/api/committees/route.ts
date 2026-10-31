/**
 * CRUD collection route for committees
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { committees } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: committees,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  // Internal notes and custom fields are the committee's working record, not a directory entry.
  omitFromResponse: ['notes', 'customFields'],
  writeRole: 'steward',
});
export { GET, POST };
