// Generates docs/union-eyes/convergence/remediation/ue-gate0-defect-elimination.json from the frozen Gate 0C.1 defect register
// plus the corrections listed in elimination-batches.json. It never edits the frozen register; it adds state and derives totals.
const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../..')
const register = JSON.parse(fs.readFileSync(path.join(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const batches = JSON.parse(fs.readFileSync(path.join(__dirname, 'elimination-batches.json'), 'utf8'))
const ids = new Set(register.map((d) => d.id))
const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix)).map((d) => d.id)
  if (hits.length !== 1) throw new Error(`prefix must match exactly one defect: ${prefix} -> ${hits.length}`)
  return hits[0]
}
const entries = {}
const out = []
let outstanding = register.length
for (const batch of batches.batches) {
  const before = outstanding
  const corrected = []
  for (const item of batch.items) {
    const id = resolve(item.prefix)
    if (entries[id] && entries[id].status === 'IMPLEMENTED_PENDING_QUALIFICATION') throw new Error(`double counted: ${id}`)
    entries[id] = { status: item.status, batch: batch.id, files: item.files, explanation: item.explanation, ...(item.remaining ? { remaining: item.remaining } : {}) }
    if (item.status === 'IMPLEMENTED_PENDING_QUALIFICATION') corrected.push(id)
  }
  outstanding -= corrected.length
  out.push({ id: batch.id, family: batch.family, outstandingBefore: before, newlyImplemented: corrected.length, outstandingAfter: outstanding, partial: batch.items.filter((i) => i.status === 'PARTIAL').length, evidenceCommit: batch.evidenceCommit })
}
const count = (s) => Object.values(entries).filter((e) => e.status === s).length
const doc = {
  record: 'UE-GATE0-DEFECT-ELIMINATION',
  traceability: 'Every key of entries is a defect id of the frozen Gate 0C.1 defectRegister (777). This file adds implementation state only; it never edits, deletes or reclassifies the frozen register, and each defect is counted once.',
  population: register.length,
  creditRule: 'A defect is implemented only with a traceable code change that passed focused inspection and focused tests. Citation of an id by tooling or by a register-derived builder is not evidence. Qualification (typecheck, full suites, build, CI, runtime) is a separate pending dimension.',
  baseline: {
    idsCitedUnderApps: 31,
    idsCitedOnlyByTooling: 746,
    note: 'Only ids cited by application tests are candidates for earlier implementation; each needs per-defect inspection before it is credited. None is credited yet.',
  },
  totals: {
    original: register.length,
    implementedPendingQualification: count('IMPLEMENTED_PENDING_QUALIFICATION'),
    partial: count('PARTIAL'),
    qualificationVerified: 0,
    unresolved: register.length - count('IMPLEMENTED_PENDING_QUALIFICATION'),
    externalBlockers: 0,
  },
  batches: out,
  entries,
}
for (const id of Object.keys(entries)) if (!ids.has(id)) throw new Error(`not in register: ${id}`)
fs.writeFileSync(path.join(__dirname, 'ue-gate0-defect-elimination.json'), JSON.stringify(doc, null, 2) + '\n')
console.log(JSON.stringify({ totals: doc.totals, batches: out }))
