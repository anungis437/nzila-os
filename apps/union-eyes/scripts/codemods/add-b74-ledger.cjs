const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B74-PILOT-WRITE-PAYLOADS'
const test = A + 'lib/services/__tests__/s18-pilot-write-payloads.test.ts'
const all = () => ledger.batches.flatMap((b) => b.items)
if (!ledger.batches.some((x) => x.id === id)) {
  const routes = ['commercial-transition', 'artifacts', 'intelligence', 'reference-profile'].map((n) => A + 'app/api/pilot/apply/[id]/' + n + '/route.ts')
  const it = all().find((i) => i.prefix.startsWith('DEF-0B10-PIL-PILOT-WRITE-ROUTES-CAST-THE-JSON-BODY'))
  if (!it) throw new Error('no earlier pilot write item')
  it.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
  delete it.remaining
  it.explanation += ' Completed: the four POST handlers parse their body through length-bounded schemas (lib/pilot/write-payloads.ts; an absent body is the empty object, a malformed, mistyped, oversized or non-object body is a 400 or 413, unknown keys are dropped), so no caller text reaches the jsonb column unbounded.'
  it.files = [...new Set([...it.files, A + 'lib/pilot/write-payloads.ts', ...routes, test])]
  const resp = all().find((i) => i.prefix.startsWith('DEF-0B10-PIL-PUBLIC-APPLICATION-RESPONSES-OBJECT'))
  if (!resp) throw new Error('no earlier responses item')
  resp.status = 'IMPLEMENTED_PENDING_QUALIFICATION'
  delete resp.remaining
  resp.explanation += ' Verified later: responses go through boundedJsonRecord (16 KB, 60 keys, depth 4) and an assessment keeps only its score.'
  resp.files = [...new Set([...resp.files, A + 'app/api/pilot/apply/route.ts', test])]
  ledger.batches.push({ id, family: 'Pilot write routes: parsed, bounded request bodies', evidenceCommit: null, items: [] })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B74 added')
