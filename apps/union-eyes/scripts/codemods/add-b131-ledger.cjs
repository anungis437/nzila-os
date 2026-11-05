const fs = require('fs')
const path = require('path')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const sourceCommit = process.env.UE_TRANCHE6_SOURCE_COMMIT
if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) throw new Error('set UE_TRANCHE6_SOURCE_COMMIT to the 40-character sha of the pushed tranche 6 source commit')

const tranche5Files = [
  'apps/union-eyes/db/migrations-platform/0061_declared_absent_relations.sql',
  'apps/union-eyes/db/migrations-platform/0061_declared_absent_relations.rollback.sql',
  'apps/union-eyes/db/migrations-cache/0052_declared_absent_relations_rls_closure.sql',
  'apps/union-eyes/db/migrations-cache/0052_declared_absent_relations_rls_closure.rollback.sql',
  'apps/union-eyes/scripts/generate-relation-create.ts',
  'apps/union-eyes/lib/api/crud-factory.ts',
  'apps/union-eyes/lib/api/crud-write-values.ts',
  'apps/union-eyes/lib/api/db-client-errors.ts',
  'apps/union-eyes/lib/db/sql-in.ts',
  'apps/union-eyes/lib/db/__tests__/array-parameters.test.ts',
  'apps/union-eyes/app/api/dues/deductions/route.ts',
  'apps/union-eyes/app/api/dues/issues/route.ts',
  'apps/union-eyes/db/__tests__/native-route-harness.ts',
  'apps/union-eyes/db/__tests__/declared-absent-relations.postgres.test.ts',
  'apps/union-eyes/db/__tests__/health-safety-routes.postgres.test.ts',
  'apps/union-eyes/db/__tests__/dues-portal-routes.postgres.test.ts',
  'apps/union-eyes/db/__tests__/cba-intelligence-pipeline.postgres.test.ts',
  'apps/union-eyes/db/__tests__/sql-in.postgres.test.ts',
]

const tranche6Files = [
  'apps/union-eyes/db/migrations-platform/0062_declared_enum_convergence.sql',
  'apps/union-eyes/db/migrations-platform/0062_declared_enum_convergence.rollback.sql',
  'apps/union-eyes/db/migrations-platform/0063_declared_shape_convergence.sql',
  'apps/union-eyes/db/migrations-platform/0063_declared_shape_convergence.rollback.sql',
  'apps/union-eyes/db/migrations-platform/0064_declared_unique_keys.sql',
  'apps/union-eyes/db/migrations-platform/0064_declared_unique_keys.rollback.sql',
  'apps/union-eyes/db/migrations-platform/0065_declared_absent_relations_2.sql',
  'apps/union-eyes/db/migrations-platform/0065_declared_absent_relations_2.rollback.sql',
  'apps/union-eyes/scripts/runtime/schema-convergence.ts',
  'apps/union-eyes/scripts/runtime/orm-physical-parity.ts',
  'apps/union-eyes/scripts/generate-declared-convergence.ts',
  'apps/union-eyes/scripts/generate-relation-create.ts',
  'apps/union-eyes/scripts/codemods/retype-text-ids-to-uuid.cjs',
  'apps/union-eyes/db/__tests__/schema-convergence.postgres.test.ts',
  'apps/union-eyes/db/__tests__/schema-convergence-behaviour.postgres.test.ts',
  'apps/union-eyes/db/__tests__/cookie-consent-route.postgres.test.ts',
  'apps/union-eyes/db/__tests__/schema-mutation-batches.test.ts',
  'apps/union-eyes/db/__tests__/reachable-stub-shape-2.postgres.test.ts',
  'apps/union-eyes/lib/gdpr/consent-manager.ts',
  'apps/union-eyes/lib/gdpr/__tests__/consent-manager.test.ts',
  'apps/union-eyes/db/rls-storage-authority/communications-notifications.ts',
  'apps/union-eyes/db/rls-storage-authority/documents-evidence.ts',
  'apps/union-eyes/lib/db/__tests__/array-parameters.test.ts',
  'apps/union-eyes/services/clc/remittance-exporter.ts',
  'apps/union-eyes/services/financial-service/src/routes/arrears.ts',
  'apps/union-eyes/lib/integrations/adapters/accounting/sync-utils.ts',
  'docs/union-eyes/convergence/remediation/evidence/ue-declared-convergence-input-20261101.json',
]
for (const f of [...tranche5Files, ...tranche6Files]) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

