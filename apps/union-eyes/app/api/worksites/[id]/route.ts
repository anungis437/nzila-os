/**
 * CRUD item route for worksites
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { employers, worksites } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';

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
  beforeUpdate: async (updates, { organizationId }) => {
    await assertOrganizationOwns([{ field: 'employerId', value: updates.employerId, table: employers }], organizationId);
    return updates;
  },
});
export { GET, PATCH, DELETE };
