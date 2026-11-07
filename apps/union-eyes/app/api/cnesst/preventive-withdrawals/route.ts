/**
 * Preventive Withdrawals — Collection CRUD
 *
 * LSST art. 40–48: retrait préventif (pregnancy / breastfeeding / hazardous)
 *
 * GET  /api/cnesst/preventive-withdrawals — list for the org
 * POST /api/cnesst/preventive-withdrawals — record a new withdrawal (steward+)
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { preventiveWithdrawals } from '@/db/schema';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  // The member's request as a steward records it. Status, employer-paid days, CNESST IRR amounts and the link to a filing are
  // not create fields. memberId is required by the table (not checked against the organization's roster here).
  writableFields: [
    'memberId', 'memberName', 'reason', 'requestDate', 'medicalCertificateDate', 'physicianName', 'notes',
  ],
});
export { GET, POST };
