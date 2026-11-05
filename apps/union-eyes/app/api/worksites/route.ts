/**
 * CRUD collection route for worksites
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { employers, worksites } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: worksites,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  // The site manager's name, e-mail and telephone, the notes and the custom fields are working records, not a directory entry.
  omitFromResponse: ['siteManagerName', 'siteManagerEmail', 'siteManagerPhone', 'notes', 'customFields'],
  writeRole: 'steward',
  beforeCreate: async (values, { organizationId }) => {
    await assertOrganizationOwns([{ field: 'employerId', value: values.employerId, table: employers }], organizationId);
    return values;
  },
});
export { GET, POST };
