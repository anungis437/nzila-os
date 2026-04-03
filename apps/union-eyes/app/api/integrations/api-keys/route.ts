/**
 * CRUD collection route for integrationApiKeys
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { integrationApiKeys } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: integrationApiKeys,
  pk: 'id',
  tags: ["Integrations"],
  orgScoped: true,
  readRole: 'admin',
  writeRole: 'admin',
});
export { GET, POST };
