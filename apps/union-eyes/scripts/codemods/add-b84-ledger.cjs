const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B84-SMALL-VALIDATION'
const test = A + 'lib/services/__tests__/s28-small-validation-batch.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const find = (prefix) => ledger.batches.flatMap((x) => x.items).find((i) => prefix.startsWith(i.prefix) || i.prefix.startsWith(prefix))
const upgrade = (prefix, files, explanation) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = ST
  delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Small validation and verification items',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B11-PRP-RECONCILIATION-RESOLVE-IS-A-STATUS-AND-NOTE-ONLY-WITH-NO-SECOND-APPROVER-OR-LEDGER-EFFECT',
        status: 'PARTIAL',
        files: [A + 'app/api/reconciliation/resolve/route.ts', test],
        explanation: 'Resolving or writing off an exception now requires a stated reason of at least 10 characters after trimming (an empty string was accepted), on top of the live financial mandate and the admin floor the route already required.',
        remaining: 'A second approver and any ledger effect of a write-off are not implemented: they are finance workflow decisions that sit under the finance freeze.',
      },
    ],
  })
}

upgrade(
  'DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT',
  [A + 'app/api/location/consent/route.ts'],
  'B84: the context query parameter is one of strike or event, and anything else is refused (400) rather than reflected.',
)
// This item keeps its earlier remaining note: the stored status of an expired consent is a separate sweep needing a system-role privilege.
find('DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT').status = 'PARTIAL'
find('DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES-THE-CONSENT-AS-A-SIDE-EFFECT').remaining = 'The stored status of an expired consent never becomes expired: a sweep needs the system role to hold UPDATE on member_location_consent, which the storage-authority manifest and the location-retention ratchets do not grant.'

upgrade(
  'DEF-0B11-PRP-DUES-PAY-GET-RETURNS-EVERY-LEDGER-ENTRY-TYPE-AS-PAYMENTS-AND-OMITS-PENDING-ATTEMPTS',
  [A + 'app/api/portal/dues/pay/route.ts'],
  'Verified in source: the GET also returns a separate bounded attempt history read from dues_transactions (pending, failed and cancelled attempts), kept apart from the posted payments.',
)
upgrade(
  'DEF-0B12-PLT-WORKSPACE-TELEMETRY-LOGS-UNBOUNDED-CLIENT-STRINGS-AND-HAS-NO-LIMIT',
  [A + 'app/api/workspace/telemetry/route.ts'],
  'Verified in source: the route has its own per-user rate limit (120 a minute, refusing when the limiter is unavailable) and logs only the allow-listed event, tab and static route with a server-set timestamp.',
)

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B84 added')
