const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B94-TARGETS-EXTERNAL-AUDIT-PROFILE'
const test = A + 'lib/services/__tests__/s38-targets-external-audit-profile.test.ts'
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
    family: 'KPI target bounds, external refusal audit scope, profile roles',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B12-PLT-KPI-CALCULATION',
        ST,
        [A + 'app/api/targets/route.ts'],
        'POST /api/targets now stores a calculation only as one named aggregation (sum, avg, count, min or max; strict, nothing else is kept) and refuses a target created with alertEnabled true, because no sender or recipient list exists to deliver an alert; it no longer stores a promise nothing keeps.',
        'The summary route still does not apply the stored aggregation or data source; wiring it is a product change to the KPI engine.',
      ),
      fresh(
        'DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY',
        'PARTIAL',
        [A + 'lib/services/external-resource-authorization-service.ts', A + 'lib/external-resource-middleware.ts'],
        'A refusal for an actor who holds no representation authority is no longer written into the named organization\'s audit trail (it goes to the application log), so a signed-in stranger who names any organization id can no longer add rows to that organization\'s audit log; a refusal for an actor who does hold an authority is still audited there.',
        'The route still opens the tenant transaction for the organization named by the caller before the grant is checked; the binder that requires an active membership applies only in canonical V2.',
      ),
      fresh(
        'DEF-0B11-PRP-PROFILE-ROLES-PATH',
        ST,
        [A + 'app/api/profile/roles/route.ts'],
        'Verified on source in B94: the route no longer lists billing profiles; it answers the signed-in user\'s own roles from their live membership on GET and on POST (whose body is ignored), so there is no refused POST and no billing data.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B94 added')