// No frozen defect is credited: this is schema convergence (verification and repair infrastructure), so it belongs with the cross-cutting records.
const tranche5 = {
  id: 'UE-DECLARED-ABSENT-RELATIONS-PLATFORM-0061-CACHE-0052-20261101',
  status: 'SOURCE_CHANGED_NATIVE_PG15_PG16_EXACT_SHA_CI_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-declared-absent-relations-20261101.md',
  sourceBaseline: 'e371980be7436ab004232d1bfb305b5f6fab9fb3',
  sourceCommit: '5dfbd44677d7880453534182f73b1eb3043e79e1',
  files: tranche5Files,
  correction:
    'The 23 relations that Drizzle declarations name and no migration or Django creates (twelve the manifest classifies and eleven shared CBA intelligence reference relations) are created by platform 0061 (24 enum types, 69 indexes, 16 foreign keys; fail-closed, tagged, reversible, every privilege revoked) and given their row-security floor by cache 0052. Running the unmodified routes and services on the real schema as the real roles found and fixed: the generic CRUD factory handing JSON timestamps to the driver as text and answering 500 for client errors, the dues portal reading the wrong envelope and exposing internal columns, and `ANY(${array})` reaching PostgreSQL as `ANY(($1,$2))` in ten services (the CBA benchmark had never run). Census 202 to 179; the post-apply verifier reports 0 missing and 0 extra on fresh PG15 and PG16. Exact-SHA CI at 5dfbd4467: Native PostgreSQL Acceptance (PG15 and PG16), Security Regression, runtime-governance-attestation, App Floor Check and the UE Whole Contract Test Suite pass.',
  remaining:
    'Fourteen relations no migration created and every column and default the stubs lack (tranche 6); real-login journeys, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const tranche6 = {
  id: 'UE-DECLARED-PHYSICAL-CONVERGENCE-PLATFORM-0062-0065-20261101',
  status: 'SOURCE_CHANGED_NATIVE_PG15_PG16_LOCAL_PASS_NOT_QUALIFIED',
  defectCredit: 0,
  closureCredit: 0,
  evidenceFile: 'docs/union-eyes/convergence/remediation/evidence/ue-declared-physical-convergence-20261101.md',
  sourceBaseline: '5dfbd44677d7880453534182f73b1eb3043e79e1',
  sourceCommit,
  files: tranche6Files,
  correction:
    'Every Drizzle declaration under db/schema (623 physical relations across 267 files, not the 555 the barrel exports) is now measured against the database Django migrate plus the approved bootstrap builds, by scripts/runtime/schema-convergence.ts. Platform 0062 to 0065 (guarded, tagged, reversible) close every strict class: 2,343 missing columns, 719 NOT NULL columns with no default that the ORM omits, 46 declared defaults the database silently dropped, 118 required columns no declaration can fill, 88 declared unique keys with no index, 8 narrow columns (one dropped two decimals of a per-capita rate), 5 mistyped columns, 40 enum types and 3 missing members (the grievance conversion events), and the last 14 relations no migration created. Declarations that lied about the database are corrected (62 text-for-uuid columns, a jsonb array, a time-dependent CHECK, four Django column names). Defects found by running the unmodified code: the public cookie-consent route answered 500 to every visitor (the system role had no grant on the table, and user_id is a foreign key to profiles.id, not the identity string), the intake-to-case conversion failed on its array column and enum events, every webhook insert failed on a uuid key that holds provider ids, and three finance statements the earlier ratchet had pinned under the finance freeze (lifted) failed on ANY(array). The canonical schema census goes from 179 entries to 0; plain select over the barrel fails for 1 of 568 declared tables (knowledge_base.embedding where pgvector is absent), down from 167. Native proof: schema-convergence (4), schema-convergence-behaviour (6), cookie-consent-route (5), and the whole native project on fresh PG16 and PG15.',
  remaining:
    'Fourteen relations are declared by more than one non-identical declaration (two features collide on automation_rules); 19 NOT NULL columns some declarations omit cannot be closed in the database without loosening a real constraint. Foreign keys (370), indexes (794), declared NOT NULL (286), timestamp without time zone over timestamptz (420) and checks (36) are measured and pinned as advisory classes, not closed. The pgvector column exists only where the server offers the extension and its readers do not yet cope with its absence. The 11 public platform-economics relations stay closed (LATENT_UNREACHABLE) while the census marked 22 routes as reaching them; those routes are not run against the real tables. The 116 relations the manifest still holds deny-all keep no grants. Exact-SHA CI for the final head; real-login journeys, immutable-audit and staging acceptance; independent reviewer. No defect or CLOSED credit.',
}

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
for (const entry of [tranche5, tranche6]) {
  const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === entry.id)
  if (index === -1) ledger.crossCuttingSourceEvidence.push(entry)
  else ledger.crossCuttingSourceEvidence[index] = entry
  console.log(index === -1 ? 'added' : 'replaced', entry.id)
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
