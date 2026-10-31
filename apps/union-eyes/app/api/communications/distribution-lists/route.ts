/**
 * CRUD collection route for distribution lists
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { sql } from 'drizzle-orm';
import { newsletterDistributionLists } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: newsletterDistributionLists,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // An archived row is not listed.
  readCondition: sql`${newsletterDistributionLists.isActive} IS NOT FALSE`,
  // A distribution list names its audience and carries its filter criteria: staff read it.
  readRole: 'steward',
  writeRole: 'steward',
});
export { GET, POST };
