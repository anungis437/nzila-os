/**
 * CRUD collection route for message templates
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { sql } from 'drizzle-orm';
import { messageTemplates } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: messageTemplates,
  pk: 'id',
  tags: ["Communications"],
  orgScoped: true,
  // An archived row is not listed.
  readCondition: sql`${messageTemplates.isActive} IS NOT FALSE`,
  readRole: 'member',
  writeRole: 'steward',
});
export { GET, POST };
