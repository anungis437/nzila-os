const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const file = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister
const A = 'apps/union-eyes/'
const id = 'B97-PILOT-AUDIT-VERIFICATION-BASIS-KPI-FRESHNESS'
const test = A + 'lib/services/__tests__/s41-pilot-audit-verification-basis-kpi-freshness.test.ts'
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
    family: 'Pilot write audit, organization verification basis, KPI value freshness',
    evidenceCommit: null,
    items: [
      fresh(
        'DEF-0B10-PIL-ARTIFACT-INTELLIGENCE-AND-REFERENCE-WRITES',
        ST,
        [
          A + 'lib/pilot/pilot-mutation.ts',
          A + 'lib/pilot/__tests__/pilot-mutation.test.ts',
          A + 'app/api/pilot/apply/[id]/artifacts/route.ts',
          A + 'app/api/pilot/apply/[id]/intelligence/route.ts',
          A + 'app/api/pilot/apply/[id]/reference-profile/route.ts',
          A + 'app/api/__tests__/pilot-intelligence.route.test.ts',
          A + 'app/api/__tests__/pilot-reference-profile.route.test.ts',
        ],
        'withLockedPilotMutation takes an optional audit declaration from the mutation and, when something was actually written, commits the audit row in the same transaction as the locked update, under the owning organization (or the acting platform organization for an application not yet bound); a missing actor refuses the write. The artifact, intelligence and reference-profile POST handlers declare pilot.artifact_version.add, pilot.intelligence.add and pilot.reference_profile.snapshot. No audit row is written when a branch writes nothing. The mutation helper test and two route tests were extended or given the actor and audit mocks (disclosed).',
      ),
      fresh(
        'DEF-0B10-PIL-ORGANIZATION-VERIFICATION-CHECKS-ONLY',
        'PARTIAL',
        [A + 'app/api/pilot/apply/[id]/verify-organization/route.ts', A + 'lib/pilot/pilot-ownership.ts', A + 'app/api/__tests__/pilot-verify-organization.route.test.ts'],
        'Verification now requires the basis the administrator relied on (20 to 1000 characters) and keeps it in the audit record with the binding; a request without it is refused.',
        'No proof is compared (applicant e-mail domain, contact membership, a document), and the audit row is still written under the target organization; verified remains an administrator\'s recorded conclusion.',
      ),
      fresh(
        'DEF-0B12-PLT-KPI-CURRENT-VALUE',
        'PARTIAL',
        [A + 'app/api/targets/summary/route.ts'],
        'The summary states which row a current value came from (valueBasis, asOf), treats a metric row whose period ended more than 120 days ago as no current value (stale: true, health no_data) instead of judging the target against it, and no longer reports the trend of a stale row.',
        'Neither the declared data source nor the calculation is applied to the metric rows; the value is still the latest row of the same metric type text.',
      ),
    ],
  })
}

for (const batch of ledger.batches.filter((x) => x.id === id)) for (const it of batch.items) for (const f of it.files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B97 added')
