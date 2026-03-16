/**
 * CRUD item route for bargainingProposals
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingProposals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: bargainingProposals,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
