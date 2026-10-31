const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B62-F03-F08-F06-VERIFIED-PATHS-AND-HONEST-DISCONNECT'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'Verified honest 501 paths, and a disconnect that reports whether the platform token was revoked',
    evidenceCommit: null,
    items: [
      item('DEF-0B8-FED-LOCALS-DELETE-ARCHIVES-STATUS-WITHOUT-ARCHIVED-AT', [A + 'app/api/locals/route.ts', A + 'app/api/locals/[id]/route.ts'], 'Existing implementation, verified: the locals paths answer 501 and no longer delete or archive bargaining units under a local-union name; pinned by a test.'),
      item('DEF-0B7-PLT-EQUITY-SELF-IDENTIFY-WRITE-FLOOR-EXCLUDES-DATA-SUBJECT', [A + 'app/api/equity/self-identify/route.ts'], 'Existing implementation, verified: the self-identification path answers 501, so it no longer accepts a steward-entered self-identification that the data subject could not make; pinned by a test.'),
      item('DEF-0B11-SOC-DISCONNECT-DELETES-THE-CREDENTIAL-EVEN-WHEN-REVOCATION-FAILS', [A + 'app/api/social-media/accounts/route.ts'],
        'The local credential is still removed (an unremovable credential would be worse), but the revocation outcome (revoked, not required, failed) is recorded in the audit entry and returned, and a failed revocation is answered with a message that the platform token stays valid until it expires or is revoked at the platform instead of a plain success. The existing social-media route tests pass.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B62 added')
