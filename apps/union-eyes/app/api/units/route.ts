/**
 * CRUD collection route for bargainingUnits
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingUnits } from '@/db/schema';

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
  writableFields: ['employerId', 'worksiteId', 'name', 'unitNumber', 'unitType', 'classifications', 'title', 'description', 'contractExpiryDate', 'nextBargainingDate'],
});
export { GET, POST };
