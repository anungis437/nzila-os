/**
 * CRUD collection route for collectiveAgreements
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { collectiveAgreements } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: collectiveAgreements,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
