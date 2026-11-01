const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B89-REPORT-CONFIG-CROSS-ORG-READ-AI-CLASS'
const test = A + 'lib/services/__tests__/s33-report-config-cross-org-ai-class.test.ts'
const ST = 'IMPLEMENTED_PENDING_QUALIFICATION'

const resolve = (prefix) => {
  const hits = register.filter((d) => d.id.startsWith(prefix))
  if (hits.length !== 1) throw new Error(`prefix ${prefix} matched ${hits.length}`)
  return hits[0].id
}
const fresh = (prefix, status, files, explanation, remaining) => ({ prefix: resolve(prefix), status, files: [...files, test], explanation, ...(remaining ? { remaining } : {}) })

if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Stored report contract, cross-organization read authority, AI data class, verified signer and list fixes',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B11-RPT-STORED-CONFIG',
        ST,
        [
          A + 'lib/reports/report-config-validation.ts',
          A + 'lib/reports/__tests__/report-config-validation.test.ts',
          A + 'app/api/reports/route.ts',
          A + 'app/api/reports/[id]/route.ts',
          A + 'app/api/reports/execute/route.ts',
          A + 'lib/services/__tests__/s19-report-operators-and-queue-status.test.ts',
        ],
        'The execute route allowlists moved into lib/reports/report-config-validation.ts and the report definition create (beforeCreate) and update (beforeUpdate) now apply them at save time through validateStoredReportConfig: an object of at most 32 KB and depth 6, a registry data source, registry field ids, the executor operator vocabulary, bounded lists, and a join only to a table of the reporting registry; a refused definition answers 400 with the reason instead of being stored as a success. The s19 pin was adapted to read the shared validator (disclosed).',
      ),
      fresh(
        'DEF-0B2-CROSS-ORG-ANALYTICS',
        ST,
        [A + 'app/api/analytics/cross-org/route.ts', A + 'app/api/__tests__/analytics-cross-org.route.test.ts', A + 'db/rls-storage-authority/analytics-ai.ts', A + 'lib/operations/catalog-authority-contract.json'],
        'The read no longer depends on whatever the connection role happens to see: it runs under the system role on purpose (the manifest now declares SELECT for the system role on analytics_metrics and the catalog contract was regenerated), returns aggregates only as before, requires an active organization for the caller, and records analytics.cross_org.read in the same transaction as the read. The route test was adapted to the system transaction and a no-organization case was added (disclosed). The platform_lead role-title floor remains the gate, as for the platform statistics read; a platform-staff mandate does not exist yet.',
      ),
      fresh(
        'DEF-0B2-AI-DATA-CLASS-DOWNGRADE',
        'PARTIAL',
        [A + 'lib/services/ai/precedent-matching-service.ts', A + 'lib/ai/ai-client.ts'],
        'A mapping exists (toGatewayDataClass: confidential and member data to sensitive; restricted, pension_financial and grievance_legal to regulated) and the finance, pension, employer risk, grievance triage, steward copilot and clause reasoning services use it. B87/B89: the three precedent-matching calls that send claim facts (keyword extraction, applicability, strength analysis) now declare regulated instead of internal.',
        'Several other services (auto classification, clause extraction, vector search, copilot, mamba, chatbot, knowledge-transfer) still declare internal literals; each needs a per-surface decision of the class its inputs carry.',
      ),
      fresh(
        'DEF-0B6-SYS-CONTINUITY-LIST',
        ST,
        [A + 'app/api/documents/repository/route.ts'],
        'Verified on source in B89: the repository list is bounded (listPage, default 50, at most 100 candidate rows with an offset on candidate rows), the case filter is applied in SQL, and the filters are length-checked, so the cost no longer grows with the size of the document store.',
      ),
      fresh(
        'DEF-0B11-SOC-SIGNER-IDENTITY',
        ST,
        [A + 'lib/signature/signer-verification.ts', A + 'lib/signature/signature-service.ts', A + 'app/api/signatures/documents/route.ts'],
        'Verified on source in B89: the signers list is parsed with a strict schema; a platform signer must be an active member of the sending organization and is stored under that member record name and e-mail address (what the sender typed is discarded); a document held by an external provider is refused for local signing, so it cannot be completed without the provider.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B89 added')
