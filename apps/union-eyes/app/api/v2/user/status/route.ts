/**
 * CRUD collection route for users
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { users } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: users,
  pk: 'userId',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
