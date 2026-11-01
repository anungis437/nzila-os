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
      { prefix: 'DEF-0B8-JUR-LOCATION-CONSENT-GET-EXPIRES', status: 'PARTIAL', files: [A + 'services/geofence-privacy-service.ts', test],
        explanation: 'A consent check is a read and no longer writes: past its expiry the consent is simply not valid, whatever its stored status. The existing geofence service and route tests pass.',
        remaining: 'The stored status of an expired consent never becomes expired: a sweep needs the system role to hold UPDATE on member_location_consent, which the storage-authority manifest and the location-retention ratchets do not grant (an attempt broke them and was reverted).' },
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
