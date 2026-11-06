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
import { assertOhsCaseAccessForCreate, linkedOhsRecordRowReadable } from '@/lib/services/ohs-case-access';

export const dynamic = 'force-dynamic';

const { GET, POST } = crudRoutes({
  table: preventiveWithdrawals,
  pk: 'id',
  tags: ['CNESST', 'Preventive Withdrawal'],
  orgScoped: true,
  readRole: 'steward',
  writeRole: 'steward',
  // A steward reads a withdrawal only when case authority reaches its member, directly or through the filing it is linked to (DEF-0B5-OHS-WITHDRAWAL-REFUSAL-NO-CASE-AUTHORITY).
  rowReadAuthority: linkedOhsRecordRowReadable,
  // Recording a withdrawal for a member a steward holds no case authority over is refused before any row is inserted.
  beforeCreate: async (values, { organizationId, userId }) => {
    await assertOhsCaseAccessForCreate({ organizationId, actorUserId: userId, memberId: values.memberId, linkedCneesstFilingId: values.cneesstFilingId });
    return values;
  },
  // The member's request as a steward records it, and the filing it arose from when there is one (the source of its own
  // case authority for a steward outside the ordinary coverage, see ohs-case-access.ts). Status, employer-paid days and
  // CNESST IRR amounts are not create fields. memberId is required by the table (not checked against the organization's roster here).
  writableFields: [
    'memberId', 'memberName', 'reason', 'requestDate', 'medicalCertificateDate', 'physicianName', 'notes', 'cneesstFilingId',
  ],
});
export { GET, POST };
