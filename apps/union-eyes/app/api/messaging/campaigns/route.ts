/**
 * CRUD collection route for campaigns
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { campaigns } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: campaigns,
  pk: 'id',
  tags: ['Communications'],
  orgScoped: true,
  readRole: 'member',
  // Deprecated alias of /api/communications/campaigns over the same table: the same author fields; status, send times, delivery
  // statistics and the audience count are never the author's.
  writableFields: ['name', 'description', 'type', 'channel', 'templateId', 'segmentId', 'segmentQuery', 'subject', 'body', 'variables', 'timezone', 'settings', 'metadata', 'tags'],
  writeRole: 'steward',
});
export { GET, POST };
