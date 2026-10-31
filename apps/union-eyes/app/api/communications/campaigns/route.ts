/**
 * CRUD collection route for campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { campaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: campaigns,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  // A campaign's audience, segment query and body are staff working records.
  readRole: 'steward',
  // Status, send times, delivery statistics and the audience count are set by delivery, never by the author's body.
  writableFields: ['name', 'description', 'type', 'channel', 'templateId', 'segmentId', 'segmentQuery', 'subject', 'body', 'variables', 'scheduledAt', 'sendImmediately', 'timezone', 'settings', 'metadata', 'tags'],
  writeRole: 'steward',
});
export { GET, POST };
