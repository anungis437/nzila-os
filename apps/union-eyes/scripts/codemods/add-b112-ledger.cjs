const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
addBatch({
  id: 'B112-F06-R1-ICRA-OWNERSHIP-AND-CAPABILITY-REVOCATION',
  family: 'F06 R1: a claimed ICRA assessment belongs to its organization and its bearer link is withdrawn',
  test: A + 'lib/services/__tests__/s53-f06-r1-icra-claim-capability.test.ts',
  previousEvidence: { 'B111-F06-A5-REPORT-SMALL-GROUP-SUPPRESSION': 'b15818963' },
  items: [
    {
      prefix: 'DEF-0B8-ICRA-CLAIM-BINDS-TO-ANY-SIGNED-IN-USER',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: [
        A + 'lib/icra/assessment-access.ts',
        A + 'lib/icra/assessment-capability.ts',
        A + 'app/api/icra/[assessmentId]/claim/route.ts',
        A + 'app/api/icra/[assessmentId]/capability/exchange/route.ts',
        A + 'app/api/icra/[assessmentId]/profile/route.ts',
        A + 'app/api/icra/[assessmentId]/answer/route.ts',
        A + 'app/api/icra/[assessmentId]/submit/route.ts',
        A + 'app/api/icra/results/[id]/route.ts',
        A + 'app/api/icra/report/[assessmentId]/route.ts',
        A + 'app/api/icra/checkout/route.ts',
        A + 'app/api/icra/start/route.ts',
        A + 'app/api/icra/email-results/route.ts',
        A + 'actions/icra/get-profile.ts',
        A + 'actions/icra/get-adaptive-resolution.ts',
        A + 'lib/icra/__tests__/assessment-access.test.ts',
        A + 'lib/icra/__tests__/assessment-capability-contract.test.ts',
        A + 'db/__tests__/icra-claim-capability-revocation.postgres.test.ts',
      ],
      explanation: 'The claim write also clears the stored capability hash and expiry in the same conditional update that decides the winner, and the claiming browser\'s cookie is cleared. One gate, authorizeAssessmentAccess, now decides every capability-bearing path (profile, answer, submit, results, report, checkout, resume, and the profile and adaptive-resolution actions the results page uses): an unclaimed assessment keeps pseudonymous capability access, while a claimed one ignores the capability even if a hash survived and admits only the claiming account while it is still a member of the claiming organization, or an administrator of that organization. A plain peer, another organization\'s administrator and an anonymous holder of the old link are refused (403/401). A claimed assessment cannot mint a new capability cookie and its link cannot be mailed. The ICRA capability ratchet recognizes the new gate. Proven natively on PostgreSQL 15 and 16: six concurrent claimants yield exactly one winner, the capability is gone from the row, and refused claims leave the capability intact.',
    },
  ],
})
