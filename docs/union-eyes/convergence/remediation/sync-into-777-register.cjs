// Folds the Gate 0 elimination batches (elimination-batches.json) into the canonical per-defect overlay
// ue-all-777-remediation-register.json. It adds engineeringCorrection state only; it never edits frozen provenance, never
// removes a record and never changes a defect another run already corrected. Rerunning it is idempotent.
const fs = require('fs')
const path = require('path')
const dir = __dirname
const registerPath = path.join(dir, 'ue-all-777-remediation-register.json')
const raw = fs.readFileSync(registerPath, 'utf8')
const crlf = raw.includes('\r\n')
const register = JSON.parse(raw)
const ledger = JSON.parse(fs.readFileSync(path.join(dir, 'ue-gate0-defect-elimination.json'), 'utf8'))
const BRANCH = 'agents/ue-cursor-final-closure'
const byId = new Map(register.records.map((r) => [r.defectId, r]))
const skipped = []
let added = 0
let partial = 0
for (const [id, entry] of Object.entries(ledger.entries)) {
  const record = byId.get(id)
  if (!record) throw new Error(`not in the 777 overlay: ${id}`)
  const existing = record.engineeringCorrection
  if (existing && existing.batch !== entry.batch) {
    // Another run corrected this defect first; keep its record and note the overlap.
    skipped.push(id)
    continue
  }
  const implemented = entry.status === 'IMPLEMENTED_PENDING_QUALIFICATION'
  record.engineeringCorrection = {
    state: implemented ? 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION' : 'PARTIAL_SOURCE_REMAINING_WORK',
    batch: entry.batch,
    path: entry.files.join('; '),
    explanation: entry.explanation,
    ...(entry.remaining ? { remaining: entry.remaining } : {}),
    sourceBranch: BRANCH,
  }
  record.currentHeadVerification = 'SOURCE_PATCHED_NOT_VERIFIED_AT_CURRENT_HEAD'
  if (implemented) added += 1
  else partial += 1
}
const corrected = register.records.filter((r) => r.engineeringCorrection && r.engineeringCorrection.state === 'IMPLEMENTED_SOURCE_PENDING_VS_VALIDATION').length
const partials = register.records.filter((r) => r.engineeringCorrection && r.engineeringCorrection.state === 'PARTIAL_SOURCE_REMAINING_WORK').length
register.summary.engineeringCorrected = corrected
register.summary.engineeringPartial = partials
register.summary.engineeringRemaining = register.records.length - corrected
let out = JSON.stringify(register, null, 2) + '\n'
if (crlf) out = out.replace(/\n/g, '\r\n')
fs.writeFileSync(registerPath, out)
console.log(JSON.stringify({ addedImplemented: added, addedPartial: partial, overlapSkipped: skipped, summary: { corrected, partials, remaining: register.records.length - corrected } }))
