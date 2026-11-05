const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B45-F03-CLAUSE-LIBRARY-BODY-AUTHORITY-AND-OWNERSHIP'
if (!ledger.batches.some((x) => x.id === id)) {
  const tests = [A + 'lib/clause-library/__tests__/b45-clause-body.test.ts']
  ledger.batches.push({
    id,
    family: 'F03/F05: the shared clause library validates what it stores, reserves public publishing to an officer, and writes only rows it owns',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED',
        status: 'PARTIAL',
        files: [A + 'lib/clause-library/clause-body.ts', A + 'app/api/clause-library/route.ts', A + 'app/api/clause-library/[id]/route.ts', A + 'app/api/clause-library/[id]/share/route.ts', ...tests],
        explanation: 'Clause create, update and sharing bodies pass a zod schema before anything is stored: text, titles and names are bounded, dates are real calendar days, province is a 2-letter code, ids are ids, sharing levels are the four known ones, grants are at most 200 ids, and unknown fields are dropped. A malformed body is a 400. Existing route tests were adapted: organization and agreement fixtures that were not ids became ids, and handler calls that publish publicly carry an officer role (disclosed).',
        remaining: 'The tag write route still reads its body without the schema.',
      },
      {
        prefix: 'DEF-0B4-CLAUSE-LIBRARY-PUBLISHING-ON-STEWARD-ROLE-TITLE',
        status: 'PARTIAL',
        files: [A + 'lib/clause-library/clause-body.ts', A + 'app/api/clause-library/route.ts', A + 'app/api/clause-library/[id]/route.ts', A + 'app/api/clause-library/[id]/share/route.ts', ...tests],
        explanation: 'Setting a clause to public sharing on create, update or the share route now requires an officer role; a steward, a member or an unresolved role is refused with 403 before any read or write. Narrower scopes stay with the owning steward and keep their federation and congress eligibility checks.',
        remaining: 'The floor is a role title; no mandate-kernel decision names who may publish collective-agreement text.',
      },
      {
        prefix: 'DEF-0B4-CLAUSE-LIBRARY-ORIGINAL-CLAUSE-ID-UNVERIFIED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/clause-library/original-clause.ts', A + 'app/api/clause-library/route.ts', ...tests],
        explanation: 'A cited originalClauseId must be a clause of a collective agreement of the caller own organization (joined through the agreement); a missing or foreign one is a 404 and nothing is inserted. The id must also be well-formed.',
      },
      {
        prefix: 'DEF-0B4-CLAUSE-LIBRARY-COMPARE-WRITES-OTHER-ORGANIZATION-ROWS',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/clause-library/compare/route.ts', ...tests],
        explanation: 'A comparison no longer increments comparisonCount on rows another organization owns: it is a read of those rows and writes only the usage counter of the caller own clauses. The audit stays with the comparing organization.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B45 added')
