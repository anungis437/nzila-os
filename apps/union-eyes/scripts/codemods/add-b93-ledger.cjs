const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B93-DASHBOARD-MEASURES-KEYS-ARCHIVE'
const test = A + 'lib/services/__tests__/s37-dashboard-measures-keys-archive.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const fresh = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })
const upgrade = (prefix, status, files, explanation, remaining) => {
  const found = find(prefix)
  if (!found) throw new Error('not found ' + prefix)
  found.status = status
  if (remaining) found.remaining = remaining
  else delete found.remaining
  found.files = [...new Set([...(found.files || []), ...files, test])]
  if (!found.explanation.includes(explanation)) found.explanation += ' ' + explanation
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Health-safety dashboard measures, dedicated queue key, archived employer input, verified credits',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B8-HS-DASHBOARD-METRICS-DERIVED',
        ST,
        [A + 'app/api/health-safety/dashboard/route.ts', A + 'app/api/__tests__/health-safety-dashboard.route.test.ts'],
        'The measures are now taken on the dates the events happened: incidents are counted and the previous window compared by incident date, days without incident run from the latest incident date (null when none is on record, as before), inspections are those scheduled within the window up to now and the rate is completed over those, and the hazard trend compares hazards reported in the window with the same length before it instead of reading the number currently open. Fixed clean metrics on a failure and a constant training figure were already removed.',
      ),
      fresh(
        'DEF-0B6-EMP-REGISTRY-ARCHIVE',
        'PARTIAL',
        [A + 'app/api/employer-execution/timesheets/route.ts'],
        'Timesheet ingest now refuses an archived employer (409) instead of continuing to take payroll input for it.',
        'The generic employer delete still sets only status archived (no archived-at stamp) and does not check for open timesheet batches, contacts or communications; a governed archive action is needed.',
      ),
    ],
  })
}

upgrade(
  'DEF-0B12-PLT-QUEUE-STATUS-SERVICE-KEY',
  ST,
  [A + 'app/api/union-eyes/queue-status/route.ts', A + 'app/api/__tests__/queue-status.route.test.ts'],
  'B93: the control-plane key is QUEUE_STATUS_SERVICE_KEY, compared in constant time; the shared AI service key is accepted only outside production, so in production a leak of the AI key does not open platform queue data. The deployment must set the dedicated key for the control plane to read this route. A route test covers the dedicated key and the production refusal.',
)
upgrade(
  'DEF-0B12-WBK-PUBLIC-START',
  ST,
  [A + 'app/api/workbook/start/route.ts', A + 'app/api/workbook/checkout/route.ts', A + 'lib/public-intake/bot-challenge.ts'],
  'Verified on source in B93: workbook start and checkout both call guardPublicIntake with a Turnstile challenge that fails closed in production (added in B85).',
)

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B93 added')
