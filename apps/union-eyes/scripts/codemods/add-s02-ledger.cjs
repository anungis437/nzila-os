const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S02-DATABASE-ENFORCEMENT-MIGRATION-0040'
const known = (start) => {
  for (const b of ledger.batches) for (const i of b.items) if (i.prefix.startsWith(start)) return i.prefix
  throw new Error('no earlier item ' + start)
}
if (!ledger.batches.some((x) => x.id === id)) {
  const mig = [A + 'db/migrations-platform/0040_gate0_integrity_enforcement.sql', A + 'db/migrations-platform/0040_gate0_integrity_enforcement.rollback.sql', A + 'db/__tests__/platform-0040-gate0-integrity-enforcement.pglite.test.ts']
  const test = A + 'lib/services/__tests__/s2-database-enforcement.test.ts'
  const item = (start, files, explanation, extra = {}) => ({ prefix: known(start), status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, ...mig, test], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'Database enforcement: constraints, triggers and columns that settle what application checks could only attempt',
    evidenceCommit: null,
    items: [
      item('DEF-0B6-EMP-REPLAY-MODE-MISRECORDED', [A + 'db/schema/domains/employer-execution/employer-artifacts.ts', A + 'app/api/employer-execution/replay/[runId]/route.ts'],
        'Migration 0040 adds new_engine to employer_execution_replay_mode, so an engine-change replay is stored as new_engine and not as a faithful exact re-run. Proven on PGlite; the requested mode still travels with the diff for idempotency.'),
      item('DEF-0B6-EDU-REGISTRATION-NO-CAPACITY-DUPLICATE-OR-SESSION-COURSE-CHECK', [A + 'app/api/education/registrations/route.ts', A + 'lib/api/crud-factory.ts', A + 'lib/db/unique-violation.ts', A + 'db/schema/domains/scheduling/training.ts', A + 'db/schema/education-training-schema.ts'],
        'Migration 0040 adds a unique index (organization, member, session) that refuses to apply over existing duplicates, and a BEFORE INSERT/UPDATE trigger that locks the session row and refuses a registration beyond max_enrollment (SQLSTATE 23514); a cancelled place frees a seat and a re-save of a registered row is not recounted. The CRUD factory gains mapCreateError so a lost race answers 409 (full, or already registered). Proven on PGlite.'),
      item('DEF-0B9-ML-SLA-CASE-ID-IS-NEVER-VERIFIED', [A + 'db/schema/domains/ml/predictions.ts', A + 'app/api/ml/predictions/sla-breach-risk/route.ts'],
        'Migration 0040 adds ml_predictions.subject_id. The case is verified against the organization (B08) and is now stored on the prediction row, and the audit entry and feedback carry it.'),
      item('DEF-0B9-ML-SLA-FEEDBACK-IS-REPEATABLE-CALLER-STATED-VERSION-UNBOUND', [A + 'db/schema/domains/ml/predictions.ts', A + 'app/api/ml/predictions/sla-breach-risk/route.ts', A + 'app/api/ml/predictions/sla-breach-risk/feedback/route.ts', A + 'app/api/__tests__/sla-breach-risk-feedback.route.test.ts'],
        'Migration 0040 adds ml_predictions.model_version, written by the prediction route. Feedback now defaults to the version the prediction recorded and refuses (409) a different one, so the version binding no longer depends on a column that was missing. The route test zod mock gained optional() on min() (disclosed).'),
      {
        prefix: known('DEF-0B11-PRP-REWARDS-CRON-EXPIRATION-TASK-READS-AN-EXPIRY'),
        status: 'PARTIAL',
        files: [A + 'lib/services/rewards/notification-service.ts', A + 'lib/services/rewards/expiry-warning-marker.ts', A + 'lib/services/rewards/__tests__/expiration-warnings.pglite.test.ts', A + 'lib/services/rewards/__tests__/notification-service.test.ts', test],
        explanation: 'The durable sent marker needed no new table: the warning is also the member\'s in-app notice, recorded in in_app_notifications under data.dedupeKey (unique per organization and member, migration 20261103) before the mail leaves; a second run, retry or overlap mails nothing more, and a failed send releases the record so the next run tries again. Proved on PostgreSQL (PGlite) for repeat, retry-after-failure and per-tier behaviour. The mocked notification-service test now mocks the marker (disclosed).',
        remaining: 'Nothing in the product sets an expiry or writes an expire entry yet, so the task still has nothing to warn about until an expiry policy is decided and implemented.',
      },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S02 added')
