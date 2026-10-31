const fs = require('fs')
const path = require('path')
const file = path.resolve(__dirname, '../../../../docs/union-eyes/convergence/remediation/elimination-batches.json')
const ledger = JSON.parse(fs.readFileSync(file, 'utf8'))
const A = 'apps/union-eyes/'
const id = 'S05-TENANT-SCOPED-UNIQUENESS-MIGRATION-0042'
if (!ledger.batches.some((x) => x.id === id)) {
  const mig = [A + 'db/migrations-platform/0042_tenant_scoped_uniqueness.sql', A + 'db/migrations-platform/0042_tenant_scoped_uniqueness.rollback.sql', A + 'db/__tests__/platform-0042-tenant-scoped-uniqueness.pglite.test.ts', A + 'lib/services/__tests__/s7-tenant-scoped-uniqueness.test.ts']
  const item = (prefix, files, explanation, extra = {}) => ({ prefix, status: 'IMPLEMENTED_PENDING_QUALIFICATION', files: [...files, ...mig], explanation, ...extra })
  ledger.batches.push({
    id,
    family: 'Schema: record numbers and codes unique within an organization, not across every organization',
    evidenceCommit: null,
    items: [
      item('DEF-0B4-CBAS-CBA-NUMBER-GLOBALLY-UNIQUE', [A + 'db/schema/domains/agreements/collective-agreements.ts', A + 'db/schema/collective-agreements-schema.ts'],
        'Migration 0042 replaces the single-column unique constraint on collective_agreements.cba_number with a unique index on (organization_id, cba_number): two organizations may use one agreement number and a repeat inside one is refused, so a number taken elsewhere is no longer disclosed by a refusal. Proved on PGlite, including a standalone unique index form, idempotency, refusal over existing in-organization duplicates, fail-closed on a missing organization_id, and a rollback that refuses when two organizations share a code.'),
      item('DEF-0B6-EDU-GLOBAL-UNIQUE-CODES-ACROSS-ORGANIZATIONS', [A + 'db/schema/domains/scheduling/training.ts', A + 'db/schema/education-training-schema.ts'],
        'Migration 0042 makes course_code, session_code and certification_number unique within an organization instead of across all of them, so one organization\'s code no longer blocks another\'s.'),
      item('DEF-0B8-HS-RECORD-NUMBERS-CALLER-SUPPLIED-AND-UNIQUE-ACROSS-ORGANIZATI', [A + 'db/schema/domains/health-safety/health-safety-schema.ts'],
        'Migration 0042 makes incident_number, inspection_number, report_number and item_number unique within an organization.',
        { status: 'PARTIAL', remaining: 'The numbers are still supplied by the caller; a server-issued per-organization sequence is not built.' }),
      item('DEF-0B10-ORG-CAMPAIGN-CODE-UNIQUE-ACROSS-ALL-ORGANIZATIONS-AND-REQUIRE', [A + 'db/schema/domains/infrastructure/organizing.ts', A + 'db/schema/organizing-tools-schema.ts'],
        'Migration 0042 makes organizing_campaigns.campaign_code unique within an organization.',
        { status: 'PARTIAL', remaining: 'campaign_code and the other columns are still required in the body; a server-issued code and defaults are not built.' }),
    ],
  })
}
for (const batch of ledger.batches.filter((x) => x.id === id)) {
  for (const item of batch.items) for (const f of item.files) if (!fs.existsSync(path.resolve(__dirname, '../../../../', f))) throw new Error('missing file ' + f)
}
fs.writeFileSync(file, JSON.stringify(ledger, null, 2) + '\n')
console.log('S05 added')
