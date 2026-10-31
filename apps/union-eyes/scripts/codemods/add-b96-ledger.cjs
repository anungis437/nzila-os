const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B96-HONEST-AVAILABILITY-AND-ENDPOINT-RULES'
const test = A + 'lib/services/__tests__/s40-honest-availability-and-endpoint-rules.test.ts'
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
    family: 'Honest availability for an uncomputed store; public-address rule for a stored integration endpoint',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED',
        'PARTIAL',
        [A + 'app/api/cognition/engagement/route.ts'],
        'The engagement route answers availability: not_computed when no snapshot exists, so an empty list is the absence of a measurement and not a finding that no member is disengaged.',
        'Nothing computes engagement snapshots (computeMemberEngagement has no caller), and the executive summary and key-indicator disengaged-member counts still read the same empty store; a scheduled scorer is a product change.',
      ),
      fresh(
        'DEF-0B7-PLT-EXT-CONFIGURATION-HAS-NO-CREATE-PATH',
        'PARTIAL',
        [A + 'app/api/extensions/[id]/route.ts'],
        'An integration endpoint written through PATCH must now be a public http(s) address (the same rule as every other address the platform is told to call).',
        'No route creates an integration row and no synchronization consumes the table, so enabling an integration or changing its frequency still affects nothing; a create path and a consumer are a product decision.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B96 added')
