const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const evidenceFile = 'docs/union-eyes/convergence/remediation/evidence/ue-convergence-tranche-4-reachable-stub-shape-20261101.md'

const files = [
  A + 'db/migrations-platform/0060_reachable_stub_shape_2.sql',
  A + 'db/migrations-platform/0060_reachable_stub_shape_2.rollback.sql',
  A + 'db/__tests__/reachable-stub-shape-2.postgres.test.ts',
  A + 'scripts/generate-stub-evolution.ts',
  A + 'scripts/runtime/orm-select-probe.ts',
]
for (const f of [...files, evidenceFile]) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

// The defect whose recorded remaining item concerned the shape this migration delivers. Its status does not change and nothing is credited:
// the routes have not yet been run against the real table, so the remaining item is restated, not removed.
addBatch({
  id: 'B128-CONVERGENCE-TRANCHE-4-REACHABLE-STUB-SHAPE',
  family: 'Django and Drizzle convergence: thirteen reachable stub relations take their declared shape (platform 0060); no defect credit',
  test: A + 'db/__tests__/reachable-stub-shape-2.postgres.test.ts',
  previousEvidence: { 'B127-CI-REPAIR-SHARE-ROUTE-AUDIT-TEST-ORDER': 'c0b97cfc9' },
  items: [
    {
      prefix: 'DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files,
      explanation:
        'B128: platform 0060_reachable_stub_shape_2 gives arbitration_decisions every column its Drizzle declaration names (34 named; 31 added on a freshly built database, the other three, is_public, access_restrictions and imported_from, come from 0051 and are only type-checked) and the id, created_at and updated_at defaults. It is additive, guarded by a snapshot that fails the transaction if any constraint, index, policy, grant or row-security setting changes, and reversible: the rollback removes only the columns and enum types it tagged. A plain Drizzle select through the declaration now succeeds on PG15 and PG16 as the owner and as the runtime role, which holds SELECT on the relation (reachable-stub-shape-2.postgres.test.ts, which fails on the pre-0060 database with the original defect). This meets the shape prerequisite the remaining item named. It is not proof that the library routes work.',
      remaining:
        'Platform 0060 now supplies the shape of arbitration_decisions, so the combined bootstrap no longer leaves it a Django stub. Still open: the precedent service and the two library routes (arbitration/precedents collection and item) have not been run against the real table under the real roles, so owner, public, restricted and cross-tenant reads and the owner-scoped writes are not yet proven natively. Platform 0060 is registered UNQUALIFIED and has not been qualified on a staging clone.',
    },
  ],
})

// Source evidence for the whole tranche, with no defect or closure credit.
const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
const recordId = 'UE-CONVERGENCE-TRANCHE-4-REACHABLE-STUB-SHAPE-20261101'
if (!ledger.crossCuttingSourceEvidence.some((entry) => entry.id === recordId)) {
  ledger.crossCuttingSourceEvidence.push({
    id: recordId,
    status: 'SOURCE_CHANGED_NATIVE_PG15_PG16_TESTS_AUTHORED_NOT_QUALIFIED',
    defectCredit: 0,
    closureCredit: 0,
    defectReference: 'DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT',
    evidenceFile,
    sourceBaseline: 'c0b97cfc9020b8e78440e7ff4e55b1ee4a0265bc',
    files: [
      ...files,
      'docs/union-eyes/convergence/register/ue-canonical-schema-census.json',
      'docs/union-eyes/convergence/register/ue-canonical-schema-disposition.json',
      'docs/union-eyes/convergence/register/ue-schema-mutation-batches.json',
      A + 'db/__tests__/schema-mutation-batches.test.ts',
    ],
    correction:
      'Thirteen reachable Django-defined relations (alert_rules, arbitration_decisions, automation_rules, case_studies, clc_organization_sync_log, cost_of_living_data, external_data_sync_log, provincial_privacy_config, reserved_matter_votes, support_tickets, union_density, wage_benchmarks, webhook_receipts) take the shape their Drizzle declarations select and write. Measured on databases built from scratch by Django migrate plus the approved bootstrap, PG16 and PG15: plain-select failures 203 to 190, reachable and failing 78 to 65, parity findings 2,758 to 2,519 (MISSING_COLUMN -205, NO_DB_DEFAULT -34), the thirteen relations at zero and nothing else changed. The census shrinks 231 to 202: 13 exits are earned by 0060, 16 were stale baseline entries (9 retired declarations, 7 already evolved by earlier migrations), computed against the pre-0060 database. The migration changes no access (guard, native snapshot test, unchanged catalog contract).',
    remaining:
      'Route-level native proof of the precedent library on the converged table; the 65 reachable declarations that still fail a plain select (33 relations Django never created, 32 contained, individual-decision, finance-frozen or owned by another change); NO_DB_DEFAULT and TYPE_MISMATCH outside the census ratchet; staging-clone qualification of 0060; independent reviewer. No defect or CLOSED credit.',
  })
  fs.writeFileSync(ledgerFile, JSON.stringify(ledger, null, 2) + '\n')
  console.log(recordId, 'recorded')
}
