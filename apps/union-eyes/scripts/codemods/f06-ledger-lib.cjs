// Shared helper for the F06 batch ledger scripts (add-b105-ledger.cjs onward).
// Usage: require('./f06-ledger-lib.cjs').addBatch({ id, family, test, items: [{ prefix, status, files, explanation, remaining }] })
// An item already in the ledger is upgraded in place (status, files, explanation, remaining); an item not yet in it is added to the new batch.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister

function resolveId(prefix) {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}

function addBatch({ id, family, test, items, previousEvidence }) {
  const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (previousEvidence) {
    for (const [batchId, sha] of Object.entries(previousEvidence)) {
      const b = ledger.batches.find((x) => x.id === batchId)
      if (b && !b.evidenceCommit) b.evidenceCommit = sha
    }
  }
  if (!ledger.batches.some((x) => x.id === id)) {
    const all = ledger.batches.flatMap((b) => b.items)
    const fresh = []
    for (const it of items) {
      const prefix = resolveId(it.prefix)
      const found = all.find((i) => i.prefix === prefix)
      const files = [...new Set([...(it.files || []), ...(test ? [test] : [])])]
      if (found) {
        found.status = it.status
        if (it.remaining) found.remaining = it.remaining
        else delete found.remaining
        found.files = [...new Set([...(found.files || []), ...files])]
        if (!found.explanation.includes(it.explanation)) found.explanation += ' ' + it.explanation
      } else {
        fresh.push({ prefix, status: it.status, files, explanation: it.explanation, ...(it.remaining ? { remaining: it.remaining } : {}) })
      }
    }
    ledger.batches.push({ id, family, evidenceCommit: null, items: fresh })
  }
  for (const batch of ledger.batches.filter((x) => x.id === id)) {
    for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
  }
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
  console.log(id, 'recorded')
}

module.exports = { addBatch }
