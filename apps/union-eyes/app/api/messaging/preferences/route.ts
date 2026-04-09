/**
 * CRUD collection route for notification preferences
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { userNotificationPreferences } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: userNotificationPreferences,
  pk: 'id',
  tags: ['Communications'],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'member',
});
export { GET, POST };
