const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B52-F03-ORGANIZATION-OWNED-REFERENCES'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'app/api/__tests__/f03-b52-references.contract.test.ts'
  ledger.batches.push({
    id,
    family: 'F03: an id taken from a body must name a row of the caller organization',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B6-EDU-SESSION-COURSE-ID-NOT-VERIFIED-TO-ORGANIZATION',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/education/sessions/route.ts', test],
        explanation: 'The training session create checks that the course is the organization own (shared reference helper, 404 otherwise) and accepts only an allow-list of descriptive fields: registration, waitlist, attendance, completion, rating, evaluation, cost, status and cancellation figures are no longer body-writable. Contract test pins the allow-list and the check.',
      },
      {
        prefix: 'DEF-0B6-EMP-COMMUNICATION-REFERENCES-UNVERIFIED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/employers/communications/route.ts', A + 'app/api/__tests__/employers-communications-atomic-audit.route.test.ts', test],
        explanation: 'Logging an employer communication checks employerId, grievanceId, recipientContactId and templateId against the caller organization before any write (404, nothing written or audited), and the list is limited to 200. The existing route test mock gained the limit step and a new test covers a foreign grievance (disclosed).',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B52 added')
