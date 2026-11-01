const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B44-F05-SIGNATURE-DISCLOSURE-AND-BOUNDED-DIRECTORY-SEARCH'
if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'F05: signature records disclose only what the viewer is entitled to and are bounded; a search term is literal and bounded',
    evidenceCommit: null,
    items: [
      {
        prefix: 'DEF-0B11-SOC-SIGNATURE-PATCH-DECLARES',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/signatures/documents/[id]/route.ts', A + 'lib/signature/__tests__/b44-signer-privacy.test.ts'],
        explanation: 'The void PATCH now applies its schema: a strict body with the literal action void and a trimmed reason of 1 to 1000 characters. A body that does not match is a 400 and nothing is stored. Contract test added.',
      },
      {
        prefix: 'DEF-0B11-SOC-SIGNATURE-LIST-IS-UNPAGINATED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/b44-signer-privacy.test.ts'],
        explanation: 'Both queries of the caller own document list (sent and to-sign) are limited to 200 rows, newest first, and the to-sign side returns only the caller own signer row. Contract test pins both limits.',
        remaining: 'No cursor or offset parameter yet; the newest 200 are returned.',
      },
      {
        prefix: 'DEF-0B11-SOC-SIGNATURE-STATUS-AND-AUDIT-DISCLOSE',
        status: 'PARTIAL',
        files: [A + 'lib/signature/signer-privacy.ts', A + 'app/api/signatures/documents/[id]/route.ts', A + 'app/api/signatures/audit/[documentId]/route.ts', A + 'lib/signature/__tests__/b44-signer-privacy.test.ts', A + 'app/api/signatures/audit/[documentId]/__tests__/route.test.ts'],
        explanation: 'The status, the audit trail and the audit report keep every signer network address, user agent and geolocation for the sender only. A signer sees those fields only on the rows that describe themselves. Unit tests cover sender, signer and audit rows. The audit route test mock gained getDocumentSender (disclosed adaptation).',
        remaining: 'Signer e-mail addresses are still visible to every signer, and the report actor and signer rows carry no user id, so a signer own network data is also withheld from the report.',
      },
      {
        prefix: 'DEF-0B11-SOC-SIGNATURE-AUDIT-TRAIL-HAS-NO-HASH',
        status: 'PARTIAL',
        files: [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/b44-signer-privacy.test.ts'],
        explanation: 'The audit report no longer reads as certified evidence: it carries an integrity block stating the trail is unsealed, not hash-chained and not tamper-evident.',
        remaining: 'No hash chain, file-hash recomputation at signing, or sealing is implemented, and the signer address still comes from a client-supplied forwarded header.',
      },
      {
        prefix: 'DEF-0B11-SOC-VOID-SWALLOWS',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/signature-service.test.ts'],
        explanation: 'Existing implementation, verified: a provider failure aborts the void with a conflict, so no void or audit row is written while the envelope is live. The existing test covers it.',
      },
      {
        prefix: 'DEF-0B11-SOC-SIGNING-IGNORES-THE-STORED-EXPIRY',
        status: 'PARTIAL',
        files: [A + 'lib/signature/signature-service.ts', A + 'lib/signature/__tests__/signature-service.test.ts'],
        explanation: 'Existing implementation, verified: recordSignature refuses an expired request and enforces sequential signing order, each with a test.',
        remaining: 'The requireAuthentication option is still stored and not enforced, and nothing sets the expired status for an internal document.',
      },
      {
        prefix: 'DEF-0B9-ORG-DIRECTORY-SEARCH-UNESCAPED',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/organization/members/search/route.ts', A + 'lib/api/like-pattern.ts', A + 'app/api/__tests__/organization-members-search.route.test.ts'],
        explanation: 'The search term is trimmed, bounded to 100 characters (400 beyond), and its LIKE wildcards are taken literally. Results are ordered by name then id and paged by limit (at most 50) and offset. The test mock chain was adapted to the ordered, paged query (disclosed), and a new test covers escaping, bounds and offset.',
      },
      {
        prefix: 'DEF-0B12-PLT-KPI-ITEM-ID-IS-NOT',
        status: 'IMPLEMENTED_PENDING_QUALIFICATION',
        files: [A + 'app/api/targets/[id]/route.ts', A + 'app/api/__tests__/targets-id.route.test.ts'],
        explanation: 'Existing implementation, verified: a malformed target id is a 400 before any database predicate is built, with an existing test that no query or audit happens.',
        remaining: 'The route still offers no edit, rename or delete of a target.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B44 added')
