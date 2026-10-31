const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'B59-F05-F08-READS-WITHOUT-SIDE-EFFECTS-AND-PRIVATE-DEFINITIONS'
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s6-verified-and-small-fixes.test.ts'
  const item = (prefix, files, explanation) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  ledger.batches.push({
    id,
    family: 'Reads that wrote, private definitions readable by others, and paths that advertised what they did not do',
    evidenceCommit: null,
    items: [
      item('DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES', [A + 'services/geofence-privacy-service.ts'],
        'A consent check is a read: past its expiry the consent is simply not valid. The status is moved to expired by the retention sweep (deleteExpiredLocationData), in the same system transaction as the deletions, which now reports consentsExpired. The existing geofence service and route tests pass.'),
      item('DEF-0B7-EXP-REPORT-DEFINITIONS-READABLE-AT-MEMBER-FLOOR', [A + 'lib/api/crud-factory.ts', A + 'app/api/reports/route.ts', A + 'app/api/reports/[id]/route.ts'],
        'The report reads already sit at the steward floor (upstream); a definition its author kept private (isPublic false) is now read by its author only, through the new factory option readConditionFor (applied to every list and item GET), so another steward no longer receives it with its whole config.'),
      item('DEF-0B11-IDS-SUPPORT-READ-GIVES-EVERY-STEWARD-THE-NOTIFICATIONS-OF-EVERY-MEMBER', [A + 'app/api/support/metrics/route.ts', A + 'app/api/support/sla/route.ts'],
        'Existing implementation, verified: both paths answer 501 and no longer expose the notifications CRUD, so no steward reads other members\' notifications through them.'),
      item('DEF-0B11-IDS-SECURITY-EVENTS-ROUTE-IS-CONFIGURED', [A + 'app/api/security/events/route.ts'],
        'The path now answers 501 behind the security-manager floor and reads and writes nothing. It was configured as a reader and a writer of security evidence while the governance list denied both, so the comment and the behaviour disagreed and a write path for security events existed only on paper; security events are read on the security dashboard and written by the system.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('B59 added')
