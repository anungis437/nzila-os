/**
 * CRUD collection route for memberCertifications
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { memberCertifications } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: memberCertifications,
  pk: 'id',
  tags: ["Scheduling"],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
