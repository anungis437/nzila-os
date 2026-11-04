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
  // Status, send times (sent, completed, scheduled), the send-now instruction, delivery statistics and the audience count are set by delivery, never by the author's
  // body: sending is not implemented (UE-ACTION-CAMPAIGN-SEND), so a body that scheduled or sent a campaign would be accepted and never honoured.
  writableFields: ['name', 'description', 'type', 'channel', 'templateId', 'segmentId', 'segmentQuery', 'subject', 'body', 'variables', 'timezone', 'settings', 'metadata', 'tags'],
  writeRole: 'steward',
});
export { GET, POST };
