const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B95-REPORT-AND-KNOWLEDGE-READ-RECORDS'
const test = A + 'lib/services/__tests__/s39-report-and-knowledge-read-records.test.ts'
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
    family: 'Durable records and access rules for report execution and knowledge-base reads',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B11-RPT-EXECUTE-RETURNS-MEMBER-EMAIL',
        'PARTIAL',
        [A + 'app/api/reports/execute/route.ts', A + 'app/api/__tests__/reports-execute.route.test.ts'],
        'A successful execution now writes report.execute to the canonical audit log before the rows are returned (data source, field ids, filter count and row count, never the rows), where it was only a log line.',
        'The route is still at the officer role title and no field-level authority limits which registry fields (member e-mail, claim rows) an officer may select.',
      ),
      fresh(
        'DEF-0B8-JUR-KNOWLEDGE-BASE-READS-IGNORE-ACCESS-COLUMNS',
        'PARTIAL',
        [
          A + 'lib/knowledge-transfer/governance/kb-visibility.ts',
          A + 'lib/knowledge-transfer/governance/__tests__/kb-visibility.test.ts',
          A + 'app/api/knowledge-base/route.ts',
          A + 'app/api/knowledge-base/[id]/route.ts',
        ],
        'A parent organization\'s knowledge-base row is now served to a child only when it is public or names the child in allowed_organizations (the access columns decide); the list search matches the title and summary the list returns, not the full content of rows whose content it does not show; and opening a document writes knowledge_base.read to the audit log before the content is returned. Exit-interview copies were already governed by the interview reader condition.',
        'The routes still apply no union_knowledge_suite entitlement, because the same table serves organizations without that suite and which of them may read it is a product decision.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B95 added')
