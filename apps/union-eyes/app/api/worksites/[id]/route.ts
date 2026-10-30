/**
 * CRUD item route for worksites
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { worksites } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: worksites,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  // The site manager's name, e-mail and telephone, the notes and the custom fields are working records, not a directory entry.
  omitFromResponse: ['siteManagerName', 'siteManagerEmail', 'siteManagerPhone', 'notes', 'customFields'],
  writeRole: 'steward',
});
export { GET, PATCH, DELETE };
