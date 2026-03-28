/**
 * CRUD collection route for surveys
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { surveys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: surveys,
  pk: 'id',
  tags: ["Surveys"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
