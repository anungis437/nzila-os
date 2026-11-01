const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B98-ARBITRATION-CASE-AUTHORITY'
const test = A + 'lib/services/__tests__/s42-arbitration-case-authority.test.ts'
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
    family: 'Case authority for arbitration writes',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY',
        'PARTIAL',
        [
          A + 'lib/arbitration/arbitration-case-authority.ts',
          A + 'lib/arbitration/__tests__/arbitration-case-authority.test.ts',
          A + 'app/api/arbitrations/route.ts',
          A + 'app/api/arbitrations/[id]/route.ts',
        ],
        'Creating an arbitration now requires that the grievanceId in the body be a grievance of the caller\'s organization (assertOrganizationOwns) and that the case authority allow the caller to edit that case (owner, or a collaborator with editing permission); changing one re-checks the same authority against the row loaded under the update\'s lock, and the grievance an arbitration belongs to cannot be changed.',
        'Reads of the collection and item still return every arbitration of the organization to a steward, and DELETE is not re-checked against the case; the generic factory has no per-row read hook for a kernel decision.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B98 added')
