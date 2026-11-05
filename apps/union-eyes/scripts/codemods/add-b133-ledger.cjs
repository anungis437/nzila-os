const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const platformCommit = process.env.UE_TRANCHE8_PLATFORM_COMMIT
const djangoCommit = process.env.UE_TRANCHE8_DJANGO_COMMIT
for (const [name, value] of [['UE_TRANCHE8_PLATFORM_COMMIT', platformCommit], ['UE_TRANCHE8_DJANGO_COMMIT', djangoCommit]]) {
  if (!/^[0-9a-f]{40}$/.test(value ?? '')) throw new Error(`set ${name} to the 40-character sha of the pushed tranche 8 commit`)
}

// The files are read from the commits, so the evidence commit and every affected source file are recoverable programmatically.
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
git('cat-file', '-e', `${platformCommit}^{commit}`)
git('cat-file', '-e', `${djangoCommit}^{commit}`)
const baseline = git('rev-parse', `${platformCommit}^`)
const files = git(
  'diff',
  '--name-only',
  baseline,
  djangoCommit,
  '--',
  'apps/union-eyes',
  'docs/union-eyes/convergence/remediation/evidence',
  'tooling/scripts/lib/ue-approved-migration-lineage.json',
  '.github/workflows/ue-native-postgres.yml',
)
  .split('\n')
  .filter(Boolean)
for (const required of [
  'apps/union-eyes/db/migrations-platform/0070_unambiguous_constraints.sql',
  'apps/union-eyes/db/migrations-platform/0071_conservative_consent_defaults.sql',
  'apps/union-eyes/backend/core/management/commands/ue_physical_parity.py',
  'apps/union-eyes/backend/core/management/commands/ue_converge_models.py',
  'apps/union-eyes/backend/core/management/commands/ue_state_migrations.py',
  'apps/union-eyes/backend/core/test_runner.py',
  'apps/union-eyes/backend/core/api_surface.json',
  'apps/union-eyes/db/__tests__/django-model-parity.postgres.test.ts',
  'apps/union-eyes/db/__tests__/platform-0070-0071.postgres.test.ts',
  'apps/union-eyes/db/__tests__/schema-convergence.postgres.test.ts',
  '.github/workflows/ue-native-postgres.yml',
]) {
  if (!files.includes(required)) throw new Error(`the tranche 8 commits do not change ${required}`)
}

// No frozen defect is credited: this is schema convergence (verification and repair infrastructure), so it belongs with the cross-cutting records.
const tranche8 = {
  id: 'UE-DJANGO-MODEL-CONVERGENCE-PLATFORM-0070-0071-20261102',
  status: 'SOURCE_CHANGED_NATIVE_LOCAL_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-django-model-convergence-20261102.md',
  sourceBaseline: baseline,
  sourceCommit: djangoCommit,
  platformSourceCommit: platformCommit,
  files,
  correction:
    'The Django models, the API they feed, the migration history and the Django suite now agree with the converged database. New measurement manage.py ue_physical_parity (524 models): 1,216 strict findings and 4,050 unknown columns at the start, 0 strict now (advisory TIMESTAMP_NAIVE 361 and NOT_NULL_ABSENT 10 pinned). Models: 5,103 columns added, 157 null=True removed over NOT NULL columns, enum, array and unbounded numeric fields expressed, 54 defaults converged. API: every reachable serializer that said fields = __all__ (284 of 289) lists exactly what it produced at HEAD and nothing is added (many are IsAuthenticated only and scope no tenant); 148 bare .values() calls name their columns; credentials are write-only in all 15 serializers that have one; compliance.BreakGlassActivations.secret_shares, which a contained endpoint projected at HEAD, is excluded. Migration history: 12 generated state-only migrations (5,478 operations) that change no column, constraint or index (catalog digest of 15,815 objects identical before and after migrate). Platform 0070 leaves one foreign key per column (eight columns carried two; five grievance tables carried a Django key to claims.id beside the declared key to claims.claim_id, which no row can satisfy, so none of them could be written), drops seven duplicate index definitions and validates two CHECK constraints earlier migrations left NOT VALID; platform 0071 moves six defaults that asserted a consent, an outcome or tracking by omission to false (existing rows untouched). Tests: ConvergedSchemaRunner clones the converged database (faithful, what CI runs) or patches a migrations-only database (fast); create_valid builds rows from the catalog; the suite was an ImportError before and ran 1,321 tests with 3 failures and 29 errors when collected by hand, and is 1,470 tests with 0 failures in both modes; ue-native-postgres.yml now runs it against a clone of the converged database. Native: django-model-parity, platform-0070-0071 and the schema-convergence invariants and round trip.',
  remaining:
    'The measurement was wrong once (one foreign-key target per column) and the suite found it; the physical invariant is now also asserted natively. TIMESTAMP_NAIVE (361 naive timestamp columns under a DateTimeField), NOT_NULL_ABSENT (10, plus the 128 declared NOT NULL columns open on live Django tables), the 14 contested relations, the pgvector readers, the identity-reference policy and the route proofs. A finding not fixed here: 64 call sites in 15 services/api view modules create a row from every key of the request body, 48 of them in 12 modules that are IsAuthenticated only, and only governance-service has a TypeScript consumer; it is the next tranche. Whether a default channel or newsletter consent is acceptable (communication_preferences, true in every layer) is a legal decision. Native proof reaches only what the native tests run; exact-SHA CI for the final head; real-login journeys, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === tranche8.id)
if (index === -1) ledger.crossCuttingSourceEvidence.push(tranche8)
else ledger.crossCuttingSourceEvidence[index] = tranche8
console.log(index === -1 ? 'added' : 'replaced', tranche8.id, `(${files.length} files)`)
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
