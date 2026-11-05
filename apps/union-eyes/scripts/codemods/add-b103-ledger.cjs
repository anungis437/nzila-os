const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B103-ORGANIZATION-SELECTION-AUDIT'
const test = A + 'lib/services/__tests__/s46-gate0-org-selection-audit.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const existing = () => ledger.batches.flatMap((x) => x.items)
const find = (prefix) => existing().find((i) => i.prefix.startsWith(prefix) || prefix.startsWith(i.prefix))
const item = (prefix, status, files, explanation, remaining) => {
  if (find(prefix)) throw new Error('already credited: ' + prefix)
  return { prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) }
}

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Organization selection is audited before it takes effect',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B10-OPL-10',
        'PARTIAL',
        [A + 'lib/auth/organization-selection-audit.ts', A + 'lib/auth/canonical-organization-selection.ts', A + 'app/api/organizations/switch/route.ts', A + 'app/api/__tests__/organizations-switch.route.test.ts'],
        'Selecting an organization to work in now leaves an organization.select audit record (actor, organization, and whether the authority was membership or platform administrator) written through the atomic audit before the session is rebound, the preference cookie is set or the organization is returned; if the record cannot be written the selection is refused (503 in legacy mode, an error in canonical mode). A platform administrator selecting an organization they hold no membership of is named as such.',
        'The session store and the audit store are separate databases, so the record is written first rather than in one transaction with the rebind; a record can exist for a rebind that then fails. The canonical path is covered by source pins and mocks only, not by a native or HTTP run.',
      ),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B103 added')
