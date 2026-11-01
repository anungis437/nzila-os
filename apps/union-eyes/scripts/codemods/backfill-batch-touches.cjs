// One-off backfill: records `touches` (defect, status, files) on the F06 batches B105 onward from the recipes that created them.
// Those batches mostly upgraded defects in place and added nothing to `items`, so their commit and files could not be tied to a defect.
// Reads only the recipes' own arguments (no behaviour of the recipes is run) and never changes an item, a status or a count. Idempotent.
const fs = require('fs')
const path = require('path')
const Module = require('module')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister

const captured = []
const load = Module._load
Module._load = function (request, parent, ...rest) {
  if (request === './f06-ledger-lib.cjs') return { addBatch: (args) => captured.push(args) }
  return load.call(this, request, parent, ...rest)
}
const recipes = fs.readdirSync(__dirname).filter((f) => /^add-b1(0[5-9]|1\d)-ledger\.cjs$/.test(f)).sort()
for (const recipe of recipes) require(path.join(__dirname, recipe))
Module._load = load

const resolveId = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
let filled = 0
for (const args of captured) {
  const batch = ledger.batches.find((b) => b.id === args.id)
  if (!batch || batch.touches) continue
  batch.touches = args.items.map((item) => ({
    defectId: resolveId(item.prefix),
    status: item.status,
    files: [...new Set([...(item.files || []), ...(args.test ? [args.test] : [])])],
  }))
  filled += 1
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
console.log(`recipes read: ${recipes.length}, batches given touches: ${filled}`)
