/**
 * CRUD collection route for claims
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { claims } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: claims,
  pk: 'claimId',
  tags: ["Claims"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
