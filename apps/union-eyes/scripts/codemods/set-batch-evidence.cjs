// Records the commit that introduced a ledger batch (the batch's own commit is not known until it exists, so the next batch normally fills it in).
// Usage: node set-batch-evidence.cjs <batch id prefix, e.g. B118> <commit sha>. Sets only an empty evidenceCommit; never overwrites one.
const fs = require('fs')
const path = require('path')
const [, , prefix, sha] = process.argv
if (!prefix || !/^[0-9a-f]{9,40}$/.test(sha || '')) throw new Error('usage: set-batch-evidence.cjs <batch id prefix> <commit sha>')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const batch = ledger.batches.find((b) => b.id.startsWith(prefix + '-'))
if (!batch) throw new Error(`no batch ${prefix}`)
if (batch.evidenceCommit) {
  console.log(`${batch.id} already has ${batch.evidenceCommit}`)
} else {
  batch.evidenceCommit = sha
  fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
  console.log(`${batch.id} -> ${sha}`)
}
