const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S07-ANTI-SCAB-AUTHOR-MIGRATION-0044'
if (!ledger.batches.some((x) => x.id === id)) {
  ledger.batches.push({
    id,
    family: 'Schema: the author of an anti-scab violation is recorded by the server',
    evidenceCommit: null,
    items: [
      { prefix: 'DEF-0B4-OHS-ANTI-SCAB-RECORD-NO-AUTHOR-OR-CASE-AUTHORITY', status: 'PARTIAL',
        files: [A + 'db/migrations-platform/0044_anti_scab_author.sql', A + 'db/migrations-platform/0044_anti_scab_author.rollback.sql', A + 'db/schema/domains/health-safety/cnesst-schema.ts', A + 'app/api/cnesst/anti-scab/route.ts', A + 'app/api/cnesst/anti-scab/[id]/route.ts', A + 'lib/services/__tests__/s8-anti-scab-author.test.ts'],
        explanation: 'Migration 0044 adds created_by (text, nullable; the existing reported_by_id is a uuid and could not hold a session principal) to anti_scab_violations. The factory stamps the session user as the author on create; the collection route no longer accepts the reporter, a resolution, a penalty or a tribunal filing from the body, and the item route refuses to patch the author or the reporter. Proved on PGlite for the migration and by source pins.',
        remaining: 'Any steward of the organization still reads and rewrites every violation: case authority (the steward represents the member the matter concerns) needs a kernel resource type for these records.' },
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S07 added')
