const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const files = [
  '.github/workflows/ue-native-postgres.yml',
  'apps/union-eyes/vitest.native-isolation.ts',
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
  status: 'SOURCE_CHANGED_NATIVE_PG15_PG16_LOCAL_PASS_EXACT_SHA_CI_PENDING',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-native-whole-project-isolated-ci-and-verifier-20261101.md',
  sourceBaseline: '9e05782a1ec217f256d23e141477b7b8cfe41557',
  files,
  correction:
    'The native PostgreSQL job now runs the whole native project (49 files) on PG15 and PG16 instead of a named list that omitted every later test, and a tested contract derives the expected files from disk so a new native test cannot silently go unrun: every file must run and pass, and the only skip allowed is named with its reason and recorded as a skip. Each file runs in its own clone of the pristine converged database, which removes order dependence and makes re-runs safe. The seven formerly env-gated files were run for real and pass (storage, Django audit, round58, p4 attestation, ownership backfill, election succession, identity path). R-37 was a defect in a deployment gate: the post-apply verifier reported 127 false positives against the current converged database (unknown dedicated-context classes, a fixed four-command policy shape against append-only tables, a hand-kept baseline list); it now derives its expectations from the manifest, reports 0 missing and 0 extra on both converged databases (410 entries checked) and 101 on the historical fixture, and a compile-time exhaustive classification table stops the drift from recurring. Local CI-faithful result on fresh PG15.19 and PG16.15: 459 tests, 458 passed, 0 failed, 1 skipped by design. Supersedes the explicit 11-file list of UE-NATIVE-PG-CI-JOURNEY-COVERAGE-20261101 and completes the correction of UE-NATIVE-FINANCE-AUDIT-FIXTURE-ISOLATION-20261101 (its fail-closed Canonical V2 test is kept; the hash-chained audit sink atomicity it dropped is restored with the membership read pinned to the legacy source for that test only).',
  remaining:
    'Exact-SHA PG15 and PG16 CI results and receipts for the pushed commit; twelve manifest entries with no physical table (pinned by a native test; the routes that reach them answer 500); the Canonical V2 topology is built by no CI job (one test skips by design and the V2 clean-room qualification is in no workflow); real-login, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const index = ledger.crossCuttingSourceEvidence.findIndex((entry) => entry.id === record.id)
if (index === -1) ledger.crossCuttingSourceEvidence.push(record)
else ledger.crossCuttingSourceEvidence[index] = record
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
console.log(index === -1 ? 'cross-cutting record added' : 'cross-cutting record replaced')
