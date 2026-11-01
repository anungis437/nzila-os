const fs = require('fs')
const path = require('path')
const { addBatch } = require('./f06-ledger-lib.cjs')
const A = 'apps/union-eyes/'
const root = path.resolve(__dirname, '../../../../')
const ledgerFile = path.resolve(root, 'docs/union-eyes/convergence/remediation/elimination-batches.json')
const register = JSON.parse(fs.readFileSync(path.resolve(root, 'docs/union-eyes/convergence/register/ue-route-classification-0c1.json'), 'utf8')).defectRegister

// An item already in the ledger loses its remaining text unless it is given again, so the current text is read back and restated unchanged.
const currentRemaining = (prefix) => {
  const id = register.filter((d) => d.id.startsWith(prefix)).map((d) => d.id)[0]
  const ledger = JSON.parse(fs.readFileSync(ledgerFile, 'utf8'))
  const entry = ledger.batches.flatMap((b) => b.items).find((i) => register.some((d) => d.id === id && d.id.startsWith(i.prefix)))
  if (!entry) throw new Error('not in the ledger: ' + prefix)
  return entry.remaining
}

const slaClock = [
  A + 'scripts/runtime/db-inspect.ts',
  A + 'scripts/runtime/__tests__/db-inspect-qa-clock.test.ts',
  A + 'db/__tests__/qa-case-aging.postgres.test.ts',
  A + 'db/migrations-platform/0049_claim_status_transitions.sql',
]

const scimEvents = [
  A + 'lib/scim/events-log.ts',
  A + 'lib/scim/__tests__/provisioned-members.test.ts',
  A + 'app/api/__tests__/scim-users.route.test.ts',
  A + 'app/api/__tests__/scim-user-by-id.route.test.ts',
]

for (const f of [...slaClock, ...scimEvents]) if (!fs.existsSync(path.resolve(root, f))) throw new Error('missing file ' + f)

addBatch({
  id: 'B126-CI-REPAIR-QA-CLOCK-SCIM-EVENT-ORDER-AND-ORGANIZATION-TEST-STUBS',
  family: 'CI repair after B124 and B125: the acceptance fixture that ages a case, the order of the events of one SCIM request, and test stubs that predate the organization-create transaction',
  test: A + 'db/__tests__/qa-case-aging.postgres.test.ts',
  previousEvidence: { 'B125-F03-B-FEDERATION-AND-CONGRESS-LEVELS-WITHDRAWN-EVERYWHERE': '3e1829561' },
  items: [
    {
      prefix: 'DEF-0B6-SYS-SLA-CLOCK-RESTARTS-ON-ANY-CLAIM-UPDATE',
      status: 'IMPLEMENTED_PENDING_QUALIFICATION',
      files: slaClock,
      explanation:
        'B126: the clock this defect introduced (claims.status_changed_at, kept by a trigger that ignores any write to it that does not come with a change of status) broke the acceptance fixture that simulates elapsed time: ageQaCase wrote the column directly, so it silently changed nothing, and in the CI run of 1c918f5f6 two HTTP and browser journeys (the case lifecycle and the intake-to-escalation journey) answered 422 with 72 hours remaining after they had aged the case by 72 hours. The fixture now writes the clock in one transaction with triggers off as the harness superuser (session_replication_role is local to the transaction), moves the latest recorded transition with it so the history and the clock agree, and rolls back as a whole when the case is not a QA case. The clock stays tamper-proof for every other caller: a native control proves that a plain write is still ignored, that a real change of status stamps the clock again after the fixture, and that nothing the fixture switches on outlives it (five tests on native PostgreSQL 15 and 16, run twice; the unit test pins the transaction). Replaced test, disclosed: db-inspect-qa-clock.test.ts pinned a single UPDATE as the first query and now pins the transaction and the history move.',
      remaining: currentRemaining('DEF-0B6-SYS-SLA-CLOCK-RESTARTS-ON-ANY-CLAIM-UPDATE'),
    },
    {
      prefix: 'DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION',
      status: 'PARTIAL',
      files: scimEvents,
      explanation:
        'B126: the events of one request keep their order. created_at of a scim_events_log row is now the moment of the event (clock_timestamp) instead of the start of the transaction (now), so an update followed by a deprovision in one PATCH no longer tie in the log (the CI run of 1c918f5f6 read them in the wrong order). Tests made deterministic, disclosed: the SCIM route tests seeded 24 people in separate statements that tied on creation time under the coarser clock of CI and asserted their insertion order, and read the events by (created_at, id), where id is random; they now seed distinct creation times and read events in insertion order (created_at, ctid), and the paging test of the data layer does the same. The production list order, (created_at, id), is a total order, so paging is stable; only the tests assumed an order the data did not state.',
      remaining: currentRemaining('DEF-0B11-IDS-SCIM-ROUTE-HAS-NO-BEARER-AUTHENTICATION'),
    },
  ],
})
