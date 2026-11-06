/**
 * CRUD item route for bargainingUnits
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingUnits, employers, worksites } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { UNIT_WRITABLE_FIELDS } from '@/lib/union-structure/unit-writable-fields';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: bargainingUnits,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  omitFromResponse: ['notes', 'customFields'],
  beforeUpdate: async (updates, { organizationId }) => {
    await assertOrganizationOwns([
      { field: 'employerId', value: updates.employerId, table: employers },
      { field: 'worksiteId', value: updates.worksiteId, table: worksites },
    ], organizationId);
    return updates;
  },
  // Certification, representation and lifecycle facts come from the certification and the roster, not from a steward's body.
  // The same fields the form sends on create; everything else, including the blocked facts below, is refused.
  writableFields: UNIT_WRITABLE_FIELDS,
  blockedPatchFields: ['certificationNumber', 'certificationDate', 'certificationBody', 'certificationExpiryDate', 'currentCollectiveAgreementId', 'chiefStewardId', 'bargainingChairId', 'status', 'memberCount', 'archivedAt'],
});
export { GET, PATCH, DELETE };
