/**
 * CRUD collection route for auditLogs
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { auditLogs } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: auditLogs,
  pk: 'auditId',
  tags: ["System"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
