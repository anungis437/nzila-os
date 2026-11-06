/**
 * CRUD collection route for ppeEquipment
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { ppeEquipment } from '@/db/schema';
import { issueOrganizationRecordNumber } from '@/lib/records/organization-record-number';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: ppeEquipment,
  tags: ["Health-safety"],
  orgScoped: true,
  // The issuance columns name the member who holds each item.
  readRole: 'health_safety_rep',
  writeRole: 'admin',
  // The item number is the server's: a body that names one is refused (400), and the next number in this organization's PPE-
  // sequence is issued in the transaction that inserts the row.
  blockedPatchFields: ['itemNumber'],
  beforeCreate: async (values, ctx) => ({
    ...values,
    itemNumber: await issueOrganizationRecordNumber('ppe', ctx.organizationId),
  }),
});
export { GET, POST };
