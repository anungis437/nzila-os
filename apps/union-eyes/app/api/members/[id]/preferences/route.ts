/**
 * CRUD item route for communicationPreferences
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { communicationPreferences } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: communicationPreferences,
  pk: 'id',
  tags: ["Auth"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  // No screen calls this route. Channel and category toggles, frequency and quiet hours; the member is fixed, and the unsubscribe
  // record (globallyUnsubscribed, unsubscribedAt, unsubscribeReason) is the member's own CASL choice, never a steward's.
  writableFields: ['emailEnabled', 'smsEnabled', 'pushEnabled', 'phoneEnabled', 'mailEnabled', 'categories', 'frequency', 'quietHours'],
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
