/**
 * CRUD collection route for consentRecords
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { consentRecords } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: consentRecords,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
