/**
 * CRUD item route for worksites
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { employers, worksites } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { ApiError } from '@/lib/api/errors';

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
    if (updates.status === 'archived') throw ApiError.badRequest('A worksite is archived by deleting it, not by setting its status');
    await assertOrganizationOwns([{ field: 'employerId', value: updates.employerId, table: employers }], organizationId);
    return updates;
  },
  // What WorksiteManagement's form sends (toWorksitePayload). status is the site's operating state, chosen on that form and
  // governed by no workflow; 'archived' is refused here because archiving is the administrator's DELETE. Site manager contact,
  // counts, notes and custom fields are not sent by any screen.
  writableFields: [
    'employerId', 'name', 'code', 'status', 'employeeCount', 'address',
  ],
});
export { GET, PATCH, DELETE };
