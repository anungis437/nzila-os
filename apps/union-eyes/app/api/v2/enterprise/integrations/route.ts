/**
 * CRUD collection route for oauthProviders
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { oauthProviders } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: oauthProviders,
  pk: 'providerId',
  tags: ["Auth"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
});
export { GET, POST };
