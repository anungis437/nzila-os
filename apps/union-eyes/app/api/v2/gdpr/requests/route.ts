/**
 * CRUD collection route for dataSubjectAccessRequests
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { dataSubjectAccessRequests } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: dataSubjectAccessRequests,
  pk: 'id',
  tags: ["Compliance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
