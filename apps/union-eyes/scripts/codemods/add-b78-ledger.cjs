const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B78-AUDIT-ATOMICITY'
const test = A + 'lib/services/__tests__/s22-audit-atomicity-batch.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'
const item = (prefix, files, explanation, remaining) => ({ prefix, status: remaining ? 'PARTIAL' : ST, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Audit atomicity: invoice generation, trial expiry, lapsed designations, workbook export, deprecated-route access',
    evidenceCommit: null,
    items: [
      item(
        'DEF-0B3-BILLING-AUDIT-NOT-ATOMIC',
        [
          A + 'services/platform-economics/billing-service.ts',
          A + 'services/platform-economics/ledger-service.ts',
          A + 'services/platform-economics/subscription-lifecycle-service.ts',
          A + 'services/platform-economics/billing-service.test.ts',
          A + 'services/platform-economics/__tests__/billing-service.test.ts',
          A + 'services/platform-economics/__tests__/subscription-lifecycle-service.test.ts',
        ],
        'Invoice generation now writes the invoice, its lines, a ledger entry for every non-zero line (appendLedgerEntry joins the caller transaction) and a persistAtomicAudit record in one transaction, so a failed audit leaves no invoice and no ledger entry (the ledger appends used to commit separately, after the invoice, and the audit event after those). Trial expiry updates the subscription, writes its event row and its audit record in one transaction per subscription, where it used to write no audit record. Three test files were adapted (disclosed): the mocks of the atomic audit and of the transaction, the invoice-generated assertion moved from auditLog to persistAtomicAudit, and failure cases added.',
        'The invoice replay route still records its access as a separate auditLog event; the replay recomputes totals and writes nothing, so there is no row for the record to be atomic with, but the manifest still declares the audit class atomic.',
      ),
      item(
        'DEF-0B12-PLT-TRIAGE-LAPSED-DESIGNATION-IS-CLOSED-AS-SYSTEM-EXPIRY-WITH-NO-AUDIT-ROW',
        [A + 'lib/triage/designations.ts'],
        'The closure of a lapsed designation during a fresh grant returns the closed rows and writes a triage.designation.expire audit record for each, in the same transaction, attributed to system:expiry (kept in the metadata, as persistAtomicAudit does for system actors) with the administrator who triggered the closure.',
      ),
      item(
        'DEF-0B12-WBK-EXPORT-STREAMS-THE-IDENTITY-LINKED-CARRIER-REGISTER-WITH-NO-AUDIT-RECORD',
        [
          A + 'app/api/workbook/[id]/export/route.ts',
          A + 'app/api/__tests__/workbook-export.route.test.ts',
          A + 'lib/workbook-pdf/loadWorkbookModules.ts',
          A + 'lib/workbook-pdf/GovernanceEntropyWorkbookTemplate.tsx',
        ],
        'The export writes a workbook.export audit record (authority kind, size) through the claimed-workbook audit helper before the PDF is returned, and fails closed when the record cannot be written. The loader no longer selects the display name of every holder, which the template never printed. The export route test was extended (disclosed): it mocks the audit helper and adds the audit, audit-failure and ineligible-tier cases.',
      ),
      item(
        'DEF-0B12-PLT-V2-CATCH-ALL-ACCESS-AUDIT-HAS-NO-ACTOR-AND-IS-NOT-AWAITED',
        [A + 'app/api/v2/[...path]/route.ts', A + 'app/api/__tests__/v2-catch-all-gone.route.test.ts'],
        'The access record carries the caller and organization from the handler context and is awaited; a failure to record is logged and the answer stays 410. The catch-all test was extended (disclosed): it supplies the identity, asserts it, mocks the logger and adds the failed-record case.',
      ),
      item(
        'DEF-0B2-AI-GET-WRITES-ROWS',
        [A + 'lib/ai/employer-risk.ts', A + 'app/api/ai/employers/[id]/risk/route.ts'],
        'Verified in source: the employer risk calculation and the insight report no longer insert employer_risk_scores or ai_insight_reports on a GET (the comment records that persistence needs a separately authorized, audited command); the invocation is audited.',
      ),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B78 added')
