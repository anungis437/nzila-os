/**
 * CRUD collection route for safetyInspections
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { safetyInspections } from '@/db/schema';
import { issueOrganizationRecordNumber } from '@/lib/records/organization-record-number';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: safetyInspections,
  tags: ["Health-safety"],
  orgScoped: true,
  readRole: 'member',
  writeRole: 'admin',
  // The inspection number is the server's: a body that names one is refused (400), and the next number in this organization's
  // INS-<year>- sequence is issued in the transaction that inserts the row.
  blockedPatchFields: ['inspectionNumber'],
  beforeCreate: async (values, ctx) => ({
    ...values,
    inspectionNumber: await issueOrganizationRecordNumber('inspection', ctx.organizationId),
  }),
});
export { GET, POST };
