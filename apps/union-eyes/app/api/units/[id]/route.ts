/**
 * CRUD item route for bargainingUnits
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { bargainingUnits } from '@/db/schema';

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
  // Certification, representation and lifecycle facts come from the certification and the roster, not from a steward's body.
  blockedPatchFields: ['certificationNumber', 'certificationDate', 'certificationBody', 'certificationExpiryDate', 'currentCollectiveAgreementId', 'chiefStewardId', 'bargainingChairId', 'status', 'memberCount', 'archivedAt'],
});
export { GET, PATCH, DELETE };
