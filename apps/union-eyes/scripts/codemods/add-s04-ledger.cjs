const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S04-CODE-CLOSURE-OF-REMAINING-PARTIALS'
const known = (start) => {
  for (const b of ledger.batches) for (const i of b.items) if (i.prefix.startsWith(start)) return i.prefix
  throw new Error('no earlier item ' + start)
}
if (!ledger.batches.some((x) => x.id === id)) {
  const test = A + 'lib/services/__tests__/s4-code-closure.test.ts'
  const item = (start, files, explanation) => ({ prefix: known(start), status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, test], explanation })
  ledger.batches.push({
    id,
    family: 'Code closure of partial fixes whose remaining part needed no external decision',
    evidenceCommit: null,
    items: [
      item('DEF-0B11-PRP-WALLET-GET-READS-BALANCE-AND-LEDGER-SEPARATELY', [A + 'lib/services/rewards/wallet-service.ts', A + 'app/api/rewards/wallet/route.ts', A + 'app/api/__tests__/rewards-wallet.route.test.ts', A + 'lib/services/rewards/__tests__/wallet-snapshot.pglite.test.ts'],
        'getWalletSnapshot reads the latest balance, the page and the total inside one repeatable-read transaction, so they cannot disagree; the response also carries the total and hasMore is computed from it. Proved on PostgreSQL (PGlite) for paging, scoping to the member and organization, and an empty ledger. The route test mock now returns the snapshot (disclosed).'),
      item('DEF-0B10-PEN-PENSION-LIST-READS-HAVE-NO-LIMIT-OR-PAGINATION', [A + 'lib/api/list-page.ts', A + 'app/api/pension/plans/route.ts', A + 'app/api/pension/trustees/route.ts', A + 'app/api/pension/members/route.ts', A + 'app/api/pension/benefits/route.ts', A + 'app/api/pension/contributions/route.ts', A + 'app/api/pension/t4a/route.ts', A + 'app/api/__tests__/pension-own-records.route.test.ts', A + 'lib/api/__tests__/f05-b36-bounds.contract.test.ts'],
        'The six pension list reads take bounded limit (1..200, default 200 so existing callers are unchanged) and offset (0..1,000,000) through the shared listPage helper, so rows beyond the first page are reachable. The own-records route test mock and the B36 bounds pin were adapted to the offset call (disclosed).'),
      item('DEF-0B5-COMMITTEE-REFERENCED-IDS-NOT-VERIFIED', [A + 'lib/services/own-storage-reference.ts', A + 'app/api/committees/[id]/documents/route.ts'],
        'A linked fileUrl must be a pointer into the organization\'s own document storage (verifiedLegacyBlobPath: configured storage account, document container, the organization\'s folder, no credential, no traversal) or the link is refused with 400. Tested with an own URL, another host, another organization\'s folder, a credential, a traversal and a metadata address.'),
      item('DEF-0B4-CALENDAR-EVENT-CALENDAR-ID-UNVERIFIED', [A + 'app/api/calendar/events/[id]/route.ts', A + 'app/api/calendar/events/route.ts'],
        'Existing implementation, verified: the event update schema is strict and does not accept calendarId, so an update cannot re-point an event at another calendar; creation already checks the calendar belongs to the organization and is not another member\'s personal calendar. Pinned by a test.'),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S04 added')
