/**
 * CRUD item route for campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { campaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: campaigns,
  pk: 'id',
  tags: ["Notifications"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  blockedPatchFields: ['status', 'sentAt', 'completedAt', 'scheduledAt', 'sendImmediately', 'stats', 'audienceCount'],
  // The collection's author fields, less the type and channel fixed at create. Status, send times, delivery statistics and the audience
  // count stay blocked: sending is not implemented (UE-ACTION-CAMPAIGN-SEND).
  writableFields: ['name', 'description', 'templateId', 'segmentId', 'segmentQuery', 'subject', 'body', 'variables', 'timezone', 'settings', 'metadata', 'tags'],
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
