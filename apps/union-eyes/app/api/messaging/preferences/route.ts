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
  // Deprecated (canonical: /api/notifications/preferences). The route has no owner column, so a body could name any user's preferences:
  // it accepts no field and the canonical route is the writer.
  writableFields: [],
  writeRole: 'member',
});
export { GET, POST };
