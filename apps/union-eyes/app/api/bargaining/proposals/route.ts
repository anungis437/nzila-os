/**
 * CRUD collection route for bargainingProposals
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingProposals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: bargainingProposals,
  pk: 'id',
  tags: ["Bargaining"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
