const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const files = [
  '.github/workflows/ue-native-postgres.yml',
  'apps/union-eyes/scripts/runtime/native-test-database-isolation.ts',
  'apps/union-eyes/vitest.native.config.ts',
  'apps/union-eyes/db/__tests__/native-database-isolation.postgres.test.ts',
  'apps/union-eyes/db/__tests__/post-apply-verifier-core.test.ts',
  'apps/union-eyes/db/__tests__/post-apply-verifier.postgres.test.ts',
  'apps/union-eyes/db/__tests__/p4-authority-state-attest.postgres.test.ts',
  'apps/union-eyes/db/__tests__/finance-duties.postgres.test.ts',
  'apps/union-eyes/scripts/rls-enforcement/post-apply-verifier-core.ts',
  'apps/union-eyes/scripts/rls-enforcement/post-apply-verifier.ts',
  'tooling/scripts/lib/ue-native-results-contract.mjs',
  'tooling/scripts/lib/ue-native-results-contract.test.mjs',
  'tooling/scripts/lib/ue-native-expected-skips.json',
]
for (const f of files) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

// No frozen defect is credited: this is verification infrastructure and a repair of a deployment-gate tool, so it belongs with the cross-cutting records.
const record = {
  id: 'UE-NATIVE-PG-WHOLE-PROJECT-ISOLATED-CI-AND-VERIFIER-20261101',
  status: 'SOURCE_CHANGED_NATIVE_PG15_PG16_EXACT_SHA_CI_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-native-whole-project-isolated-ci-and-verifier-20261101.md',
  sourceBaseline: '9e05782a1ec217f256d23e141477b7b8cfe41557',
  files,
  correction:
    'The native PostgreSQL job now runs the whole native project (49 files) on PG15 and PG16 instead of a named list that omitted every later test, and a tested contract derives the expected files from disk so a new native test cannot silently go unrun: every file must run and pass, and the only skip allowed is named with its reason and recorded as a skip. Each file runs in its own clone of the pristine converged database, which removes order dependence and makes re-runs safe. The seven formerly env-gated files were run for real and pass (storage, Django audit, round58, p4 attestation, ownership backfill, election succession, identity path). R-37 was a defect in a deployment gate: the post-apply verifier reported 127 false positives against the current converged database (unknown dedicated-context classes, a fixed four-command policy shape against append-only tables, a hand-kept baseline list); it now derives its expectations from the manifest, reports 0 missing and 0 extra on both converged databases (410 entries checked) and 101 on the historical fixture, and a compile-time exhaustive classification table stops the drift from recurring. Local CI-faithful result on fresh PG15.19 and PG16.15: 459 tests, 458 passed, 0 failed, 1 skipped by design. Exact-SHA CI at 3c57086c8 (run 41360129873): PG15 and PG16 both passed with receipts of 49 files, 459 tests, 458 passed, 0 failed, 1 skipped by design; the same commit failed the contract db-boundary INV-06 because the new setup file imported pg from the application root, fixed by moving it to scripts/runtime (no exemption added). Supersedes the explicit 11-file list of UE-NATIVE-PG-CI-JOURNEY-COVERAGE-20261101 and completes the correction of UE-NATIVE-FINANCE-AUDIT-FIXTURE-ISOLATION-20261101 (its fail-closed Canonical V2 test is kept; the hash-chained audit sink atomicity it dropped is restored with the membership read pinned to the legacy source for that test only).',
  remaining:
    'Exact-SHA PG15 and PG16 CI results for the final head; twelve manifest entries with no physical table (pinned by a native test; the routes that reach them answer 500); the Canonical V2 topology is built by no CI job (one test skips by design and the V2 clean-room qualification is in no workflow); real-login, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const remittanceRecord = {
  id: 'UE-FINANCIAL-SERVICE-REMITTANCE-ROUTE-TESTS-REPAIRED-20261101',
  status: 'TEST_SOURCE_CORRECTED_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-native-whole-project-isolated-ci-and-verifier-20261101.md',
  sourceBaseline: '9e05782a1ec217f256d23e141477b7b8cfe41557',
  files: ['apps/union-eyes/services/financial-service/src/tests/unit/remittances-routes.test.ts'],
  correction:
    'remittances-routes.test.ts targeted a pre-transaction reconcile handler and a second, engine-based handler that commit 4b8a6f6e3 removed as unreachable; 8 of its 40 tests failed, which fails pnpm --filter financial-service test, the step governance:audit runs through financial-service:health, and no CI job runs that file. Test-only repair: the harness supports db.transaction and row-lock chains; the six tests of the removed handler are deleted with its dead engine mock; the two reconcile tests are rewritten for the transactional flow and joined by tests for exact cents, unavailable ids (409), batch limit (413), duplicate ids (400), a missing dues total (generic 500, nothing written), a concurrent change (nothing recorded), and the report refusing a reconciled remittance that carries no transaction references. No finance source, mandate, principal or table is changed. financial-service: 32 files, 576 tests pass (previously 8 failing).',
  remaining:
    'Pull-request CI runs only remittance-reconciliation-policy.test.ts for this service; running the whole suite in a workflow is a separate, finance-adjacent decision. The finance and pension freeze is unchanged. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
for (const entry of [record, remittanceRecord]) {
  const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === entry.id)
  if (index === -1) ledger.crossCuttingSourceEvidence.push(entry)
  else ledger.crossCuttingSourceEvidence[index] = entry
  console.log(index === -1 ? 'added' : 'replaced', entry.id)
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
