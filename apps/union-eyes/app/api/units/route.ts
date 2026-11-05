/**
 * CRUD collection route for bargainingUnits
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingUnits, employers, worksites } from '@/db/schema';
import { assertOrganizationOwns } from '@/lib/api/org-references';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: bargainingUnits,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'steward',
  // Working notes and custom fields are not part of the unit's public record.
  omitFromResponse: ['notes', 'customFields'],
  // Certification, representation and lifecycle facts come from the certification and the roster, not from a steward's body.
  // The employer and the worksite must be the caller's own organization's.
  beforeCreate: async (values, { organizationId }) => {
    await assertOrganizationOwns([
      { field: 'employerId', value: values.employerId, table: employers },
      { field: 'worksiteId', value: values.worksiteId, table: worksites },
    ], organizationId);
    return values;
  },
  writableFields: ['employerId', 'worksiteId', 'name', 'unitNumber', 'unitType', 'classifications', 'title', 'description', 'contractExpiryDate', 'nextBargainingDate'],
});
export { GET, POST };
