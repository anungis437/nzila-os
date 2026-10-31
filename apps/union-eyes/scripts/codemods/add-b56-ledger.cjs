const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B56-F12-CONTENT-PUBLISH-AND-REGISTRATION-RULES'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/b56-content-registration.test.ts'
  ledger.batches.push({
    id,
    family: 'F12: publication needs a second person, and registration follows the session window and capacity',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B6-EDU-CONTENT-PUBLISH-NO-SEPARATION-OF-DUTIES',
        status: 'PARTIAL',
        files: [A + 'app/api/content/templates/[id]/status/route.ts', A + 'app/api/__tests__/content-template-status.route.test.ts', test],
        explanation: 'Moving an item from review to published is refused for the person who last changed it (who moved it to review), and republishing no longer rewrites the first publication time (coalesce). Existing status route tests pass.',
        remaining: 'The row records only its last editor, not a separate submitter; a submitted_by column is the proper fix.',
      },
      {
        prefix: 'DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK',
        status: 'PARTIAL',
        files: [A + 'app/api/education/registrations/route.ts', A + 'app/api/education/registrations/__tests__/route.test.ts', test],
        explanation: 'Registration is refused (409) for a session that is not scheduled, outside its registration window, or at its maximum enrollment (counted from registered rows). The session-belongs-to-course and duplicate checks already existed. The route test mock gained the count helper and new cases for closed, not-yet-open, cancelled and full sessions (disclosed).',
        remaining: 'The capacity count is read then written, so two simultaneous registrations for the last place can both pass; a transactional lock or counter is still needed.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B56 added')
