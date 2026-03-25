/**
 * CRUD item route for pilot applications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { pilotApplications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: pilotApplications,
  pk: 'id',
  tags: ["Marketing"],
  orgScoped: false,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
