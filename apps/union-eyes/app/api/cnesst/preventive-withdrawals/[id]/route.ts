/**
 * Preventive Withdrawals — Item CRUD
 *
 * GET    /api/cnesst/preventive-withdrawals/:id
 * PATCH  /api/cnesst/preventive-withdrawals/:id
 * DELETE /api/cnesst/preventive-withdrawals/:id
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { preventiveWithdrawals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  itemRoute: true,
  readRole: 'steward',
  writeRole: 'steward',
  // The reassignment and withdrawal facts a steward follows up. The member, status, employer-paid days and CNESST IRR amounts are
  // not changed through the generic PATCH.
  writableFields: [
    'reason', 'medicalCertificateDate', 'physicianName', 'reassignmentOffered', 'reassignmentAccepted',
    'reassignmentDescription', 'withdrawalStartDate', 'withdrawalEndDate', 'notes',
  ],
});
export { GET, PATCH, DELETE };
