/**
 * Preventive Withdrawals — Item CRUD
 *
 * GET    /api/cnesst/preventive-withdrawals/:id
 * PATCH  /api/cnesst/preventive-withdrawals/:id
 * DELETE /api/cnesst/preventive-withdrawals/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { preventiveWithdrawals } from '@/db/schema';
import { linkedOhsRecordLockedAuthCheck, linkedOhsRecordRowReadable } from '@/lib/services/ohs-case-access';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
  // A steward reads or changes a withdrawal only when case authority reaches its member, directly or through its linked filing (DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY); otherwise it answers 404.
  rowReadAuthority: linkedOhsRecordRowReadable,
  lockedAuthCheck: linkedOhsRecordLockedAuthCheck,
  // The reassignment and withdrawal facts a steward follows up. The member, status, employer-paid days and CNESST IRR amounts are
  // not changed through the generic PATCH.
  writableFields: [
    'reason', 'medicalCertificateDate', 'physicianName', 'reassignmentOffered', 'reassignmentAccepted',
    'reassignmentDescription', 'withdrawalStartDate', 'withdrawalEndDate', 'notes',
  ],
});
export { GET, PATCH, DELETE };
