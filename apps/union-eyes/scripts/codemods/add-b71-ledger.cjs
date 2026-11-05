const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B71-VALIDATED-INPUT-AND-BOUNDED-SYSTEM-JOBS'
const test = A + 'lib/services/__tests__/s15-validation-and-bounded-jobs.test.ts'
if (!ledger.batches.some((x) => x.id === id)) {
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  ledger.batches.push({
    id,
    family: 'Parsed request bodies and system jobs that were unbounded or unreported',
    evidenceCommit: null,
    items: [
      item('DEF-0B6-CMP-VALIDATE-INPUT-NOT-VALIDATED', [A + 'app/api/compliance/validate/route.ts'], 'The body is parsed with a strict schema (jurisdiction from the CA-XX set, checks from the three known names, dates that are dates, counts as numbers or short text); an unknown jurisdiction or check, an unknown key or an invalid date is a 400 instead of silently producing no check. The unused schema is replaced.'),
      item('DEF-0B6-SYS-REAPER-OBJECTS-PAST-RETRY-LIMIT-ARE-ABANDONED-UNREPORTED', [A + 'lib/documents/intake-lifecycle.ts', A + 'app/api/cron/document-intake-reaper/route.ts', A + 'lib/documents/document-intake.pglite.test.ts'], 'Objects past the deletion retry limit are counted (countAbandonedIntakeObjects), the reaper report carries abandoned, and the cron answers a visible failed run naming them. The PGlite test expectations gained abandoned (disclosed).'),
      item('DEF-0B6-SYS-LOCATION-RETENTION-BATCH-UNBOUNDED-IN-ONE-TRANSACTION', [A + 'services/geofence-privacy-service.ts', A + 'services/__tests__/geofence-privacy-service.test.ts', A + 'db/__tests__/location-retention-owner.pglite.test.ts'], 'One run selects at most 500 distinct members with expired rows (distinct, limited) and reports truncated when more remain, so a backlog is worked off over several runs instead of one long system transaction. The service mock gained selectDistinct and a cap case, and the PGlite expectation gained truncated (disclosed).'),
      item('DEF-0B6-SYS-OBSERVABILITY-SWEEP-ALERT-HAS-NO-HUMAN-RECIPIENT', [A + 'services/observability/realtime-alerting-service.ts'], 'Verified in source: the alert is addressed to each active admin or president of the organization, and an organization with none records a failed execution naming that instead of an alert to a pseudo-user.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B71 added')
