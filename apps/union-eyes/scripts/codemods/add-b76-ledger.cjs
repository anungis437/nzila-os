const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B76-PILOT-EMPLOYER-CONTRACT'
const test = A + 'lib/services/__tests__/s20-pilot-employer-contract.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation) => ({ prefix, status: ST, files: [...files, test], explanation })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Pilot telemetry authority, employer read exposure, contract input',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B10-PIL-USAGE-EVENTS-ARE-CALLER-ASSERTED',
        [A + 'app/api/pilot/events/route.ts', A + 'app/api/pilot/__tests__/pilot-events-authority.route.test.ts'],
        'A browser may report only usage signals (login, session, active_user, feature_used, user_action, case_viewed). case_created and update_added are accepted only for a claim that exists in the caller organization; every other type records something a server route does and is refused (400), so a member can no longer make an organization appear to hold champions or be conversion-ready without filing a case. The session id bound now matches the column (100). The existing events test was extended (disclosed): it mocks the claim lookup and the tenant context.',
      ),
      item(
        'DEF-0B6-EMP-COMMUNICATION-GRIEVANCE-CORRESPONDENCE-STEWARD-READ',
        [A + 'app/api/employers/communications/route.ts', A + 'app/api/__tests__/employers-read-exposure.route.test.ts'],
        'Correspondence linked to a grievance is returned only when the case authority (kernelCaseAccess canViewCase) lets the caller see that case; unlinked records stay visible to stewards. The list stays bounded at 200 and each read is audited in the same transaction with the count returned and withheld.',
      ),
      item(
        'DEF-0B6-EMP-CONTACT-PII-READ-AT-STEWARD-UNAUDITED',
        [A + 'app/api/employers/communications/contacts/route.ts', A + 'app/api/__tests__/employers-read-exposure.route.test.ts', A + 'app/api/__tests__/f03-b52-references.contract.test.ts'],
        'The contact list is bounded to 200 and every read is audited in the same transaction with counts only (no names or addresses in the audit record). The f03-b52 pin that looked for the literal .limit(200) now looks for the LIST_LIMIT constant and its value (disclosed).',
      ),
      item(
        'DEF-0B6-CMP-DISPATCH-ASSIGN-NO-STATE-OR-FILL-CHECK',
        [A + 'app/api/dispatch/assign/route.ts', A + 'lib/services/dispatch-engine.ts'],
        'Verified in source: assignment refuses a request that is not open or partially filled, a worker already offered or placed, a worker who is not an active member, and more workers than the request still needs; filled is derived from the live assignments plus the new ones.',
      ),
    ],
  })
}
// Earlier partials are upgraded where they sit, never listed twice.
const upgrade = (prefix, files, explanation) => {
  const found = ledger.batches.flatMap((x) => x.items).find((i) => i.prefix.startsWith(prefix))
  if (!found) throw new Error('not found ' + prefix)
  found.status = ST
  delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}
upgrade('DEF-0B6-CMP-CONTRACT-CREATE-REFERENCES-UNVERIFIED', [A + 'app/api/contracts/route.ts', A + 'lib/contracts/contract-input.ts'], 'B76: amounts are decimals with at most two places, the expiry must follow the effective date, a line total must equal unit price times quantity, a stated total that disagrees with the priced lines is refused, and the line count (100) and text lengths are bounded.')
upgrade('DEF-0B10-PIL-USAGE-TELEMETRY-ROUTES-READ-ANY-ORGANIZATION', ['app/api/pilot/champions/route.ts', 'app/api/pilot/friction/route.ts', 'app/api/pilot/metrics/route.ts', 'app/api/pilot/readiness/route.ts'].map((f) => A + f), 'B76: the services no longer run on the bare handle: each read runs inside the tenant context of the session organization, so the row-level policy applies as a second boundary.')
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B76 added')
