/**
 * CRUD collection route for externalInvoices
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { externalInvoices } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: externalInvoices,
  pk: 'id',
  tags: ["Finance"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
