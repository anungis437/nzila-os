const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const sourceCommit = process.env.UE_TRANCHE7_SOURCE_COMMIT
if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) throw new Error('set UE_TRANCHE7_SOURCE_COMMIT to the 40-character sha of the pushed tranche 7 source commit')
const baseline = 'bf62586b8baa1ddcf418c97be9dff53f40a7502e'

// The files are read from the commits, so the evidence commit and every affected source file are recoverable programmatically.
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
git('cat-file', '-e', `${baseline}^{commit}`)
git('cat-file', '-e', `${sourceCommit}^{commit}`)
const files = git('diff', '--name-only', baseline, sourceCommit, '--', 'apps/union-eyes', 'docs/union-eyes/convergence/remediation/evidence', 'tooling/scripts/lib/ue-approved-migration-lineage.json')
  .split('\n')
  .filter(Boolean)
for (const required of [
  'apps/union-eyes/db/migrations-platform/0066_declared_indexes.sql',
  'apps/union-eyes/db/migrations-platform/0067_declared_checks.sql',
  'apps/union-eyes/db/migrations-platform/0068_declared_foreign_keys.sql',
  'apps/union-eyes/db/migrations-platform/0069_declared_not_null.sql',
  'apps/union-eyes/scripts/runtime/schema-convergence.ts',
  'apps/union-eyes/scripts/runtime/django-writers.ts',
  'apps/union-eyes/scripts/generate-declared-convergence.ts',
  'apps/union-eyes/scripts/codemods/declare-timestamptz.cjs',
  'apps/union-eyes/scripts/codemods/drop-declared-references.ts',
  'apps/union-eyes/db/__tests__/schema-convergence.postgres.test.ts',
]) {
  if (!files.includes(required)) throw new Error(`the tranche 7 source commit does not change ${required}`)
}

// No frozen defect is credited: this is schema convergence (verification and repair infrastructure), so it belongs with the cross-cutting records.
const tranche7 = {
  id: 'UE-DECLARED-INTEGRITY-PLATFORM-0066-0069-20261102',
  status: 'SOURCE_CHANGED_NATIVE_LOCAL_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-declared-integrity-convergence-20261102.md',
  sourceBaseline: baseline,
  sourceCommit,
  files,
  correction:
    'The five advisory classes tranche 6 pinned as measured are closed or reduced to a stated rule. The measurement now keeps every index (partial, expression, non-btree), foreign key and check declaration, compares the time zone of every declaration of a column, and reports a constraint PostgreSQL has not validated. Declarations: withTimezone is declared on 685 timestamp declarations in 74 files whose column is timestamptz (a read was wrong by the session offset unless the session ran at +00); two index declarations are corrected (a partial index declared total, a name two declarations gave to different indexes); a check that refused real addresses is relaxed; 77 declared foreign keys are removed under a doctrine (identity strings are values, not keys, because only the dashboard layout provisions a profile; append-only evidence carries identifiers, not keys), 30 enforced legacy identity keys stay declared. Platform 0066 to 0069 (guarded, tagged, reversible) create 797 indexes, add 36 checks and 293 foreign keys NOT VALID and validate them, and set 157 declared NOT NULL columns, fail-closed on a violating row. NOT NULL is applied only where no live Django ViewSet can write the table (the database may not be stricter than the loosest legitimate writer; payments.amount is open on purpose because platform 0015 and the authority-kernel proof rely on a payment without an amount). Applying all 286 broke ten native files; each failure was resolved on its merits (a fixture that named a congress that is not an organization, a reversibility test that assumed no later migration, and the Django API contract above). Measured on a fresh PG16 and PG15: strict 0; FK 0, index 0, time zone 0, check 0, unvalidated 0; NOT NULL 129 (128 on live Django tables, 1 deliberate).',
  remaining:
    'The Django models are ported stubs (278 of the 286 NOT NULL targets are null=True there; Django knows none of the 2,343 columns tranche 6 added): they need regenerating from the database, and the 128 open NOT NULL columns close with them. One identity-reference policy for the platform needs a profile provisioned at the identity authority for every principal. The 14 contested relations (13 SHAPE_DRIFT, 19 VARIANT_REQUIRED), the pgvector readers, the 116 deny-all relations and the platform-economics routes. Native proof reaches only what the 592 native tests run: a route no native test reaches is not proven. Exact-SHA CI for the final head; real-login journeys, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === tranche7.id)
if (index === -1) ledger.crossCuttingSourceEvidence.push(tranche7)
else ledger.crossCuttingSourceEvidence[index] = tranche7
console.log(index === -1 ? 'added' : 'replaced', tranche7.id, `(${files.length} files)`)
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
