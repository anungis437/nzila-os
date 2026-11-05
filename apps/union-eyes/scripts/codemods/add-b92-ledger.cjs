const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B92-FACTORY-ATTRIBUTION-AND-VERIFIED-CREDITS'
const test = A + 'lib/services/__tests__/s36-factory-attribution-and-verified-credits.test.ts'
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
    family: 'Generic CRUD attribution fields and verified credits',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT',
        'PARTIAL',
        [A + 'lib/api/crud-factory.ts'],
        'The factory already refuses any key that is not a real column and any identity, tenancy, owner and lifecycle-time field. B92 widens the refused set to attribution and approval written under other spellings (createdById, approvedById, reviewedById, publishedById, verifiedById/Name/Date, approvedByName/Date, closedBy/ById, resolvedBy/ById, signedBy/ById, enteredBy), so the person and time of an act are always the server\'s record on all 98 factory routes; the factory and route suites pass.',
        'A route that lists no writableFields (84 of the 98) still accepts any real, non-reserved column, including status, cost and outcome columns; each needs its own allow-list decided from what its screens send.',
      ),
      fresh(
        'DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM',
        ST,
        [A + 'lib/api/crud-factory.ts'],
        'Verified on source in B92: DELETE no longer writes an invented archived value into a domain enum; a status column that cannot take it refuses generic deletion with a 403 that names the governed lifecycle action (supportsGenericArchive).',
      ),
      fresh(
        'DEF-0B11-PRP-PRECEDENT-ITEM-PATCH',
        ST,
        [A + 'app/api/precedents/[id]/route.ts'],
        'Verified on source in B92: the item PATCH parses a strict schema (no body copy), is owner-only under the caller\'s tenant context, and audits a change of sharing level with the previous and new level.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B92 added')
