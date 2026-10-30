/**
 * CRUD collection route for distribution lists
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { newsletterDistributionLists } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: newsletterDistributionLists,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // A distribution list names its audience and carries its filter criteria: staff read it.
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
