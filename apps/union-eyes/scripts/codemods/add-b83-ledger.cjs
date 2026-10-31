const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B83-COGNITION-CASE-AUTHORITY'
const test = A + 'lib/services/__tests__/s27-cognition-case-authority.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const find = (prefix) => ledger.batches.flatMap((x) => x.items).find((i) => i.prefix.startsWith(prefix))
const item = (prefix, files, explanation) => ({ prefix, status: ST, files: [...files, test], explanation })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Cognition reads follow the case authority',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B5-COGNITION-ANY-STEWARD-SCORES-ANY-CASE',
        [A + 'lib/cognition/case-visibility.ts', A + 'app/api/cognition/cases/[id]/risk/route.ts', A + 'app/api/cognition/precedents/route.ts'],
        'The risk score is computed only for a case the authority kernel lets the caller read (case:read_internal, the decision the case routes use); any other case answers 404. The precedent search requires the searched case to be readable, validates the case ids (at most 50 candidates) and compares only candidates the caller may read, so it never returns the title of a case the steward does not hold.',
      ),
      item(
        'DEF-0B5-COGNITION-WORKLOAD-BURNOUT-VISIBLE-TO-PEERS',
        [A + 'app/api/cognition/workload/route.ts'],
        'The workload route, which returns each steward\'s burnout signal, utilization and recommended reassignments, is at the officer floor instead of the steward floor, so a steward no longer reads a colleague\'s burnout signal.',
      ),
    ],
  })
}

const cal = find('DEF-0B3-CALENDAR-DISCONNECT-ADMIN-FLOOR-NO-REVOKE')
if (cal) {
  cal.status = 'PARTIAL'
  cal.files = [...new Set([...(cal.files || []), A + 'app/api/calendar-sync/connections/[id]/route.ts', test])]
  cal.explanation = 'A member disconnects their own calendar (member floor, own connection only, audited in the same transaction), and the response states providerRevocationVerified false.'
  cal.remaining = 'The delete removes the local credentials without revoking the grant at Google or Microsoft: a provider revocation call needs the provider integration and is not made.'
}
const opl = find('DEF-0B10-OPL-04')
if (opl) {
  opl.status = 'PARTIAL'
  opl.files = [...new Set([...(opl.files || []), A + 'app/api/organizations/route.ts', test])]
  opl.explanation = 'The create handler stores description, province_territory, charter number and affiliation date in their columns, refuses a value of the wrong shape, and reads the parent under three field names.'
  opl.remaining = 'The hierarchy admin component still offers organization types (international, national, local_union, chapter) the handler refuses with 400 and tests data.success, which the handler never returns; mapping its vocabulary to the canonical types needs a product decision on what each legacy label means.'
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B83 added')
