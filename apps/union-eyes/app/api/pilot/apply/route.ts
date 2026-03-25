/**
 * CRUD collection route for pilot applications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: pilotApplications,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  readRole: 'steward',
  writeRole: 'member',
});
export { GET, POST };
