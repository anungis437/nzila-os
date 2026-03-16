/**
 * CRUD collection route for tentativeAgreements
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { tentativeAgreements } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: tentativeAgreements,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
