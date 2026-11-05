const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')

const sourceCommit = process.env.UE_TRANCHE10_SOURCE_COMMIT
if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) throw new Error('set UE_TRANCHE10_SOURCE_COMMIT to the 40-character sha of the pushed tranche 10 source commit')

// The files are read from the commit, so the evidence commit and every affected source file are recoverable programmatically.
const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).trim()
git('cat-file', '-e', `${sourceCommit}^{commit}`)
const baseline = git('rev-parse', `${sourceCommit}^`)
const files = git('diff', '--name-only', baseline, sourceCommit, '--', 'apps/union-eyes', 'docs/union-eyes/convergence/remediation/evidence', 'docs/union-eyes/convergence/RUNTIME-ACCEPTANCE.md')
  .split('\n')
  .filter(Boolean)
const evidence = (name) => `docs/union-eyes/convergence/remediation/evidence/${name}`
const require_ = (list) => {
  for (const required of list) if (!files.includes(required)) throw new Error(`the tranche 10 source commit does not change ${required}`)
}

// No frozen defect is credited: these are cross-cutting source records (the convergence of the declarations, the models and the database, a missing capability, a driver hazard).
const tranche10 = [
  {
    id: 'UE-NOT-NULL-DEFAULTS-CONVERGENCE-20261102',
    required: [
      'apps/union-eyes/db/migrations-platform/0072_declared_not_null_2.sql',
      'apps/union-eyes/db/migrations-platform/0073_declared_defaults.sql',
      'apps/union-eyes/db/migrations-platform/0074_model_defaults_physical.sql',
      'apps/union-eyes/db/__tests__/platform-0072-0074.postgres.test.ts',
      'apps/union-eyes/app/api/governance/reserved-matters/route.ts',
      'apps/union-eyes/backend/core/model_nullability.json',
      evidence('ue-not-null-defaults-convergence-20261102.md'),
    ],
    evidenceFile: evidence('ue-not-null-defaults-convergence-20261102.md'),
    correction:
      'The declarations, the Django models and the database disagreed about strictness: 136 declared NOT NULL columns were nullable, 35 declared defaults and 35 Django-only defaults were not physical (so the TS mission-audits route could never insert), 68 Django defaults the platform does not declare, 128 Django fields looser than their column. Platform 0072 makes the 136 columns NOT NULL (fail-closed: a NULL stops it and nothing is invented), 0073 makes the 35 declared defaults physical, 0074 the 35 model defaults; the Django models drop the 68 and tighten the 128, the 12 state-only migrations are regenerated and the API surface is diffed against the frozen contract (71 fields newly required, 1 optional, nothing newly exposed). Strict parity 0; NOT_NULL_ABSENT 1 (payments.amount, deliberate). The same measurement found a route that could never insert (POST /api/governance/reserved-matters named no NOT NULL proposed_date and stored NULL in NOT NULL voting_deadline): the INSERT writes proposed_date, the body requires a deadline, the console refuses an empty one. A regression the change caused (organizations.hierarchy_path, the auth webhook: 17 test errors) was found by the Django suite and fixed with a create-time default; one test that asserted a dropped default was replaced and disclosed; eight native test files whose fixtures inserted rows without the columns 0072 made NOT NULL (found by the first full native run, not the targeted ones) now supply them, no assertion weakened. Django 1,483 tests OK, 15 skipped; native platform-0072-0074 and django-model-parity pass on PostgreSQL 16.',
    remaining:
      'TIMESTAMP_NAIVE (361) is not retyped; the 14 contested relations are not unified; Django on_delete against the physical foreign-key rule is not measured. PostgreSQL 15 not run locally. No HTTP-level proof. Exact-SHA CI for the final head; independent reviewer. No defect or CLOSED credit.',
  },
  {
    id: 'UE-ENHANCED-RBAC-RELATIONS-20261102',
    required: [
      'apps/union-eyes/db/schema/domains/member/enhanced-rbac.ts',
      'apps/union-eyes/db/migrations-platform/0075_enhanced_rbac_relations.sql',
      'apps/union-eyes/db/migrations-platform/0076_enhanced_rbac_catalog.sql',
      'apps/union-eyes/db/migrations-cache/0053_enhanced_rbac_rls_closure.sql',
      'apps/union-eyes/db/queries/enhanced-rbac-queries.ts',
      'apps/union-eyes/db/queries/__tests__/enhanced-rbac-queries.test.ts',
      'apps/union-eyes/db/__tests__/enhanced-rbac.postgres.test.ts',
      'apps/union-eyes/db/__tests__/platform-0075-0076.postgres.test.ts',
      'apps/union-eyes/db/__tests__/migration-file-shape.test.ts',
      'apps/union-eyes/lib/auth/__tests__/role-catalog-consistency.test.ts',
      evidence('ue-enhanced-rbac-relations-20261102.md'),
    ],
    evidenceFile: evidence('ue-enhanced-rbac-relations-20261102.md'),
    correction:
      'The enhanced RBAC (role_definitions, member_roles, permission_exceptions, rbac_audit_log) was declared and used by lib/api-auth-guard.ts and lib/enterprise-role-middleware.ts and did not exist: no declaration, migration, model or manifest entry, so every call would have failed and the audit failure was swallowed; the query module could not have worked had the tables existed (snake_case rows against camelCase interfaces, an unbindable INTERVAL, two views that existed nowhere, a base64-prefix "hash chain", writes under the tenant role naming no organization). Built: Drizzle declarations, platform 0075 (4 relations, CHECK constraints, partial unique index, identity sequence) and 0076 (append-only and member-organization triggers, 11 organization roles seeded from the code and no platform role), cache 0053 (FORCE RLS), four manifest entries with the tenant runtime role SELECT-only and every write under the system role naming the organization, and a rewritten query module and middleware (SHA-256 audit chain under a per-organization advisory lock, verification that recomputes every hash). The native proof (26 of 26 on PostgreSQL 16, as the real runtime and system roles) found five defects no mock could, each fixed and pinned: a raw Date parameter that crashed every audit write (UE-RAW-DATE-PARAMETERS-20261102), raw timestamps and bigint returned as text, revocation of a role that has not started violating the end-after-start check, and the app clock instead of the database clock starting a term and an exception. Executing the rollbacks (11 more native tests) found that the generated 0075 rollback could never run (an untyped empty array, 42P18; fixed in scripts/generate-relation-create.ts) and that 0076 was not runnable as one script (now terminated; db/__tests__/migration-file-shape.test.ts holds both shapes across all 200 platform and cache migration files).',
    remaining:
      'No route adopts the enhanced wrappers and no administrative surface assigns roles (a product decision). No Django model, by design. clerk is absent from ROLE_HIERARCHY in lib/api-auth-guard.ts (every minimum-role check reads it as level 0; adding it widens finance access) and ROLE_HIERARCHY disagrees with getRoleLevel() for the platform roles: pinned in lib/auth/__tests__/role-catalog-consistency.test.ts, not changed. PostgreSQL 15 not run locally. No HTTP-level proof. Exact-SHA CI for the final head; independent reviewer. No defect or CLOSED credit.',
  },
  {
    id: 'UE-RAW-DATE-PARAMETERS-20261102',
    required: [
      'apps/union-eyes/db/driver-dates.ts',
      'apps/union-eyes/db/db.ts',
      'apps/union-eyes/db/system-db.ts',
      'apps/union-eyes/lib/database/multi-db-client.ts',
      'apps/union-eyes/db/__tests__/driver-dates.test.ts',
      'apps/union-eyes/db/__tests__/driver-raw-dates.postgres.test.ts',
      'apps/union-eyes/scripts/runtime/raw-date-params.ts',
      evidence('ue-raw-date-parameters-20261102.md'),
    ],
    evidenceFile: evidence('ue-raw-date-parameters-20261102.md'),
    correction:
      'A Date interpolated into a raw drizzle sql template reaches postgres.js unserialized (drizzle installs identity serializers for timestamptz, timestamp and date because it encodes through column mappers) and the driver throws ERR_INVALID_ARG_TYPE. Found by the enhanced RBAC native proof; measured by type with the TypeScript checker over every sql tagged template (3,915 files, 1,113 templates): 58 raw Date parameters in 13 production files (the rewards analytics page, deadline queries, rewards export, engagement scoring, scheduled reports, billing, per-capita calculator, board packet, the document-intake retry sweep, mobile engine, admin actions), invisible to mock-based unit tests. db/driver-dates.ts serializeRawDates keeps drizzle\'s own encoding and sends a Date as its ISO instant, and is applied after drizzle() by all four clients that build drizzle over postgres.js (tenant, system, multi-db, test). 9 unit tests (the helper, and that every production factory applies it and that no other module builds such a client) and 5 native tests on PostgreSQL 16 with the production options, including a canary that a bare drizzle client still refuses a Date.',
    remaining:
      'Not proven per call site or over HTTP; a raw execute still returns timestamps and dates as the server\'s text (code that reads one as a Date is a different class, not measured). The command-line tools and services/financial-service build their own clients and are not covered. The type-aware scan is informational and not run in CI. Exact-SHA CI for the final head; independent reviewer. No defect or CLOSED credit.',
  },
]

const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
for (const item of tranche10) {
  require_(item.required)
  const entry = {
    id: item.id,
    status: 'SOURCE_CHANGED_NATIVE_LOCAL_PASS_NOT_QUALIFIED',
    defectCredit: 0,
    closureCredit: 0,
    evidenceFile: item.evidenceFile,
    sourceBaseline: baseline,
    sourceCommit,
    files,
    correction: item.correction,
    remaining: item.remaining,
  }
  const index = ledger.crossCuttingSourceEvidence.findIndex((existing) => existing.id === entry.id)
  if (index === -1) ledger.crossCuttingSourceEvidence.push(entry)
  else ledger.crossCuttingSourceEvidence[index] = entry
  console.log(index === -1 ? 'added' : 'replaced', entry.id, `(${files.length} files)`)
}
fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
